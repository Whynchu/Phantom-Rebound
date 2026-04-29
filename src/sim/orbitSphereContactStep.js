// R3 parity — orbit-sphere enemy contact during rollback resim.

import { getOrbitSlotPosition } from '../entities/defenseRuntime.js';
import { applyOrbitSphereContact } from '../entities/enemyRuntime.js';
import { computeKillScore } from '../systems/scoring.js';
import { resolveOrbitKillEffects } from '../systems/killRewards.js';
import { emit } from './effectQueue.js';
import { spawnSimGreyDrops } from './simProjectiles.js';

const ORBIT_ROTATION_SPD = 0.003;
const ORBIT_SPHERE_R = 40;
const ORBITAL_FOCUS_CONTACT_BONUS = 15;

function resolveOrbitSphereContactHits(state, opts = {}) {
  const enemies = state?.enemies;
  const slots = state?.slots;
  if (!Array.isArray(enemies) || !Array.isArray(slots) || enemies.length === 0) return 0;

  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;
  let hits = 0;

  for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
    const slot = slots[slotIndex];
    if (!canSlotOrbitHit(slot)) continue;

    const upg = slot.upg || {};
    const body = slot.body || {};
    const orbCooldown = syncOrbCooldowns(slot);
    const orbitSphereTier = upg.orbitSphereTier | 0;
    const orbDamageBonus = getOrbDamageBonus(upg);

    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
      const enemy = enemies[enemyIndex];
      if (!canEnemyBeHit(enemy)) continue;

      const contact = applyOrbitSphereContact(enemy, {
        orbCooldown,
        orbitSphereTier,
        ts,
        getOrbitSlotPosition,
        rotationSpeed: opts.orbitRotationSpeed ?? ORBIT_ROTATION_SPD,
        radius: getOrbitRadius(upg, opts),
        originX: body.x || 0,
        originY: body.y || 0,
        orbitalFocus: !!upg.orbitalFocus,
        chargeRatio: getChargeRatio(slot),
        orbSphereRadius: getOrbVisualRadius(upg),
        baseDamage: opts.orbitContactBaseDamage ?? 20,
        focusDamageBonus: opts.orbitalFocusContactBonus ?? ORBITAL_FOCUS_CONTACT_BONUS,
        focusChargeScale: opts.orbitalFocusChargeScale ?? 1.5,
        orbDamageBonus,
      });

      if (!contact.hit) continue;
      hits++;
      emitEffect(state, opts, 'orbit.enemyHit', {
        slotIndex,
        enemyId: enemy.eid ?? enemy.id ?? null,
        damage: contact.damage,
        x: contact.slotX,
        y: contact.slotY,
        enemyHp: enemy.hp,
      });

      if (!contact.killed) continue;

      awardOrbitKill(state, slot, enemy, opts);
      spawnSimGreyDrops(state, {
        x: enemy.x,
        y: enemy.y,
        ts,
        count: opts.orbitKillGreyDropCount ?? 1,
        maxBullets: opts.maxBullets,
      });
      emitEffect(state, opts, 'orbit.enemyKilled', {
        slotIndex,
        enemyId: enemy.eid ?? enemy.id ?? null,
        x: enemy.x,
        y: enemy.y,
      });
      enemies.splice(enemyIndex, 1);
    }
  }

  return hits;
}

function canSlotOrbitHit(slot) {
  if (!slot?.body || slot.body.alive === false) return false;
  const tier = slot.upg?.orbitSphereTier | 0;
  return tier > 0;
}

function canEnemyBeHit(enemy) {
  if (!enemy || enemy.dead || enemy.alive === false) return false;
  return Number.isFinite(enemy.x) && Number.isFinite(enemy.y);
}

function syncOrbCooldowns(slot) {
  if (!slot.orbState) slot.orbState = {};
  if (!Array.isArray(slot.orbState.cooldowns)) slot.orbState.cooldowns = [];
  const cooldowns = slot.orbState.cooldowns;
  const tier = slot.upg?.orbitSphereTier | 0;
  while (cooldowns.length < tier) cooldowns.push(0);
  if (cooldowns.length > tier) cooldowns.length = tier;
  return cooldowns;
}

function getOrbitRadius(upg, opts) {
  const base = Number.isFinite(opts.orbitSphereRadius) ? opts.orbitSphereRadius : ORBIT_SPHERE_R;
  return base + (upg.orbitRadiusBonus || 0);
}

function getOrbVisualRadius(upg) {
  return 5 * (upg.orbSizeMult || 1);
}

function getOrbDamageBonus(upg) {
  return (1 + 0.25 * (upg.orbDamageTier || 0)) * (1 + 0.10 * Math.max(0, (upg.orbitSphereTier | 0) - 1));
}

function getChargeRatio(slot) {
  const metrics = slot?.metrics || {};
  const maxCharge = Math.max(1, metrics.maxCharge || slot?.upg?.maxCharge || 1);
  return Math.max(0, Math.min(1, (metrics.charge || 0) / maxCharge));
}

function awardOrbitKill(state, slot, enemy, opts) {
  const metrics = slot?.metrics || {};
  const upg = slot?.upg || {};
  const points = computeKillScore(enemy.pts, false);
  const killEffects = resolveOrbitKillEffects({
    scorePerKill: points,
    finalForm: !!upg.finalForm,
    hp: metrics.hp || 0,
    maxHp: metrics.maxHp || 1,
    finalFormChargeGain: opts.finalFormChargeGain ?? 0.5,
  });

  if (state.run) {
    state.run.score = (state.run.score || 0) + killEffects.scoreDelta;
    state.run.kills = (state.run.kills || 0) + killEffects.killsDelta;
    if (state.run.scoreBreakdown) {
      state.run.scoreBreakdown.kills = (state.run.scoreBreakdown.kills || 0) + killEffects.scoreDelta;
    }
  }
  if (killEffects.shouldGrantFinalFormCharge) {
    gainSlotCharge(slot, killEffects.finalFormChargeGain);
  }
}

function gainSlotCharge(slot, amount) {
  if (!slot?.metrics) return 0;
  const maxCharge = Math.max(1, slot.metrics.maxCharge || slot.upg?.maxCharge || 1);
  const before = slot.metrics.charge || 0;
  slot.metrics.charge = Math.min(maxCharge, before + Math.max(0, amount || 0));
  return slot.metrics.charge - before;
}

function emitEffect(state, opts, kind, payload) {
  if (!opts.queueEffects || !Array.isArray(state?.effectQueue)) return;
  emit(state, kind, payload);
}

export {
  resolveOrbitSphereContactHits,
};
