/**
 * R3 Rollback Integration Layer
 *
 * Manages RollbackCoordinator instances for coop sessions.
 * Bridges between the game loop (script.js) and the rollback netcode.
 *
 * Status (DR-2):
 * - ROLLBACK_ENABLED is always-on; guestPredictionReconciler retired.
 * - coordinator.step() called every sim tick for input exchange + resim.
 * - skipSimStepOnForward:false on guest — coordinator drives hostSimStep
 *   every forward tick, retiring the D-series snapshotApplier + broadcaster.
 * - stall flag wired to UI indicator; telemetry via window.__rbdiag().
 *
 * Next milestones:
 * - R5: two-peer stress test + production ship
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
 * @param {boolean}  [options.skipSimStepOnForward=true] - When false (DR-2 guest mode),
 *   coordinator calls hostSimStep every forward tick so guest physics are driven by the
 *   same deterministic path as the host, retiring the snapshotApplier as the sync source.
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

  const {
    simStep: realSimStepFn = null,
    simStepOpts = {},
    logging = false,
    skipSimStepOnForward = true,
  } = options;

  // Wrap realSimStepFn with opts so coordinator.step() only needs (state,s0,s1,dt).
  // skipSimStepOnForward=true: simStep is used for resim only, not the forward step —
  // because update() already advanced state each tick and we must not double-advance.
  // skipSimStepOnForward=false (DR-2 guest): coordinator calls hostSimStep every forward
  // tick so the guest's physics are driven deterministically by the same sim path as host.
  const simStepFn = realSimStepFn
    ? (state, s0, s1, dt) => realSimStepFn(state, s0, s1, dt, simStepOpts)
    : () => {}; // no-op fallback when no simStep provided

  rollbackCoordinator = new RollbackCoordinator({
    simState,
    simStep: simStepFn,
    localSlotIndex,
    sendInput: sendInputFn,
    onRemoteInput: registerRemoteInputFn,
    // R4.2 — Buffer tuning rationale:
    //   maxRollbackTicks = 20:  At 60 Hz, 20 ticks ≈ 333 ms.  This covers
    //     the typical mobile round-trip (100–200 ms) plus headroom for brief
    //     network stalls.  The previous 8-tick window caused permanent guest
    //     divergence after any >133 ms latency spike (observed 44-tick / 730 ms
    //     gaps on real devices).  Partial-resync fallback in _rollbackAndResim
    //     handles bursts beyond this window.
    //   bufferCapacity = 42:  Must be > maxRollbackTicks (enforced in
    //     RollbackCoordinator constructor).  42 = 2× the rollback window + 2,
    //     giving the ring buffer enough slack to store the rewind target (tick
    //     divergenceTick - 1) even when the resim replays all 20 subsequent
    //     ticks.  Lower values risk getAtTick() misses on deeper rollbacks.
    maxRollbackTicks: 20,
    bufferCapacity: 42,
    skipSimStepOnForward,
    logger: logging ? (msg) => console.log('[rollback]', msg) : null,
  });

  console.log(
    `[rollback] Coordinator initialized: slot ${localSlotIndex}, ` +
    `simStep=${realSimStepFn ? 'real' : 'placeholder'}, maxRollback=20 ticks, skipForward=${skipSimStepOnForward}`
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
 * R4.2: Snapshot of rollback telemetry for diagnostics.
 * Returns null when no coordinator is active (solo / D-series).
 */
export function getRollbackStats() {
  if (!rollbackCoordinator) return null;
  try { return rollbackCoordinator.getStats(); } catch (_) { return null; }
}

/**
 * R4.2: Whether the coordinator is currently stalled (remote input age
 * exceeds maxRollbackTicks).  Returns false when no coordinator is active.
 */
export function isRollbackStalled() {
  if (!rollbackCoordinator) return false;
  try { return rollbackCoordinator.getRemoteAgeTicks() > rollbackCoordinator.maxRollbackTicks; }
  catch (_) { return false; }
}

/**
 * DR-2 (Step 13): Whether at least one remote input has been received since
 * coordinator init. Returns false when no coordinator is active.
 */
export function hasReceivedRemoteInput() {
  if (!rollbackCoordinator) return false;
  try { return rollbackCoordinator.getRemoteAgeTicks() !== Infinity; }
  catch (_) { return false; }
}

/**
 * DR-2 (Step 13): Ticks since the freshest received remote input.
 * Returns Infinity when no remote input ever received or no coordinator.
 */
export function getCoordinatorRemoteAgeTicks() {
  if (!rollbackCoordinator) return Infinity;
  try { return rollbackCoordinator.getRemoteAgeTicks(); }
  catch (_) { return Infinity; }
}

export default {
  setupRollback,
  setSimStep,
  teardownRollback,
  coordinatorStep,
  getRollbackStats,
  isRollbackStalled,
  hasReceivedRemoteInput,
  getCoordinatorRemoteAgeTicks,
  get rollbackCoordinator() { return rollbackCoordinator; },
};
