// R3 parity — charged orb firing during rollback resim.

import { CHARGED_ORB_FIRE_INTERVAL_MS } from '../data/boons.js';
import { getRequiredShotCount } from '../systems/boonHelpers.js';
import { buildChargedOrbVolleyForSlot, getOrbitSlotPosition, syncOrbRuntimeArrays } from '../entities/defenseRuntime.js';
import { pushSimOutputBullet } from './simProjectiles.js';

const GLOBAL_SPEED_LIFT = 1.55;
const ORBIT_ROTATION_SPD = 0.003;
const ORBITAL_FOCUS_CHARGED_ORB_DAMAGE_MULT = 1.6;
const ORBITAL_FOCUS_CHARGED_ORB_INTERVAL_MULT = 0.65;
const ORB_TWIN_TOTAL_DAMAGE_MULT = 1.6;
const ORB_OVERCHARGE_DAMAGE_MULT = 1.1;

function resolveChargedOrbFires(state, slot0Input, opts = {}) {
  const slot = state?.slots?.[0];
  const enemies = state?.enemies;
  if (!slot?.body || !slot?.metrics || !slot?.upg || !Array.isArray(enemies) || enemies.length === 0) return 0;

  const roomPhase = state?.run?.roomPhase || 'intro';
  if (!(roomPhase === 'spawning' || roomPhase === 'fighting')) return 0;

  const upg = slot.upg;
  if (!upg.chargedOrbs || (upg.orbitSphereTier | 0) <= 0) return 0;
  if ((slot.body.coopSpectating || false) || (slot.body.alive === false)) return 0;

  const orbFireTimers = syncFireTimers(slot);
  const orbCooldowns = syncCooldowns(slot);
  const isStill = deriveStillness(slot0Input, opts);
  const reservedForPlayer = isStill ? Math.max(1, getRequiredShotCount(upg)) : 0;
  let charge = slot.metrics.charge || 0;
  let fired = 0;

  syncOrbRuntimeArrays(orbFireTimers, orbCooldowns, upg.orbitSphereTier);
  for (let si = 0; si < upg.orbitSphereTier; si++) {
    const chargeRatio = getChargeRatio(slot, charge);
    const orbFireInterval = CHARGED_ORB_FIRE_INTERVAL_MS * (upg.orbitalFocus ? ORBITAL_FOCUS_CHARGED_ORB_INTERVAL_MULT : 1);
    const orbDamageBonus = (1 + 0.25 * (upg.orbDamageTier || 0)) * (1 + 0.10 * Math.max(0, (upg.orbitSphereTier | 0) - 1));
    const orbVolley = buildChargedOrbVolleyForSlot({
      slotIndex: si,
      timerMs: orbFireTimers[si] || 0,
      dtMs: (opts.dt != null ? opts.dt : 1 / 60) * 1000,
      fireIntervalMs: orbFireInterval,
      orbCooldown: orbCooldowns,
      orbitSphereTier: upg.orbitSphereTier,
      ts: Number.isFinite(state.timeMs) ? state.timeMs : 0,
      rotationSpeed: opts.orbitRotationSpeed ?? ORBIT_ROTATION_SPD,
      radius: getOrbitRadius(upg, opts),
      originX: slot.body.x || 0,
      originY: slot.body.y || 0,
      enemies,
      getOrbitSlotPosition,
      orbTwin: !!upg.orbTwin,
      orbitalFocus: !!upg.orbitalFocus,
      orbOvercharge: !!upg.orbOvercharge,
      orbPierce: !!upg.orbPierce,
      charge,
      reservedForPlayer,
      chargeRatio,
      twinDamageMult: ORB_TWIN_TOTAL_DAMAGE_MULT,
      focusDamageMult: ORBITAL_FOCUS_CHARGED_ORB_DAMAGE_MULT,
      focusChargeScale: 0.8,
      overchargeDamageMult: ORB_OVERCHARGE_DAMAGE_MULT,
      shotSpeed: 220 * GLOBAL_SPEED_LIFT,
      now: Number.isFinite(state.timeMs) ? state.timeMs : 0,
      bloodPactHealCap: getBloodPactHealCap(upg),
      orbDamageBonus,
    });
    orbFireTimers[si] = orbVolley.nextTimerMs;
    if (!orbVolley.fired) continue;
    for (const shotSpec of orbVolley.shotSpecs) {
      pushSimOutputBullet(state, {
        ...shotSpec,
        ownerId: slot.index ?? 0,
      });
      fired++;
    }
    charge = Math.max(0, charge - orbVolley.chargeSpent);
    slot.metrics.charge = charge;
  }

  return fired;
}

function deriveStillness(slot0Input, opts) {
  if (typeof opts.isStill === 'boolean') return opts.isStill;
  const joy = slot0Input && slot0Input.joy;
  if (!joy) return true;
  const deadzone = opts.deadzone != null ? opts.deadzone : 0.15;
  return !joy.active || (joy.mag || 0) <= deadzone;
}

function getChargeRatio(slot, chargeValue = null) {
  const metrics = slot?.metrics || {};
  const maxCharge = Math.max(1, metrics.maxCharge || slot?.upg?.maxCharge || 1);
  const current = chargeValue == null ? (metrics.charge || 0) : chargeValue;
  return Math.max(0, Math.min(1, current / maxCharge));
}

function getOrbitRadius(upg, opts) {
  const base = Number.isFinite(opts.orbitSphereRadius) ? opts.orbitSphereRadius : 40;
  return base + (upg.orbitRadiusBonus || 0);
}

function getBloodPactHealCap(upg) {
  return 1 + (upg?.bloodMoon ? 1 : 0);
}

function syncFireTimers(slot) {
  if (!slot.orbState) slot.orbState = {};
  if (!Array.isArray(slot.orbState.fireTimers)) slot.orbState.fireTimers = [];
  return slot.orbState.fireTimers;
}

function syncCooldowns(slot) {
  if (!slot.orbState) slot.orbState = {};
  if (!Array.isArray(slot.orbState.cooldowns)) slot.orbState.cooldowns = [];
  return slot.orbState.cooldowns;
}

export {
  resolveChargedOrbFires,
};
