// R0.4 step 10 — Region C (grey absorb) carve-out.
//
// Pure detector for all three grey-bullet absorption sub-paths:
//   PATH 1 — Slot-0 absorb (with GhostFlow, ResonantAbsorb, Refraction,
//             ChainMagnet boon hooks).
//   PATH 2 — Slot-1+ coop guest absorb (current overlap + host lag-comp
//             historic-position forgiveness via ctx.lagComp).
//   PATH 3 — Absorb-Orbs: grey near an alive orbital sphere is absorbed.
//
// Replaces the inline block at script.js:6026-6142.
//
// Called when bullet.state === 'grey' (caller must gate before calling).
// Grey decay (tickGreyBulletDecay) has ALREADY been applied by the caller;
// if the bullet expired the caller already spliced it — we do not handle
// expiry here.
//
// ctx shape:
//   player:          {x,y,r,vx,vy}    — slot-0 body
//   absorbR:         number            — pre-computed slot-0 absorb radius
//   slot0Timers:     object            — READ-ONLY (absorbComboCount, etc.)
//   UPG:             object            — READ-ONLY boon flags + values
//   simNowMs:        number            — for refraction bullet expiry
//   playerSlots:     array             — all slots (slot 1+ for coop guests)
//   simTick:         number            — for lag-comp historic lookup
//   lagComp:         null | {wasNearHistoric(id,tick,bx,by,r):bool}
//     Host-only lag-comp oracle. Null in solo and during rollback resim.
//     When null, all historic-overlap checks return false (conservative).
//     NOTE: This ctx.lagComp is NOT part of simState and is NOT rollback-
//     safe in the strict lockstep sense. For Phantom Rebound's snapshot-
//     reconciliation model this is acceptable: the host sends authoritative
//     state back to guests after reconciliation, so minor divergence in
//     guest charge pickups during resim does not cause persistent desync.
//   ts:              number            — orbit animation timestamp (ms)
//   ORBIT_ROTATION_SPD: number        — orbit angular speed
//   getOrbitSlotPosition: fn          — pure position helper (defenseRuntime.js)
//   orbitRadius:     number           — pre-computed getOrbitRadius() scalar
//   orbVisualRadius: number           — pre-computed getOrbVisualRadius() scalar
//   orbCooldowns:    number[]         — _orbCooldown array (READ-ONLY)
//   GLOBAL_SPEED_LIFT: number
//   ghostColor:      string           — C.ghost color for sparks
//
// Returns null on miss (no absorption). Returns an absorption result on hit:
//
//   {
//     kind: 'slot0' | 'guest' | 'orb',
//     effects: [{kind:'sparks', x, y, color, count, size}],
//     // Per-kind payload:
//     slot0?: {
//       absorbGain:              number,   // caller: gainCharge(absorbGain, 'greyAbsorb')
//       resonantIncrement:       bool,     // caller: absorbComboTimer=1500; absorbComboCount++
//       resonantBonusGain:       number,   // >0: caller gainCharge(this,'resonantAbsorb'); absorbComboCount=0
//       refractionSpec:          null | {x,y,vx,vy,radius,bounceLeft,pierceLeft,homing,crit,dmg,expireAt},
//       newRefractionCount:      number,   // caller: UPG.refractionCount = this
//       refractionCooldownReset: bool,     // true: caller sets UPG.refractionCooldown=900, count=0
//       chainMagnetDuration:     number,   // 0 = no trigger; >0: caller sets chainMagnetTimer=this
//     },
//     guest?: {
//       slotIdx:    number,   // caller: playerSlots[slotIdx].metrics.charge = newCharge
//       newCharge:  number,
//     },
//     orb?: {
//       slotIdx:    number,
//       absorbGain: number,   // caller: gainCharge(this, 'orbAbsorb')
//       sx:         number,   // orb position (for sparks already in effects[])
//       sy:         number,
//     },
//   }

import { getOrbitSlotPosition } from '../entities/defenseRuntime.js';

/**
 * Detect and describe grey-bullet absorption.
 * @param {object} bullet — the grey bullet object (read-only)
 * @param {object} ctx    — caller-provided context (see file header)
 * @returns {null | object} null on miss; absorption result on hit
 */
