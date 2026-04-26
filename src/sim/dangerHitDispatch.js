// R3.1 — danger projectile vs player-slot combat during rollback resim.
//
// This module mutates SimState only. Cosmetic/audio/telemetry work is emitted
// as data descriptors when queueEffects is enabled, so rollback replays never
// call DOM/canvas/audio helpers directly.

import {
  LATE_BLOOM_DAMAGE_TAKEN_PENALTY,
} from '../data/boonConstants.js';
import { getLateBloomGrowth } from '../systems/boonHelpers.js';
import { computeProjectileHitDamage } from '../systems/damage.js';
import {
  resolveDangerPlayerHit,
  resolveSlipstreamNearMiss,
  resolveRusherContactHit,
  resolvePostHitAftermath,
  convertNearbyDangerBulletsToGrey,
} from '../systems/dangerHit.js';
import { emit } from './effectQueue.js';
import {
  pushSimOutputBullet,
  spawnSimRadialOutputBurst,
} from './simProjectiles.js';

const PHASE_DASH_DAMAGE_MULT = 0.25;
const GLOBAL_SPEED_LIFT = 1.55;
const BASE_PROJECTILE_INVULN_S = 1.2;
const MIN_PROJECTILE_INVULN_S = 0.6;
const BASE_CONTACT_INVULN_S = 1.0;
const MIN_CONTACT_INVULN_S = 0.45;
const BOSS_CLEAR_INVULN_REDUCTION_S = 0.08;
const RUSHER_CONTACT_DAMAGE = 18;
const GAME_OVER_ANIM_MS = 850;
const BLOOD_PACT_BASE_HEAL_CAP_PER_BULLET = 1;
const BLOOD_PACT_BLOOD_MOON_BONUS_CAP = 1;

function resolveDangerHits(state, opts = {}) {
  const bullets = state?.bullets;
  const slots = state?.slots;
  if (!Array.isArray(bullets) || !Array.isArray(slots) || bullets.length === 0) return 0;

  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;
  let hits = 0;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (!bullet || bullet.state !== 'danger') continue;

    let removed = false;
    for (let si = 0; si < slots.length; si++) {
      const slot = slots[si];
      if (!canSlotBeHit(slot)) continue;

      const body = slot.body;
      if ((body.invincible || 0) > 0) continue;

      const upg = slot.upg || {};
      const metrics = slot.metrics || {};
      const directDamage = getProjectileDamageForSlot(state, slot, 1, opts);
      const dangerHit = resolveDangerPlayerHit({
        bullet,
        player: body,
        upgrades: upg,
        ts,
        hp: metrics.hp || 0,
        maxHp: metrics.maxHp || 1,
        phaseDamage: getProjectileDamageForSlot(state, slot, PHASE_DASH_DAMAGE_MULT, opts),
        directDamage,
        projectileInvulnSeconds: getProjectileInvulnSeconds(state, opts),
      });

      if (dangerHit.kind === 'void-block') {
        bullets.splice(i, 1);
        emitEffect(state, opts, 'danger.voidBlock', { slotIndex: si, bulletId: bullet.id, x: bullet.x, y: bullet.y });
        hits++;
        removed = true;
        break;
      }

      if (dangerHit.kind === 'phase-dash') {
        applyPhaseDashHit(state, slot, dangerHit, bullet, opts);
        bullets.splice(i, 1);
        hits++;
        removed = true;
        break;
      }

      if (dangerHit.kind === 'mirror-tide') {
        applyMirrorTide(state, slot, dangerHit, bullet, opts);
        bullets.splice(i, 1);
        hits++;
        removed = true;
        break;
      }

      if (dangerHit.kind === 'direct-hit') {
        applyDirectHit(state, slot, dangerHit, bullet, opts);
        // EMP burst may already have removed this bullet along with every
        // other danger bullet. If not, remove the current source bullet.
        const stillAtIndex = bullets[i] === bullet;
        if (stillAtIndex) bullets.splice(i, 1);
        hits++;
        removed = true;
        break;
      }

      const slipstream = resolveSlipstreamNearMiss({
        bullet,
        player: body,
        upgrades: upg,
        slipCooldown: slot.timers?.slipCooldown || 0,
      });
      if (slipstream.shouldTrigger) {
        gainSlotCharge(slot, slipstream.chargeGain);
        if (slot.timers) slot.timers.slipCooldown = slipstream.nextSlipCooldown;
        emitEffect(state, opts, 'danger.slipstream', {
          slotIndex: si,
          bulletId: bullet.id,
          chargeGain: slipstream.chargeGain,
        });
      }
    }
    if (removed) continue;
  }

  return hits;
}

