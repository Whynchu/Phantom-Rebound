// R3 parity — grey bullet decay and absorb/pickup during rollback resim.

import { DECAY_BASE } from '../data/gameData.js';
import { tickGreyBulletDecay } from '../systems/bulletRuntime.js';
import { detectGreyAbsorb } from './greyAbsorbDispatch.js';
import { emit } from './effectQueue.js';
import { pushSimOutputBullet } from './simProjectiles.js';

const ORBIT_ROTATION_SPD = 0.003;
const ORBIT_SPHERE_R = 40;
const GLOBAL_SPEED_LIFT = 1.55;
const GHOST_COLOR = '#e0e7ff';

function resolveGreyAbsorbs(state, dt, opts = {}) {
  const bullets = state?.bullets;
  const slots = state?.slots;
  if (!Array.isArray(bullets) || !Array.isArray(slots) || bullets.length === 0) return 0;

  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;
  let absorbed = 0;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (!bullet || bullet.state !== 'grey') continue;

    const ownerUpg = slots[0]?.upg || {};
    const greyTick = tickGreyBulletDecay(bullet, ts, dt, {
      decayMS: opts.greyDecayMs ?? (DECAY_BASE + (ownerUpg.decayBonus || 0)),
    });
    if (greyTick.expired) {
      bullets.splice(i, 1);
      continue;
    }

    const result = detectGreyAbsorb(bullet, {
      player: slots[0]?.body || {},
      absorbR: getSlot0AbsorbRadius(slots[0]),
      slot0Timers: slots[0]?.timers || {},
      UPG: ownerUpg,
      simNowMs: ts,
      playerSlots: slots,
      simTick: state.tick || 0,
      lagComp: null,
      ts,
      ORBIT_ROTATION_SPD: opts.orbitRotationSpeed ?? ORBIT_ROTATION_SPD,
      orbitRadius: getOrbitRadius(ownerUpg, opts),
      orbVisualRadius: getOrbVisualRadius(ownerUpg),
      orbCooldowns: syncOrbCooldowns(slots[0]),
      GLOBAL_SPEED_LIFT: opts.globalSpeedLift ?? GLOBAL_SPEED_LIFT,
      ghostColor: opts.ghostColor || GHOST_COLOR,
    });

    if (!result) continue;
    absorbed++;
    applyGreyAbsorbResult(state, result, opts);
    bullets.splice(i, 1);
  }

  return absorbed;
}

function applyGreyAbsorbResult(state, result, opts) {
  emitGreyEffects(state, result, opts);
  if (result.kind === 'slot0') {
    const slot = state.slots?.[0];
    const payload = result.slot0 || {};
    gainSlotCharge(slot, payload.absorbGain, state, opts, 'greyAbsorb');
    if (payload.resonantIncrement && slot?.timers) {
      slot.timers.absorbComboTimer = 1500;
      slot.timers.absorbComboCount = (slot.timers.absorbComboCount || 0) + 1;
      if (payload.resonantBonusGain > 0) {
        gainSlotCharge(slot, payload.resonantBonusGain, state, opts, 'resonantAbsorb');
        slot.timers.absorbComboCount = 0;
      }
    }
    if (slot?.upg && payload.refractionSpec) {
      pushSimOutputBullet(state, payload.refractionSpec);
      slot.upg.refractionCount = payload.newRefractionCount;
      if (payload.refractionCooldownReset) {
        slot.upg.refractionCooldown = 900;
        slot.upg.refractionCount = 0;
      }
    }
    if (payload.chainMagnetDuration > 0 && slot?.timers) {
      slot.timers.chainMagnetTimer = Math.max(slot.timers.chainMagnetTimer || 0, payload.chainMagnetDuration);
    }
    return;
  }

  if (result.kind === 'guest') {
    const guest = result.guest || {};
    const slot = state.slots?.[guest.slotIdx];
    if (slot?.metrics) {
      const before = slot.metrics.charge || 0;
      slot.metrics.charge = guest.newCharge;
      emitChargeGain(state, opts, guest.slotIdx, slot.metrics.charge - before, 'greyAbsorb');
    }
    return;
  }

  if (result.kind === 'orb') {
    const slot = state.slots?.[0];
    gainSlotCharge(slot, result.orb?.absorbGain, state, opts, 'orbAbsorb');
  }
}

function getSlot0AbsorbRadius(slot) {
  const body = slot?.body || {};
  const upg = slot?.upg || {};
  const timers = slot?.timers || {};
  return (body.r || 14) + 5
    + (upg.absorbRange || 0)
    + (timers.barrierPulseTimer > 0 ? (upg.absorbRange || 0) + 40 : 0)
    + (timers.chainMagnetTimer > 0 ? (upg.absorbRange || 0) + 30 : 0);
}

function syncOrbCooldowns(slot) {
  if (!slot?.orbState) return [];
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

function gainSlotCharge(slot, amount, state, opts, source) {
  if (!slot?.metrics) return 0;
  const maxCharge = Math.max(1, slot.metrics.maxCharge || slot.upg?.maxCharge || 1);
  const before = slot.metrics.charge || 0;
  slot.metrics.charge = Math.min(maxCharge, before + Math.max(0, amount || 0));
  const gained = slot.metrics.charge - before;
  emitChargeGain(state, opts, slot.index ?? state.slots?.indexOf(slot) ?? 0, gained, source);
  return gained;
}

function emitChargeGain(state, opts, slotIndex, amount, source) {
  if (!opts.queueEffects || !Array.isArray(state?.effectQueue) || amount <= 0) return;
  emit(state, 'slot.chargeGain', { slotIndex, amount, source });
}

function emitGreyEffects(state, result, opts) {
  if (!opts.queueEffects || !Array.isArray(state?.effectQueue)) return;
  for (const fx of result.effects || []) {
    const { kind: _helperKind, ...payload } = fx || {};
    emit(state, 'grey.absorbEffect', payload);
  }
}

export {
  resolveGreyAbsorbs,
};
