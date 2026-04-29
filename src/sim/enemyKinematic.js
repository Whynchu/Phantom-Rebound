/**
 * R2 — Enemy kinematic resim.
 *
 * tickEnemiesKinematic(state, dt) is a pure function called from hostSimStep
 * during rollback resim ticks. It moves each live enemy toward the nearest
 * slot body by e.spd * dt. NO firing, NO contact damage, NO AI state changes.
 *
 * Reads: state.enemies, state.slots, state.world, state.worldW, state.worldH
 * Writes: enemy.x, enemy.y
 */

const M = 16;

/**
 * Move all live enemies toward the nearest slot body.
 * Skips dead enemies. Does not remove enemies.
 * Clamps to world bounds after movement.
 *
 * @param {object} state  - SimState (mutated in-place)
 * @param {number} dt     - timestep in seconds
 */
export function tickEnemiesKinematic(state, dt) {
  const enemies = state.enemies;
  if (!Array.isArray(enemies) || enemies.length === 0) return;

  const slots = state.slots;
  if (!Array.isArray(slots) || slots.length === 0) return;

  const stateWorld = state.world || {};
  const W = (stateWorld.w) || state.worldW || 800;
  const H = (stateWorld.h) || state.worldH || 600;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e) continue;

    // Skip dead enemies
    if (e.dead || e.alive === false) continue;

    // Find nearest slot body
    let target = null;
    let bestDist = Infinity;
    for (let s = 0; s < slots.length; s++) {
      const slot = slots[s];
      if (!slot || !slot.body) continue;
      const bx = slot.body.x;
      const by = slot.body.y;
      if (typeof bx !== 'number' || typeof by !== 'number') continue;
      const d = Math.hypot(bx - e.x, by - e.y);
      if (d < bestDist) {
        bestDist = d;
        target = slot.body;
      }
    }

    if (!target) continue;

    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.5) {
      const spd = e.spd || 0;
      e.x += (dx / dist) * spd * dt;
      e.y += (dy / dist) * spd * dt;
    }

    // Clamp to world bounds
    const r = e.r || 0;
    e.x = Math.max(M + r, Math.min(W - M - r, e.x));
    e.y = Math.max(M + r, Math.min(H - M - r, e.y));
  }
}
