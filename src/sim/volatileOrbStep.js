// R3 parity — Volatile Orbs during rollback resim.
//
// Danger bullets that touch an active orbit sphere are removed and the orb
// enters cooldown. This mirrors the live Region D path using SimState-owned
// slot.orbState.cooldowns and slot.timers. Cosmetic effects are descriptors.

import { detectVolatileOrbHit } from './volatileOrbDispatch.js';
import { emit } from './effectQueue.js';

const ORBIT_ROTATION_SPD = 0.003;
const ORBIT_SPHERE_R = 32;
const VOLATILE_ORB_COOLDOWN = 8;
const VOLATILE_ORB_SHARED_COOLDOWN = 1.0;

function resolveVolatileOrbHits(state, opts = {}) {
  const bullets = state?.bullets;
  const slots = state?.slots;
  if (!Array.isArray(bullets) || !Array.isArray(slots) || bullets.length === 0) return 0;

  const ts = Number.isFinite(state.timeMs) ? state.timeMs : 0;
  let hits = 0;

  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const bullet = bullets[bi];
    if (!bullet || bullet.state !== 'danger') continue;

    for (let si = 0; si < slots.length; si++) {
      const slot = slots[si];
      const body = slot?.body;
      const upg = slot?.upg || {};
      const timers = slot?.timers || {};
      const cooldowns = slot?.orbState?.cooldowns;
      const tier = upg.orbitSphereTier | 0;
      if (!body || !Array.isArray(cooldowns)) continue;
      if (!upg.volatileOrbs || tier <= 0 || (timers.volatileOrbGlobalCooldown || 0) > 0) continue;
      syncOrbCooldowns(cooldowns, tier);

      const result = detectVolatileOrbHit(bullet, {
        orbCooldowns: cooldowns,
        orbitSphereTier: tier,
        ts,
        rotationSpeed: opts.orbitRotationSpeed ?? ORBIT_ROTATION_SPD,
        radius: getOrbitRadius(upg, opts),
        originX: body.x,
        originY: body.y,
        orbHitRadius: getOrbVisualRadius(upg, opts) + 2,
        sparksColor: opts.orbSparksColor ?? '#22c55e',
        sparksCount: 10,
        sparksSize: 80,
        orbCooldownValue: opts.volatileOrbCooldown ?? VOLATILE_ORB_COOLDOWN,
        globalCooldownValue: opts.volatileOrbSharedCooldown ?? VOLATILE_ORB_SHARED_COOLDOWN,
      });

      if (result.hitIndex < 0) continue;
      cooldowns[result.hitIndex] = result.orbCooldownValue;
      timers.volatileOrbGlobalCooldown = result.globalCooldownValue;
      if (result.removeSourceBullet) bullets.splice(bi, 1);
      hits++;
      emitEffect(state, opts, 'volatileOrb.hit', {
        slotIndex: si,
        orbIndex: result.hitIndex,
        x: result.sx,
        y: result.sy,
      });
      break;
    }
  }

  return hits;
}

function syncOrbCooldowns(cooldowns, tier) {
  while (cooldowns.length < tier) cooldowns.push(0);
  if (cooldowns.length > tier) cooldowns.length = tier;
}

function getOrbitRadius(upg, opts) {
  const base = Number.isFinite(opts.orbitSphereRadius) ? opts.orbitSphereRadius : ORBIT_SPHERE_R;
  return base + (upg.orbitRadiusBonus || 0);
}

function getOrbVisualRadius(upg, opts) {
  const base = Number.isFinite(opts.orbVisualRadiusBase) ? opts.orbVisualRadiusBase : 5;
  return base * (upg.orbSizeMult || 1);
}

function emitEffect(state, opts, kind, payload) {
  if (!opts.queueEffects || !Array.isArray(state?.effectQueue)) return;
  emit(state, kind, payload);
}

export {
  resolveVolatileOrbHits,
};