function detectGreyAbsorb(bullet, ctx) {
  const {
    player, absorbR,
    slot0Timers, UPG, simNowMs,
    playerSlots, simTick, lagComp,
    ts, ORBIT_ROTATION_SPD,
    orbitRadius, orbVisualRadius,
    orbCooldowns, GLOBAL_SPEED_LIFT,
    ghostColor,
  } = ctx;

  const bx = bullet.x;
  const by = bullet.y;
  const br = bullet.r || 6;

  // ─── PATH 1: Slot-0 absorb ───────────────────────────────────────────────
  if (Math.hypot(bx - player.x, by - player.y) < absorbR + br) {
    let absorbGain = UPG.absorbValue || 1;

    // GhostFlow: speed-scaled gain multiplier.
    if (UPG.ghostFlow) {
      const spd = Math.hypot(player.vx || 0, player.vy || 0);
      const titanSlow = UPG.colossus
        ? 1 - (1 - (UPG.titanSlowMult || 1)) * 0.5
        : (UPG.titanSlowMult || 1);
      const maxSpd = 165 * Math.min(2.5, (UPG.speedMult || 1) * titanSlow * (UPG.extraLifeSlowMult || 1));
      const frac = Math.min(1, spd / Math.max(1, maxSpd));
      absorbGain *= 0.5 + frac * 1.1;
    }

    const effects = [{ kind: 'sparks', x: bx, y: by, color: ghostColor, count: 5, size: 45 }];

    // ResonantAbsorb: combo streak.
    let resonantIncrement = false;
    let resonantBonusGain = 0;
    if (UPG.resonantAbsorb) {
      resonantIncrement = true;
      const nextCount = (slot0Timers.absorbComboCount || 0) + 1;
      if (nextCount >= 3) {
        resonantBonusGain = (UPG.absorbValue || 1) * (UPG.surgeHarvest ? 1.0 : 0.5);
      }
    }

    // Refraction: fire a weak homing shot.
    let refractionSpec = null;
    let newRefractionCount = UPG.refractionCount || 0;
    let refractionCooldownReset = false;
    if (UPG.refraction && (UPG.refractionCooldown || 0) <= 0) {
      // Clamp entering count to [0,3] so bad persisted state can't deadlock.
      const entryCount = Math.max(0, Math.min(3, newRefractionCount));
      const bumped = entryCount + 1;
      newRefractionCount = bumped;
      if (bumped <= 4) {
        const angle = Math.atan2(player.y - by, player.x - bx);
        refractionSpec = {
          x: bx, y: by,
          vx: Math.cos(angle) * 140 * GLOBAL_SPEED_LIFT,
          vy: Math.sin(angle) * 140 * GLOBAL_SPEED_LIFT,
          radius: 3.2,
          bounceLeft: 0, pierceLeft: 0,
          homing: true, crit: false,
          dmg: 0.75,
          expireAt: simNowMs + 1600,
        };
        if (bumped >= 4) {
          refractionCooldownReset = true;
          newRefractionCount = 0;
        }
      }
    }

    // ChainMagnet: extend chain magnet window.
    const chainMagnetDuration = (UPG.chainMagnetTier || 0) > 0
      ? 700 + (UPG.chainMagnetTier - 1) * 350
      : 0;

    return {
      kind: 'slot0',
      effects,
      slot0: {
        absorbGain,
        resonantIncrement,
        resonantBonusGain,
        refractionSpec,
        newRefractionCount,
        refractionCooldownReset,
        chainMagnetDuration,
      },
    };
  }

  // ─── PATH 2: Slot-1+ coop guest absorb ──────────────────────────────────
  if (playerSlots && playerSlots.length > 1) {
    for (let si = 1; si < playerSlots.length; si++) {
      const gs = playerSlots[si];
      const gb = gs && gs.body;
      if (!gb) continue;
      if (((gs.metrics && gs.metrics.hp) || 0) <= 0) continue;
      if ((gb.deadAt || 0) > 0) continue;

      const gAbsR = (gb.r || 14) + 5 + ((gs.upg && gs.upg.absorbRange) || 0);
      const overlapNow = Math.hypot(bx - gb.x, by - gb.y) < gAbsR + br;
      const overlapHistoric = !overlapNow && lagComp
        ? lagComp.wasNearHistoric(bullet.id, simTick, gb.x, gb.y, gAbsR)
        : false;

      if (overlapNow || overlapHistoric) {
        const maxCharge = (gs.upg && gs.upg.maxCharge) || 1;
        const gain = (gs.upg && gs.upg.absorbValue) || 1;
        const newCharge = Math.min(maxCharge, ((gs.metrics && gs.metrics.charge) || 0) + gain);

        return {
          kind: 'guest',
          effects: [{ kind: 'sparks', x: bx, y: by, color: ghostColor, count: 5, size: 45 }],
          guest: { slotIdx: si, newCharge },
        };
      }
    }
  }

  // ─── PATH 3: Absorb-Orbs ─────────────────────────────────────────────────
  if (UPG.absorbOrbs && (UPG.orbitSphereTier || 0) > 0) {
    const orbAbsorbR = (orbVisualRadius || 12) + 7;
    for (let si = 0; si < UPG.orbitSphereTier; si++) {
      if ((orbCooldowns[si] || 0) > 0) continue;
      const orbitSlot = getOrbitSlotPosition({
        index: si,
        orbitSphereTier: UPG.orbitSphereTier,
        ts,
        rotationSpeed: ORBIT_ROTATION_SPD,
        radius: orbitRadius,
        originX: player.x,
        originY: player.y,
      });
      const sx = orbitSlot.x;
      const sy = orbitSlot.y;
      if (Math.hypot(bx - sx, by - sy) < br + orbAbsorbR) {
        return {
          kind: 'orb',
          effects: [{ kind: 'sparks', x: sx, y: sy, color: ghostColor, count: 4, size: 40 }],
          orb: {
            slotIdx: si,
            absorbGain: UPG.absorbValue || 1,
            sx, sy,
          },
        };
      }
    }
  }

  return null;
}

export { detectGreyAbsorb };
