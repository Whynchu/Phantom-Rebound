// R0.4 step 11 — Region E (shield collision) carve-out.
//
// Pure detector for danger-bullet vs player-shield collisions. Replaces
// the inline block at script.js:6126-6208.
//
// Called only when b.state === 'danger' && player.shields.length > 0.
// Caller must also do the cheap proximity guard before calling if desired
// (Math.hypot(b.x-player.x,b.y-player.y) < SHIELD_ORBIT_R+8+b.r).
//
// ctx shape:
//   player:           {x,y,shields:[{cooldown,maxCooldown,hardened,mirrorCooldown?},...]}
//   ts:               number    — animation timestamp (ms)
//   UPG:              object    — READ-ONLY boon flags + values
//   simNowMs:         number    — for mirror reflection expiry
//   shieldOrbitR:     number    — orbital radius of shields (SHIELD_ORBIT_R)
//   shieldRotationSpd:number    — angular speed (SHIELD_ROTATION_SPD rad/ms)
//   shieldCooldown:   number    — pre-computed getShieldCooldown() scalar
//   aegisBatteryDamageMult: number — pre-computed getAegisBatteryDamageMult()
//   playerShotLifeMs: number    — PLAYER_SHOT_LIFE_MS
//   mirrorShieldDamageFactor: number — MIRROR_SHIELD_DAMAGE_FACTOR
//   aegisNovaDamageFactor: number    — AEGIS_NOVA_DAMAGE_FACTOR
//   globalSpeedLift:  number    — GLOBAL_SPEED_LIFT
//   shieldActiveColor:  string  — C.shieldActive
//   shieldEnhancedColor:string  — C.shieldEnhanced
//
// Returns null on miss. Returns a hit descriptor on hit:
//
//   {
//     hitShieldIdx: number,      // index into player.shields
//     sx: number, sy: number,    // shield plate centre position
//     shieldBlockOccurred: true, // caller: telemetry.shieldBlocks++ (commit-phase ONLY)
//     effects: [{kind:'sparks', x, y, color, count, size}],
//     kind: 'temperedAbsorb' | 'pop',
//     //
//     // kind === 'temperedAbsorb' (s.hardened was true — first hit of a tempered shield):
//     //   caller writes: shields[hitShieldIdx].hardened = false
//     //   (no cooldown, no burst, no barrier pulse — shield remains active)
//     //
//     // kind === 'pop' (shield is destroyed this hit):
//     mirrorCooldown: null | number,      // if ≠null: shields[hitShieldIdx].mirrorCooldown = this
//     mirrorReflectionSpec: null | object,// if ≠null: pushOutputBullet(...spec)
//     shieldBurstSpec: null | object,     // if ≠null: spawnRadialOutputBurst(...spec)
//     barrierPulseGain: number,           // 0 or 2; >0: gainCharge+barrierPulseTimer=800
//     shieldCooldown: number,             // shields[hitShieldIdx].cooldown = .maxCooldown = this
//     aegisTitanCdShare: bool,            // all other ready shields also get shieldCooldown
//   }
//
// Telemetry rule: shieldBlockOccurred must only trigger the counter in the
// commit phase (not during rollback resim). Caller gates with an isResim
// flag or calls telemetry only from the live-tick path. The dispatcher
// itself does not touch telemetry.

import { SHIELD_HALF_W, SHIELD_HALF_H } from '../data/constants.js';
import {
  getShieldSlotPosition,
  buildMirrorShieldReflectionSpec,
  buildShieldBurstSpec,
} from '../entities/defenseRuntime.js';

/**
 * Detect and describe a danger bullet hitting a player shield plate.
 * @param {object} bullet  — danger bullet (read-only)
 * @param {object} ctx     — caller context (see file header)
 * @returns {null | object} null on miss; hit descriptor on hit
 */
