// R0.4-C/D: Player auto-fire step — fireT timer, kinetic charge, auto-target,
// bullet volley spawn.
//
// Mirrors the auto-fire block in script.js update() (lines 5831-5891) and the
// firePlayer function (lines 4425-4556), adapted for rollback resim:
//   - No Math.random(), Date.now(), or performance.now() — use nextSimRandom.
//   - No DOM, audio, or canvas — use effectQueue.emit for visual effects.
//   - No LOS check (hasObstacleLineBlock unavailable) — distance-only targeting.

import { buildPlayerShotPlan, buildPlayerVolleySpecs } from '../entities/playerFire.js';
import { emit } from './effectQueue.js';
import { pushSimOutputBullet, nextSimRandom } from './simProjectiles.js';
import { getKineticChargeRate, getLateBloomGrowth } from '../data/boons.js';
import { LATE_BLOOM_DAMAGE_PENALTY } from '../data/boonConstants.js';

// ── Module constants (mirror script.js counterparts) ─────────────────────────
const JOY_DEADZONE = 0.15;
const PLAYER_SHOT_LIFE_MS = 2800;
const GLOBAL_SPEED_LIFT = 1.55;
const DENSE_DESPERATION_BONUS = 2.0;
const ESCALATION_KILL_PCT = 0.065;
const ESCALATION_MAX_BONUS = 0.40;

// Volley total-damage scaling table (mirrors script.js VOLLEY_TOTAL_DAMAGE_MULTS).
const VOLLEY_TOTAL_DAMAGE_MULTS = [1.00, 1.75, 2.40, 2.95, 3.40, 3.75, 4.00];

function getVolleyTotalDamageMultiplier(shotCount) {
  const count = Math.max(1, Math.floor(shotCount || 1));
  return VOLLEY_TOTAL_DAMAGE_MULTS[Math.min(VOLLEY_TOTAL_DAMAGE_MULTS.length - 1, count - 1)];
}

