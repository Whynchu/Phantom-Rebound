/**
 * R2 — Bullet kinematic resim.
 *
 * tickBulletsKinematic(state, dt) is a pure function called from hostSimStep
 * during rollback resim ticks. It advances bullet positions and handles wall
 * bounce + expiry, with NO hit detection, NO side effects, NO audio/sparks.
 *
 * Reads: state.bullets, state.timeMs, state.world, state.worldW, state.worldH
 * Writes: bullet.x, bullet.y, bullet.vx, bullet.vy; splices expired/null entries
 */
import { advanceBulletWithSubsteps } from '../systems/bulletRuntime.js';

/**
 * Advance all bullets by dt seconds.
 * - Removes null/non-object entries
 * - Removes bullets whose expireAt has passed (relative to state.timeMs)
 * - Advances position via advanceBulletWithSubsteps (wall bounce, substeps)
 * No hit detection, no effects, no spawning.
 *
 * @param {object} state  - SimState (mutated in-place)
 * @param {number} dt     - timestep in seconds
 */
export function tickBulletsKinematic(state, dt) {
  const bullets = state.bullets;
  if (!Array.isArray(bullets) || bullets.length === 0) return;

  const stateWorld = state.world || {};
  const W = (stateWorld.w) || state.worldW || 800;
  const H = (stateWorld.h) || state.worldH || 600;
  const M = 16;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    // Remove null / non-object entries
    if (b === null || typeof b !== 'object') {
      bullets.splice(i, 1);
      continue;
    }

    // Expire: remove silently — no blast, no audio
    if (b.expireAt != null && state.timeMs >= b.expireAt) {
      bullets.splice(i, 1);
      continue;
    }

    // Advance position (wall bounce handled inside advanceBulletWithSubsteps)
    advanceBulletWithSubsteps(b, dt, { W, H, M, resolveObstacleCollision: null });
  }
}
