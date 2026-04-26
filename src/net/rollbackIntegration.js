/**
 * R3 Rollback Integration Layer
 * 
 * Manages RollbackCoordinator instances for coop sessions.
 * Bridges between the game loop (script.js) and the rollback netcode.
 * 
 * Design:
 * - One coordinator per coop session (once per host+guest pair)
 * - Lazy initialization: created when coopSession starts
 * - Parallel to D-series: both paths can run until R3.3 cleanup
 * - Guards: only active in coop runs with rollback explicitly enabled
 * 
 * CURRENT PHASE (R3.1):
 * - Input path wired: coordinator.step() called from game loop
 * - Remote input received and buffered
 * - Rollback logic: placeholder until R0.4 carves simStep out of script.js
 * 
 * NEXT PHASE (after R0.4):
 * - Plug in real simStep(state, s0input, s1input, dt)
 * - Rollback+resim becomes live
 * - Full byte-identical determinism on both peers
 */

import { RollbackCoordinator } from './rollbackCoordinator.js';

/**
 * Global coordinator instance for the current coop session.
 * Null when: solo mode, D-series legacy mode, or between sessions.
 */
export let rollbackCoordinator = null;

/**
 * Initialize rollback coordinator for a coop session.
 * Called from coopSession when both peers are ready and rollback is enabled.
 * 
 * @param {SimState} simState - The game's live simulation state
 * @param {number} localSlotIndex - 0 for host, 1 for guest
 * @param {function} sendInputFn - Send local input to peer: (frame) => Promise
 * @param {function} registerRemoteInputFn - Register callback for remote input: (cb) => void
 * @param {function} realSimStepFn - The actual deterministic sim step (added after R0.4)
 * @param {boolean} enableLogging - Log rollback events for debugging
 * 
 * @returns {RollbackCoordinator} The new coordinator
 */
export function setupRollback(
  simState,
  localSlotIndex,
  sendInputFn,
  registerRemoteInputFn,
  realSimStepFn = null,
  enableLogging = false
) {
  if (rollbackCoordinator) {
    console.warn('[rollback] setupRollback called while coordinator already exists');
    return rollbackCoordinator;
  }

  // Use provided simStep or placeholder
  const simStepFn = realSimStepFn || nopSimStep;

  rollbackCoordinator = new RollbackCoordinator({
    simState,
    simStep: simStepFn,
    localSlotIndex,
    sendInput: sendInputFn,
    onRemoteInput: registerRemoteInputFn,
    maxRollbackTicks: 8,
    logger: enableLogging ? (msg) => console.log('[rollback]', msg) : null,
  });

  console.log(
    `[rollback] Coordinator initialized: slot ${localSlotIndex}, ` +
    `simStep=${realSimStepFn ? 'real' : 'placeholder'}, maxRollback=8 ticks`
  );
  return rollbackCoordinator;
}

/**
 * Update the coordinator's simStep after it's been initialized.
 * Useful for injecting the real simStep once R0.4 carves it out.
 */
export function setSimStep(simStepFn) {
  if (!rollbackCoordinator) {
    console.warn('[rollback] setSimStep called without active coordinator');
    return;
  }
  rollbackCoordinator.simStep = simStepFn;
  console.log('[rollback] simStep updated');
}

/**
 * Teardown rollback coordinator (e.g., when session ends or switches to solo).
 */
export function teardownRollback() {
  if (rollbackCoordinator) {
    try { rollbackCoordinator.dispose?.(); } catch (err) {
      console.warn('[rollback] dispose failed', err);
    }
    console.log('[rollback] Coordinator torn down');
    rollbackCoordinator = null;
  }
}

/**
 * Call coordinator.step() from the game loop.
 * During R3.1, this is the input-ingestion path.
 * During R3.2+, this also triggers rollback+resim on divergence.
 * 
 * @param {object} localInput - Local player input: { left, right, up, down, shoot, aimX, aimY }
 * @param {number} dt - Timestep in seconds
 * 
 * Returns nothing (state is mutated in-place by coordinator).
 */
export function coordinatorStep(localInput, dt) {
  if (!rollbackCoordinator) return; // No-op if not in rollback mode
  try {
    rollbackCoordinator.step(localInput, dt);
  } catch (err) {
    console.error('[rollback] coordinator.step failed:', err);
  }
}

/**
 * Placeholder simStep until R0.4 carves out the real one.
 * Currently a no-op; game loop still uses inline update() logic.
 * 
 * Once R0.4 is complete, this will be replaced with the actual
 * deterministic sim function: (state, slot0Input, slot1Input, dt) => void
 */
function nopSimStep(state, slot0Input, slot1Input, dt) {
  // Placeholder: no-op
  // Game loop still runs inline update() logic in script.js
  // TODO (R0.4): extract real simStep from script.js update() function
}

export default {
  setupRollback,
  setSimStep,
  teardownRollback,
  coordinatorStep,
  get rollbackCoordinator() { return rollbackCoordinator; },
};