function canSlotBeHit(slot) {
  if (!slot || !slot.body || !slot.metrics) return false;
  if (slot.body.alive === false) return false;
  if (slot.body.coopSpectating) return false;
  if ((slot.body.deadAt || 0) > 0) return false;
  return (slot.metrics.hp || 0) > 0;
}

function getProjectileDamageForSlot(state, slot, multiplier, opts) {
  const upg = slot.upg || {};
  return computeProjectileHitDamage({
    roomIndex: state.run?.roomIndex || 0,
    bossDamageMultiplier: opts.bossDamageMultiplier ?? 1,
    damageTakenMultiplier: upg.damageTakenMult || 1,
    lateBloomDamageTakenMultiplier: getLateBloomDamageTakenMultiplier(upg, state.run?.roomIndex || 0),
    multiplier,
  });
}

function getLateBloomDamageTakenMultiplier(upg, roomIndex) {
  switch (upg?.lateBloomVariant) {
    case 'speed':
      return LATE_BLOOM_DAMAGE_TAKEN_PENALTY;
    case 'defense':
      return 1 / getLateBloomGrowth(roomIndex);
    default:
      return 1;
  }
}

function getProjectileInvulnSeconds(state, opts) {
  const base = opts.baseProjectileInvulnSeconds ?? BASE_PROJECTILE_INVULN_S;
  const min = opts.minProjectileInvulnSeconds ?? MIN_PROJECTILE_INVULN_S;
  const reduction = (state.run?.bossClears || 0) * (opts.bossClearInvulnReductionSeconds ?? BOSS_CLEAR_INVULN_REDUCTION_S);
  return Math.max(min, base - reduction);
}

function getContactInvulnSeconds(state, opts) {
  const base = opts.baseContactInvulnSeconds ?? BASE_CONTACT_INVULN_S;
  const min = opts.minContactInvulnSeconds ?? MIN_CONTACT_INVULN_S;
  const reduction = (state.run?.bossClears || 0) * (opts.bossClearInvulnReductionSeconds ?? BOSS_CLEAR_INVULN_REDUCTION_S);
  return Math.max(min, base - reduction);
}

/**
 * R3.4 — Rusher contact damage during rollback resim.
 *
 * For each live rusher enemy, find the nearest alive non-invincible slot,
 * check circle overlap, and apply contact damage + aftermath (matching the
 * live loop in script.js ~line 5846). Only the nearest slot is hit per
 * rusher per tick, matching live semantics.
 *
 * Must be called AFTER tickEnemyCombat (so enemy positions are updated) and
 * BEFORE tickBulletsKinematic (so contact invuln gates same-tick bullet hits).
 *
 * @param {object} state - SimState (mutated in-place)
 * @param {object} [opts] - sim config (bossClearInvulnReductionSeconds, queueEffects, etc.)
 * @returns {number} number of contact hits applied
 */
