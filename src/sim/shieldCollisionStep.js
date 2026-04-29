// R3 parity — danger bullet vs shield collision during rollback resim.
//
// This applies the already-extracted pure shield detector to SimState slots.
// Visual/telemetry work is emitted as effect descriptors only; gameplay
// mutations (shield cooldowns, reflected shots, barrier pulse) happen here so
// rollback replay matches the live Region E path.

import { detectShieldHit } from './shieldHitDispatch.js';
import { getSlotShields } from './simState.js';
import {
  pushSimOutputBullet,
  spawnSimRadialOutputBurst,
} from './simProjectiles.js';
import { emit } from './effectQueue.js';

const SHIELD_ORBIT_R = 35;
const SHIELD_ROTATION_SPD = 0.001;
const PLAYER_SHOT_LIFE_MS = 1100;
const MIRROR_SHIELD_DAMAGE_FACTOR = 0.60;
const AEGIS_NOVA_DAMAGE_FACTOR = 0.55;
const GLOBAL_SPEED_LIFT = 1.55;

function getShieldCooldown(slot, opts = {}) {
  if (Number.isFinite(opts.shieldCooldown)) return opts.shieldCooldown;
  if (typeof opts.getShieldCooldown === 'function') return opts.getShieldCooldown(slot);
  const upg = slot?.upg || {};
  const base = Number.isFinite(opts.baseShieldCooldown) ? opts.baseShieldCooldown : 7.5;
  const reduction = ((upg.shieldRegenTier || 0) * 2.0);
  return Math.max(1.5, base - reduction);
}

function resolveShieldCollisions(state, opts = {}) {
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
      const shields = getSlotShields(slot);
      if (!body || shields.length <= 0) continue;

      const upg = slot.upg || {};
      const playerView = { ...body, shields };
      const result = detectShieldHit(bullet, {
        player: playerView,
        ts,
        UPG: upg,
        simNowMs: ts,
        shieldOrbitR: opts.shieldOrbitR ?? SHIELD_ORBIT_R,
        shieldRotationSpd: opts.shieldRotationSpd ?? SHIELD_ROTATION_SPD,
        shieldCooldown: getShieldCooldown(slot, opts),
        aegisBatteryDamageMult: opts.aegisBatteryDamageMult ?? 1,
        playerShotLifeMs: opts.playerShotLifeMs ?? PLAYER_SHOT_LIFE_MS,
        mirrorShieldDamageFactor: opts.mirrorShieldDamageFactor ?? MIRROR_SHIELD_DAMAGE_FACTOR,
        aegisNovaDamageFactor: opts.aegisNovaDamageFactor ?? AEGIS_NOVA_DAMAGE_FACTOR,
        globalSpeedLift: opts.globalSpeedLift ?? GLOBAL_SPEED_LIFT,
        shieldActiveColor: opts.shieldActiveColor ?? '#38bdf8',
        shieldEnhancedColor: opts.shieldEnhancedColor ?? '#facc15',
      });

      if (!result) continue;
      applyShieldHitResult(state, slot, result, si, opts);
      bullets.splice(bi, 1);
      hits++;
      break;
    }
  }

  return hits;
}

function applyShieldHitResult(state, slot, result, slotIndex, opts) {
  const shields = getSlotShields(slot);
  const shield = shields[result.hitShieldIdx];
  if (!shield) return;

  if (result.mirrorCooldown !== null && result.mirrorCooldown !== undefined) {
    shield.mirrorCooldown = result.mirrorCooldown;
  }
  if (result.mirrorReflectionSpec) {
    pushSimOutputBullet(state, {
      ...result.mirrorReflectionSpec,
      ownerId: slot.id ?? slotIndex,
    });
  }

  if (result.kind === 'temperedAbsorb') {
    shield.hardened = false;
  } else {
    if (result.shieldBurstSpec) {
      spawnSimRadialOutputBurst(state, {
        ...result.shieldBurstSpec,
        ownerId: slot.id ?? slotIndex,
      });
    }
    if (result.barrierPulseGain > 0) {
      gainSlotCharge(slot, result.barrierPulseGain);
      if (slot.timers) slot.timers.barrierPulseTimer = 800;
    }
    shield.cooldown = result.shieldCooldown;
    shield.maxCooldown = result.shieldCooldown;
    if (result.aegisTitanCdShare) {
      for (let i = 0; i < shields.length; i++) {
        const other = shields[i];
        if (other && other !== shield && (other.cooldown || 0) <= 0) {
          other.cooldown = result.shieldCooldown;
          other.maxCooldown = result.shieldCooldown;
          other.hardened = false;
        }
      }
    }
  }

  emitEffect(state, opts, 'shield.hit', {
    slotIndex,
    shieldIndex: result.hitShieldIdx,
    hitKind: result.kind,
    x: result.sx,
    y: result.sy,
  });
}

function gainSlotCharge(slot, amount) {
  if (!slot?.metrics) return 0;
  const maxCharge = slot.upg?.maxCharge || 1;
  const before = slot.metrics.charge || 0;
  slot.metrics.charge = Math.min(maxCharge, before + Math.max(0, amount || 0));
  return slot.metrics.charge - before;
}

function emitEffect(state, opts, kind, payload) {
  if (!opts.queueEffects || !Array.isArray(state?.effectQueue)) return;
  emit(state, kind, payload);
}

export {
  resolveShieldCollisions,
};
