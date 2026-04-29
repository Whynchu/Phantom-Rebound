// R0.4 step 7 — Region D (volatile orbs) carve-out.
//
// Pure detector that decides whether a danger bullet collides with one of
// the player's orbital volatile-orb slots. Replaces the inline collision
// loop at script.js:6144-6170.
//
// The dispatcher is gated by the caller (UPG.volatileOrbs &&
// UPG.orbitSphereTier > 0 && slot0Timers.volatileOrbGlobalCooldown <= 0
// && bullet.state === 'danger'). When called, it iterates the active
// orb slots, picks the FIRST one in cooldown=0 state whose position
// contains the bullet, and returns:
//
//   {
//     hitIndex: -1 | int,        // orbit slot that fired (-1 = miss)
//     sx, sy: number,            // slot position (caller may want to reuse)
//     effects: [{kind:'sparks', x, y, color, count, size}],
//     removeSourceBullet: bool,
//     skipRestOfFrame: bool,
//     orbCooldownValue: number,  // value caller writes to orbCooldowns[hitIndex]
//     globalCooldownValue: number, // value caller writes to slot0Timers.volatileOrbGlobalCooldown
//   }
//
// Why orb-cooldown writes are returned as data (not done inline): keeps the
// dispatcher pure (no array mutation), so it round-trips cleanly through
// rollback resim. Caller owns the mutation. Same shape as Region B's
// dispatchBulletBounce — effect descriptors + caller-applied state writes.

import { getOrbitSlotPosition } from '../entities/defenseRuntime.js';

/**
 * @param {object} bullet - bullet with x, y, r
 * @param {object} ctx
 * @param {Array<number>} ctx.orbCooldowns - per-slot cooldown values (read-only here)
 * @param {number} ctx.orbitSphereTier - number of orb slots
 * @param {number} ctx.ts - current sim time (ms)
 * @param {number} ctx.rotationSpeed - radians/ms
 * @param {number} ctx.radius - orbit radius
 * @param {number} ctx.originX - player x
 * @param {number} ctx.originY - player y
 * @param {number} ctx.orbHitRadius - per-orb collision radius
 * @param {string} ctx.sparksColor
 * @param {number} ctx.sparksCount
 * @param {number} ctx.sparksSize
 * @param {number} ctx.orbCooldownValue
 * @param {number} ctx.globalCooldownValue
 */
export function detectVolatileOrbHit(bullet, ctx) {
  const tier = ctx.orbitSphereTier | 0;
  const cooldowns = ctx.orbCooldowns || [];
  for (let si = 0; si < tier; si++) {
    if (cooldowns[si] > 0) continue;
    const slot = getOrbitSlotPosition({
      index: si,
      orbitSphereTier: tier,
      ts: ctx.ts,
      rotationSpeed: ctx.rotationSpeed,
      radius: ctx.radius,
      originX: ctx.originX,
      originY: ctx.originY,
    });
    const dx = bullet.x - slot.x;
    const dy = bullet.y - slot.y;
    if (Math.hypot(dx, dy) < (bullet.r || 0) + (ctx.orbHitRadius || 0)) {
      return {
        hitIndex: si,
        sx: slot.x,
        sy: slot.y,
        effects: [{
          kind: 'sparks',
          x: slot.x,
          y: slot.y,
          color: ctx.sparksColor,
          count: ctx.sparksCount,
          size: ctx.sparksSize,
        }],
        removeSourceBullet: true,
        skipRestOfFrame: true,
        orbCooldownValue: ctx.orbCooldownValue,
        globalCooldownValue: ctx.globalCooldownValue,
      };
    }
  }
  return {
    hitIndex: -1,
    sx: 0,
    sy: 0,
    effects: [],
    removeSourceBullet: false,
    skipRestOfFrame: false,
    orbCooldownValue: 0,
    globalCooldownValue: 0,
  };
}

export default detectVolatileOrbHit;
