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
 * @param {object} [options] - Optional config
 * @param {function} [options.simStep] - Real deterministic sim step. When provided the
 *   coordinator uses it for rollback resim only (skipSimStepOnForward=true keeps the
 *   game loop's update() as the authoritative forward path — no double-advance).
 * @param {object}   [options.simStepOpts] - opts passed as 5th arg to simStep (worldW/H,
 *   baseSpeed, obstacle callbacks, etc.)
 * @param {boolean}  [options.logging] - Log rollback events for debugging
 *
 * @returns {RollbackCoordinator} The new coordinator
 */
export function setupRollback(
  simState,
  localSlotIndex,
  sendInputFn,
  registerRemoteInputFn,
  options = {}
) {
  if (rollbackCoordinator) {
    console.warn('[rollback] setupRollback called while coordinator already exists');
    return rollbackCoordinator;
  }

  const { simStep: realSimStepFn = null, simStepOpts = {}, logging = false } = options;

  // Wrap realSimStepFn with opts so coordinator.step() only needs (state,s0,s1,dt).
  // skipSimStepOnForward=true: simStep is used for resim only, not the forward step —
  // because update() already advanced state each tick and we must not double-advance.
  const simStepFn = realSimStepFn
    ? (state, s0, s1, dt) => realSimStepFn(state, s0, s1, dt, simStepOpts)
    : nopSimStep;

  rollbackCoordinator = new RollbackCoordinator({
    simState,
    simStep: simStepFn,
    localSlotIndex,
    sendInput: sendInputFn,
    onRemoteInput: registerRemoteInputFn,
    maxRollbackTicks: 8,
    skipSimStepOnForward: true,   // update() already advances state — no double-advance
    logger: logging ? (msg) => console.log('[rollback]', msg) : null,
  });

  console.log(
    `[rollback] Coordinator initialized: slot ${localSlotIndex}, ` +
    `simStep=${realSimStepFn ? 'real' : 'placeholder'}, maxRollback=8 ticks, skipForward=true`
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
 * @param {object} localInput - Local player input: { joy: { dx, dy, active, mag } }
 * @param {number} dt - Timestep in seconds
 *
 * @returns {{ stalled: boolean } | undefined} Stall status from the coordinator,
 *   or undefined if no coordinator is active. stalled=true means remote input age
 *   exceeds maxRollbackTicks — the prediction window is overstretched.
 */
export function coordinatorStep(localInput, dt) {
  if (!rollbackCoordinator) return undefined;
  try {
    return rollbackCoordinator.step(localInput, dt);
  } catch (err) {
    console.error('[rollback] coordinator.step failed:', err);
    return undefined;
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