function resolveRusherContactHits(state, opts = {}) {
  const enemies = state?.enemies;
  const slots = state?.slots;
  if (!Array.isArray(enemies) || !Array.isArray(slots) || enemies.length === 0) return 0;

  let hits = 0;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy || !enemy.isRusher || enemy.dead || enemy.alive === false) continue;

    // Match live-loop target selection: nearest alive non-invincible slot only.
    // (live code only hits the chosen target slot, not all overlapping slots)
    let targetSlot = null;
    let bestDist = Infinity;
    for (let s = 0; s < slots.length; s++) {
      const slot = slots[s];
      if (!canSlotBeHit(slot)) continue;
      if ((slot.body.invincible || 0) > 0) continue;
      const d = Math.hypot(slot.body.x - enemy.x, slot.body.y - enemy.y);
      if (d < bestDist) {
        bestDist = d;
        targetSlot = slot;
      }
    }

    if (!targetSlot) continue;

    const body = targetSlot.body;
    if (bestDist >= body.r + enemy.r + 2) continue;

    const upg = targetSlot.upg || {};
    const metrics = targetSlot.metrics || {};
    const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;

    const contactInvulnSeconds = getContactInvulnSeconds(state, opts);
    const hit = resolveRusherContactHit({
      hp: metrics.hp || 0,
      upgrades: upg,
      contactDamage: opts.rusherContactDamage ?? RUSHER_CONTACT_DAMAGE,
      contactInvulnSeconds,
    });

    metrics.hp = hit.nextHp;
    body.invincible = hit.invincibleSeconds;
    body.distort = hit.distortSeconds;
    if (state.run) state.run.tookDamageThisRoom = true;

    applyAftermath(state, targetSlot, hit, { enableShockwave: true, shouldTriggerLastStand: Boolean(upg.lastStand && hit.lifelineTriggered), opts });

    emitEffect(state, opts, 'contact.rusherHit', {
      slotIndex: targetSlot.index || 0,
      enemyId: enemy.eid ?? enemy.id,
      damage: hit.damage,
      hp: metrics.hp,
      x: body.x,
      y: body.y,
      ts,
    });

    hits++;
  }

  return hits;
}

function applyPhaseDashHit(state, slot, hit, bullet, opts) {
  const body = slot.body;
  const upg = slot.upg || {};
  const metrics = slot.metrics || {};
  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;
  const world = getWorldBounds(state, opts);

  upg.phaseDashRoomUses = hit.nextPhaseDashRoomUses;
  upg.phaseDashCooldown = hit.nextPhaseDashCooldown;
  upg.isDashing = true;
  body.invincible = hit.invincibleSeconds;
  body.x += Math.cos(hit.awayAngle) * hit.dashDistance;
  body.y += Math.sin(hit.awayAngle) * hit.dashDistance;
  clampBodyToWorld(body, world);
  metrics.hp = hit.nextHp;
  body.distort = hit.distortSeconds;
  if (state.run) state.run.tookDamageThisRoom = true;
  if (hit.shouldGainHitCharge) gainSlotCharge(slot, upg.hitChargeGain);
  upg.voidZoneActive = hit.nextVoidZoneActive;
  upg.voidZoneTimer = hit.nextVoidZoneTimer;
  applyAftermath(state, slot, hit, { enableShockwave: false, opts });
  emitEffect(state, opts, 'danger.phaseDashHit', {
    slotIndex: slot.index || 0,
    bulletId: bullet.id,
    damage: hit.damage,
    hp: metrics.hp,
    x: body.x,
    y: body.y,
    ts,
  });
}

function applyMirrorTide(state, slot, hit, bullet, opts) {
  const body = slot.body;
  const upg = slot.upg || {};
  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;
  const speedLift = opts.globalSpeedLift ?? GLOBAL_SPEED_LIFT;

  upg.mirrorTideRoomUses = hit.nextMirrorTideRoomUses;
  upg.mirrorTideCooldown = hit.nextMirrorTideCooldown;
  pushSimOutputBullet(state, {
    x: body.x,
    y: body.y,
    vx: Math.cos(hit.reflectAngle) * 200 * speedLift,
    vy: Math.sin(hit.reflectAngle) * 200 * speedLift,
    radius: bullet.r,
    bounceLeft: 0,
    pierceLeft: 0,
    homing: false,
    crit: false,
    dmg: (upg.playerDamageMult || 1) * (upg.denseDamageMult || 1),
    expireAt: ts + 2000,
    ownerId: slot.index || 0,
  });
  emitEffect(state, opts, 'danger.mirrorTide', {
    slotIndex: slot.index || 0,
    bulletId: bullet.id,
    reflectAngle: hit.reflectAngle,
  });
}

function applyDirectHit(state, slot, hit, bullet, opts) {
  const body = slot.body;
  const upg = slot.upg || {};
  const metrics = slot.metrics || {};

  metrics.hp = hit.nextHp;
  body.invincible = hit.invincibleSeconds;
  body.distort = hit.distortSeconds;
  if (state.run) state.run.tookDamageThisRoom = true;
  if (hit.shouldGainHitCharge) gainSlotCharge(slot, upg.hitChargeGain);

  if (hit.shouldEmpBurst) {
    upg.empBurstUsed = hit.nextEmpBurstUsed;
    removeDangerBullets(state, opts);
  }

  applyAftermath(state, slot, hit, {
    enableShockwave: true,
    shouldTriggerLastStand: Boolean(upg.lastStand && hit.lifelineTriggered),
    opts,
  });

  emitEffect(state, opts, 'danger.directHit', {
    slotIndex: slot.index || 0,
    bulletId: bullet.id,
    damage: hit.damage,
    hp: metrics.hp,
    x: body.x,
    y: body.y,
  });
}