function detectShieldHit(bullet, ctx) {
  const {
    player, ts, UPG, simNowMs,
    shieldOrbitR, shieldRotationSpd, shieldCooldown,
    aegisBatteryDamageMult, playerShotLifeMs,
    mirrorShieldDamageFactor, aegisNovaDamageFactor,
    globalSpeedLift,
    shieldActiveColor, shieldEnhancedColor,
  } = ctx;

  const shields = player.shields;
  const total = shields.length;
  const bx = bullet.x;
  const by = bullet.y;
  const br = bullet.r || 6;

  // Quick proximity guard — caller may pre-filter but we re-check for purity.
  if (Math.hypot(bx - player.x, by - player.y) >= shieldOrbitR + 8 + br) {
    return null;
  }

  for (let si = 0; si < total; si++) {
    const s = shields[si];
    if ((s.cooldown || 0) > 0) continue;

    const shieldSlot = getShieldSlotPosition({
      index: si,
      shieldCount: total,
      ts,
      rotationSpeed: shieldRotationSpd,
      radius: shieldOrbitR,
      originX: player.x,
      originY: player.y,
    });
    const sx = shieldSlot.x;
    const sy = shieldSlot.y;
    const facing = shieldSlot.facing;

    if (!_circleIntersectsShieldPlate(bx, by, br, sx, sy, facing)) continue;

    // ── Hit confirmed ──────────────────────────────────────────────────────
    //
    // Order matches inline block exactly:
    //   1. Mirror check (may fire even on a tempered-absorb first hit)
    //   2. Tempered check (early return — no pop, no cooldown, no burst)
    //   3. Shield Burst
    //   4. Barrier Pulse
    //   5. Cooldown + AegisTitan

    // Mirror Shield: reflect bullet as output (fires before tempered check).
    let mirrorCooldown = null;
    let mirrorReflectionSpec = null;
    if (UPG.shieldMirror && (ts - (s.mirrorCooldown || 0)) > 300) {
      mirrorCooldown = ts;
      mirrorReflectionSpec = buildMirrorShieldReflectionSpec({
        x: sx, y: sy,
        vx: bullet.vx, vy: bullet.vy,
        shotSize: UPG.shotSize || 1,
        playerDamageMult: UPG.playerDamageMult || 1,
        denseDamageMult: UPG.denseDamageMult || 1,
        aegisTitan: !!UPG.aegisTitan,
        mirrorShieldDamageFactor,
        aegisBatteryDamageMult,
        now: simNowMs,
        playerShotLifeMs,
        shotLifeMult: UPG.shotLifeMult || 1,
      });
    }

    // Tempered Shield: first hit softens shield (hardened → not-hardened).
    // Note: mirror may have already fired above — its spec is still returned.
    // No cooldown, no pop, no burst, no barrier pulse — shield stays active.
    if (UPG.shieldTempered && s.hardened) {
      return {
        hitShieldIdx: si,
        sx, sy,
        shieldBlockOccurred: true,
        effects: [{ kind: 'sparks', x: sx, y: sy, color: shieldEnhancedColor, count: 8, size: 60 }],
        kind: 'temperedAbsorb',
        mirrorCooldown,
        mirrorReflectionSpec,
      };
    }

    // Shield Burst: 4/8-way output radial burst.
    let shieldBurstSpec = null;
    if (UPG.shieldBurst) {
      shieldBurstSpec = buildShieldBurstSpec({
        x: player.x, y: player.y,
        aegisTitan: !!UPG.aegisTitan,
        globalSpeedLift,
        shotSize: UPG.shotSize || 1,
        playerDamageMult: UPG.playerDamageMult || 1,
        denseDamageMult: UPG.denseDamageMult || 1,
        aegisNovaDamageFactor,
        aegisBatteryDamageMult,
        now: simNowMs,
        playerShotLifeMs,
        shotLifeMult: UPG.shotLifeMult || 1,
      });
    }

    // Barrier Pulse: +2 charge + magnet window.
    const barrierPulseGain = UPG.barrierPulse ? 2 : 0;

    return {
      hitShieldIdx: si,
      sx, sy,
      shieldBlockOccurred: true,
      effects: [{ kind: 'sparks', x: sx, y: sy, color: shieldActiveColor, count: 8, size: 60 }],
      kind: 'pop',
      mirrorCooldown,
      mirrorReflectionSpec,
      shieldBurstSpec,
      barrierPulseGain,
      shieldCooldown,
      aegisTitanCdShare: !!UPG.aegisTitan,
    };
  }

  return null;
}

/** Axis-aligned rectangle vs circle test in the shield's local frame. */
function _circleIntersectsShieldPlate(cx, cy, radius, sx, sy, angle) {
  const dx = cx - sx;
  const dy = cy - sy;
  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);
  const lx = dx * cosA - dy * sinA;
  const ly = dx * sinA + dy * cosA;
  const nearestX = Math.max(-SHIELD_HALF_W, Math.min(SHIELD_HALF_W, lx));
  const nearestY = Math.max(-SHIELD_HALF_H, Math.min(SHIELD_HALF_H, ly));
  const hitDx = lx - nearestX;
  const hitDy = ly - nearestY;
  return hitDx * hitDx + hitDy * hitDy < radius * radius;
}

export { detectShieldHit };