function getOverloadSizeScale(chargeSpent) {
  const spent = Math.max(1, Math.floor(chargeSpent || 1));
  return 2 + 2 * Math.min(1, Math.max(0, (spent - 5) / 25));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Pick the closest living enemy (distance-only; LOS not available in sim).
 * Returns { e, dist } or null.
 */
function pickAutoTarget(enemies, px, py) {
  if (!Array.isArray(enemies) || enemies.length === 0) return null;
  let best = null, bestDist = Infinity;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - px, dy = e.y - py;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best ? { e: best, dist: Math.sqrt(bestDist) } : null;
}

/**
 * Fire a bullet volley for one slot toward (targetX, targetY).
 * Mirrors firePlayer() in script.js, adapted for rollback-safe sim.
 */
function fireSimSlot(state, slot, targetX, targetY) {
  const body = slot.body;
  if (!body || body.coopSpectating) return;
  const upg = slot.upg || {};
  const metrics = slot.metrics || {};
  if ((metrics.charge || 0) < 1) return;

  // Update aim angle.
  const aimDx = targetX - body.x, aimDy = targetY - body.y;
  if (Math.abs(aimDx) > 0.001 || Math.abs(aimDy) > 0.001) {
    metrics.aimAngle = Math.atan2(aimDy, aimDx);
    metrics.aimHasTarget = true;
  }

  const angs = buildPlayerShotPlan({ tx: targetX, ty: targetY, player: body, upg });
  const availableShots = Math.min(Math.floor(metrics.charge), angs.length);
  if (availableShots <= 0) return;

  // Damage computation (mirrors firePlayer).
  const snipeScale = 1 + (upg.snipePower || 0) * 0.18;
  const bspd = 230 * GLOBAL_SPEED_LIFT * Math.min(2.0, upg.shotSpd || 1) * snipeScale;
  const baseRadius = 4.5 * Math.min(2.5, upg.shotSize || 1) * (1 + (upg.snipePower || 0) * 0.15);
  const predatorBonus = upg.predatorInstinct && upg.predatorKillStreak >= 2
    ? 1 + Math.min(upg.predatorKillStreak * 0.25, 1.25) : 1;
  const denseDesperationBonus = (upg.denseTier > 0 && upg.maxCharge === 1)
    ? DENSE_DESPERATION_BONUS : 1;
  const lateBloomGrowth = getLateBloomGrowth(state.run?.roomIndex || 0);
  const lateBloomDamage = upg.lateBloomVariant === 'power'
    ? lateBloomGrowth
    : (upg.lateBloomVariant === 'speed' ? 1 : LATE_BLOOM_DAMAGE_PENALTY);
  const escalationBonus = upg.escalation
    ? 1 + Math.min((upg.escalationKills || 0) * ESCALATION_KILL_PCT, ESCALATION_MAX_BONUS) : 1;
  const spsFireRateScaling = Math.max(0.5, 1 - (upg.spsTier || 0) * 0.04);
  const sustainedFireBonus = Math.min(1.45, 1 + Math.min(upg.sustainedFireShots || 0, 15) * 0.03);
  const baseDmg = (1 + (upg.snipePower || 0) * 0.35)
    * (upg.playerDamageMult || 1)
    * (upg.denseDamageMult || 1)
    * (upg.heavyRoundsDamageMult || 1)
    * predatorBonus
    * denseDesperationBonus
    * lateBloomDamage
    * escalationBonus
    * sustainedFireBonus
    * spsFireRateScaling
    * 10;
  const lifeMs = PLAYER_SHOT_LIFE_MS * (upg.shotLifeMult || 1) * (upg.phantomRebound ? 2.0 : 1.0);
  const now = state.timeMs || 0;
  const overchargeBonus = (upg.overchargeVent && metrics.charge >= upg.maxCharge) ? 1.6 : 1;
  const volleyTotalDamageMult = getVolleyTotalDamageMultiplier(availableShots);
  const volleyPerBulletDamageMult = volleyTotalDamageMult / availableShots;

  // Overload: spend full bank, scale damage + size.
  let overloadBonus = 1, overloadSizeScale = 1, chargeSpent = availableShots;
  if (upg.overload && upg.overloadActive && metrics.charge >= upg.maxCharge) {
    chargeSpent = Math.max(availableShots, Math.floor(metrics.charge));
    overloadBonus = chargeSpent / availableShots;
    overloadSizeScale = getOverloadSizeScale(chargeSpent);
    upg.overloadActive = false;
    upg.overloadCooldown = 3000;
  }

  const bloodPactHealCap = 1 + (upg.bloodMoon ? 1 : 0);

  const volleySpecs = buildPlayerVolleySpecs({
    shots: angs,
    availableShots,
    player: body,
    upg,
    bulletSpeed: bspd,
    baseRadius,
    baseDamage: baseDmg * volleyPerBulletDamageMult,
    lifeMs,
    overchargeBonus,
    overloadBonus,
    overloadSizeScale,
    getPierceLeft: (shot) => (upg.pierceTier || 0) + ((shot.isRing && upg.corona) ? 1 : 0),
    getBloodPactHealCap: () => bloodPactHealCap,
    now,
    ownerId: slot.index ?? 0,
    random: () => nextSimRandom(state),
  });

  volleySpecs.forEach((spec) => pushSimOutputBullet(state, spec));
  metrics.charge = Math.max(0, metrics.charge - chargeSpent);

  // Visual effects via effectQueue.
  emit(state, 'playerFire.sparks', {
    x: body.x, y: body.y,
    count: 4 + Math.min(6, availableShots),
    ownerId: slot.index,
  });

  // Shockwave — push enemies + emit effect.
  if (upg.shockwave && availableShots === Math.floor(upg.maxCharge) && (upg.shockwaveCooldown || 0) <= 0) {
    upg.shockwaveCooldown = 2250;
    if (Array.isArray(state.enemies)) {
      for (const e of state.enemies) {
        const dx = e.x - body.x, dy = e.y - body.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) { e.vx = (dx / dist) * 300; e.vy = (dy / dist) * 300; }
      }
    }
    emit(state, 'playerFire.shockwave', { x: body.x, y: body.y, ownerId: slot.index });
  }

  // Echo fire — every 5th shot fires a no-variance echo volley.
  if (upg.echoFire) {
    const timers = slot.timers || {};
    const nextEcho = (typeof timers.echoCounter === 'number') ? timers.echoCounter + 1 : 1;
    if (nextEcho >= 5) {
      timers.echoCounter = 0;
      const echoSpecs = buildPlayerVolleySpecs({
        shots: angs,
        availableShots,
        player: body,
        upg: { ...upg, critChance: 0 },
        bulletSpeed: bspd,
        baseRadius,
        baseDamage: baseDmg * volleyPerBulletDamageMult,
        lifeMs,
        overchargeBonus: 1,
        overloadBonus: 1,
        overloadSizeScale: 1,
        getPierceLeft: (shot) => (upg.pierceTier || 0) + ((shot.isRing && upg.corona) ? 1 : 0),
        getBloodPactHealCap: () => bloodPactHealCap,
        now: state.timeMs || 0,
        ownerId: slot.index ?? 0,
        random: () => 1,
        damageVarianceMin: 1,
        damageVarianceMax: 1,
      });
      echoSpecs.forEach((spec) => pushSimOutputBullet(state, spec));
    } else {
      timers.echoCounter = nextEcho;
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Advance player auto-fire logic for one sim tick (both slots).
 * Advances fireT, kinetic charge, picks auto-target, spawns output bullets.
 *
 * @param {object} state - SimState
 * @param {object|null} slot0Input - { joy: {dx,dy,active,mag?} } or null
 * @param {object|null} slot1Input - same shape for coop slot
 * @param {number} dt - delta time in seconds
 * @param {object} [opts]
 * @param {boolean} [opts.combatActive] - whether combat is active (spawning|fighting)
 */
export function tickPlayerFire(state, slot0Input, slot1Input, dt, opts = {}) {
  if (!state || !Array.isArray(state.slots)) return;

  const combatActive = opts.combatActive != null
    ? opts.combatActive
    : (state.run?.roomPhase === 'spawning' || state.run?.roomPhase === 'fighting');
  const timeMs = state.timeMs || 0;

  const slotPairs = [
    { slot: state.slots[0], input: slot0Input },
    { slot: state.slots[1], input: slot1Input },
  ];

  for (const { slot, input: slotInput } of slotPairs) {
    if (!slot || !slot.body) continue;
    const body = slot.body;
    if (body.coopSpectating) continue;

    const upg = slot.upg || {};
    const metrics = slot.metrics || {};

    const joy = slotInput?.joy;
    const isStill = !joy?.active || (joy?.mag ?? 0) <= JOY_DEADZONE;

    if (!isStill) {
      // Moving: reset still timer and accumulate kinetic charge.
      metrics.stillTimer = 0;
      if ((upg.moveChargeRate || 0) > 0 && combatActive) {
        const maxCharge = upg.maxCharge || 1;
        const kineticRate = getKineticChargeRate(upg, metrics.charge || 0) * (upg.fluxState ? 2 : 1);
        metrics.charge = Math.min(maxCharge, (metrics.charge || 0) + kineticRate * dt);
      }
    } else {
      // Still: accumulate still timer.
      metrics.stillTimer = (metrics.stillTimer || 0) + dt;
    }

    // Overload auto-trigger at full charge.
    if (upg.overload && (metrics.charge || 0) >= (upg.maxCharge || 1) && (upg.overloadCooldown || 0) <= 0) {
      upg.overloadActive = true;
    }

    // Auto-target: pick closest living enemy.
    const autoTarget = (combatActive && Array.isArray(state.enemies) && state.enemies.length > 0)
      ? pickAutoTarget(state.enemies, body.x, body.y)
      : null;

    if (autoTarget) {
      metrics.aimAngle = Math.atan2(autoTarget.e.y - body.y, autoTarget.e.x - body.x);
      metrics.aimHasTarget = true;
    } else if (!combatActive || !Array.isArray(state.enemies) || state.enemies.length === 0) {
      metrics.aimHasTarget = false;
    }

    // fireT advance and auto-fire gate.
    if (combatActive && (metrics.charge || 0) >= 1 && (upg.sps || 0) > 0) {
      const interval = 1 / ((upg.sps) * 2 * (upg.heavyRoundsFireMult || 1));
      const mobileChargeMult = isStill ? 1.0 : (upg.mobileChargeRate || 0.10);
      metrics.fireT = (metrics.fireT || 0) + dt * mobileChargeMult;
      if (!isStill) {
        // Cap while moving — prevents pre-accumulated double shot on stop.
        metrics.fireT = Math.min(metrics.fireT, interval);
      }
      if (metrics.fireT >= interval && isStill && autoTarget) {
        metrics.fireT = metrics.fireT % interval;
        fireSimSlot(state, slot, autoTarget.e.x, autoTarget.e.y);
        upg.sustainedFireShots = (upg.sustainedFireShots || 0) + 1;
        upg.sustainedFireLastShotTime = timeMs;
      }
    }

    // Sustained fire decay: reset if > 1s since last shot.
    if ((upg.sustainedFireLastShotTime || 0) > 0 && timeMs - upg.sustainedFireLastShotTime > 1000) {
      upg.sustainedFireShots = 0;
      upg.sustainedFireBonus = 1;
    }

    metrics.prevStill = isStill;
  }
}