function applyAftermath(state, slot, hit, { enableShockwave, shouldTriggerLastStand = false, opts } = {}) {
  const body = slot.body;
  const upg = slot.upg || {};
  const timers = slot.timers || {};
  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;
  const speedLift = opts?.globalSpeedLift ?? GLOBAL_SPEED_LIFT;
  const after = resolvePostHitAftermath({
    hitResult: hit,
    upgrades: upg,
    colossusShockwaveCd: timers.colossusShockwaveCd || 0,
    enableShockwave,
    shouldTriggerLastStand,
    playerX: body.x,
    playerY: body.y,
    shotSpeed: 220 * speedLift,
    now: ts,
    bloodPactHealCap: getBloodPactHealCap(upg),
  });

  if (after.triggerColossusShockwave) {
    timers.colossusShockwaveCd = after.nextColossusShockwaveCd;
    convertNearbyDangerBulletsToGrey({
      bullets: state.bullets,
      originX: body.x,
      originY: body.y,
      radius: 120,
      ts,
    });
    emitEffect(state, opts, 'danger.colossusShockwave', { x: body.x, y: body.y, radius: 120 });
  }

  if (after.shouldApplyLifelineState) {
    upg.lifelineTriggerCount = after.nextLifelineTriggerCount;
    upg.lifelineUsed = after.nextLifelineUsed;
    if (after.lastStandBurstSpec) {
      spawnSimRadialOutputBurst(state, after.lastStandBurstSpec);
    }
    emitEffect(state, opts, 'danger.lifelineTriggered', { slotIndex: slot.index || 0, x: body.x, y: body.y });
  } else if (after.shouldGameOver) {
    markSlotDead(state, slot, ts);
  }
}

function gainSlotCharge(slot, amount) {
  const metrics = slot.metrics || {};
  const upg = slot.upg || {};
  const maxCharge = Math.max(1, upg.maxCharge || 1);
  metrics.charge = Math.min(maxCharge, (metrics.charge || 0) + Math.max(0, amount || 0));
}

function removeDangerBullets(state, opts) {
  const bullets = state.bullets;
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (bullets[i]?.state === 'danger') {
      emitEffect(state, opts, 'danger.empRemovedBullet', { bulletId: bullets[i].id, x: bullets[i].x, y: bullets[i].y });
      bullets.splice(i, 1);
    }
  }
}

function markSlotDead(state, slot, ts) {
  const body = slot.body;
  body.alive = false;
  body.deadAt = ts;
  body.popAt = ts + GAME_OVER_ANIM_MS * 0.72;
  body.deadPulse = 0;
  body.deadPop = false;
  if (state.run) {
    state.run.gameOver = true;
    state.run.gameOverShown = true;
  }
}

function getWorldBounds(state, opts) {
  const stateWorld = state.world || {};
  return {
    W: opts.worldW ?? stateWorld.w ?? state.worldW ?? 800,
    H: opts.worldH ?? stateWorld.h ?? state.worldH ?? 600,
    M: opts.margin ?? 16,
  };
}

function clampBodyToWorld(body, world) {
  const r = body.r || 0;
  body.x = Math.max(world.M + r, Math.min(world.W - world.M - r, body.x));
  body.y = Math.max(world.M + r, Math.min(world.H - world.M - r, body.y));
}

function getBloodPactHealCap(upg) {
  return BLOOD_PACT_BASE_HEAL_CAP_PER_BULLET + (upg?.bloodMoon ? BLOOD_PACT_BLOOD_MOON_BONUS_CAP : 0);
}

function emitEffect(state, opts, kind, payload) {
  if (!opts.queueEffects || !Array.isArray(state?.effectQueue)) return;
  emit(state, kind, payload);
}

export {
  resolveDangerHits,
  resolveRusherContactHits,
  getProjectileDamageForSlot,
  getLateBloomDamageTakenMultiplier,
};
