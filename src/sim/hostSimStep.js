/**
 * R3 Host Sim Step
 * 
 * A deterministic sim step function for rollback-based coop.
 * Encapsulates the core host simulation logic that can be replayed
 * identically on both peers for rollback validation.
 * 
 * Signature: hostSimStep(state, slot0Input, slot1Input, dt)
 * 
 * This is a bridge to script.js's existing update() logic.
 * Once R0.4 carves simStep out of update(), this becomes the
 * canonical deterministic sim.
 */

/**
 * Host simulation step. Called by RollbackCoordinator or directly by game loop.
 * 
 * @param {SimState} state - The live simulation state (mutated in-place)
 * @param {object} slot0Input - { left, right, up, down, shoot, ... } for slot 0 (world/host)
 * @param {object} slot1Input - { left, right, up, down, shoot, ... } for slot 1 (remote/guest)
 * @param {number} dt - Timestep in seconds
 * 
 * Mutates state in-place:
 * - state.slots[0/1].body.x/y/vx/vy (position/velocity)
 * - state.slots[0/1].metrics.hp/charge/fireT (game metrics)
 * - state.bullets array (projectiles)
 * - state.enemies array (enemies)
 * - state.run.{roomIndex, score, kills} (progression/scoring)
 * - Queues effects to state.effectQueue for later consumption by render
 */
export function hostSimStep(state, slot0Input, slot1Input, dt) {
  // Placeholder: This function will be populated during R0.4 refactor
  // when simStep is carved out of update().
  //
  // For now, this is a no-op. The actual host sim runs inline in
  // script.js's update() function.
  //
  // During R3.1 integration, we'll:
  // 1. Extract the host's update() logic into this function
  // 2. Wire it through RollbackCoordinator
  // 3. Validate determinism with existing canary tests
  //
  // The wrapped version will:
  // - Take input objects (left/right/up/down/shoot/aimX/aimY/etc)
  // - Call simRng.next() for deterministic randomness
  // - Mutate state in-place (no snapshots, no copies)
  // - Queue effects to state.effectQueue
  // - Return nothing (void)
}

export default hostSimStep;
