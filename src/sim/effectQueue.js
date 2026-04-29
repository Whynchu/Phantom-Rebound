// R0.4 foundation — effect queue.
//
// In rollback netcode, the simulation re-runs the same N ticks repeatedly
// while the network corrects its prediction. If side-effects (particles,
// audio cues, hit-stop, screen-shake, muzzle flashes, damage numbers) fire
// directly from inside the sim step, they'd fire N times — a particle
// storm or an audio stutter every time the network blinks.
//
// The fix is structural: the sim step never fires side-effects directly.
// It APPENDS effect descriptors onto state.effectQueue. The renderer/audio
// layer drains the queue ONLY on COMMITTED ticks (i.e., ticks that will
// not be re-simulated). Re-simulated ticks discard their queued effects.
//
// This module provides the small queue API. State carries the queue;
// callers append via emit(), the renderer drains via drain().
//
// Effect descriptor shape:
//   {
//     kind: string,       // 'particle.spawnSparks', 'audio.shieldHit', etc.
//     // arbitrary kind-specific payload below this line
//     ...
//   }
//
// Determinism: the queue is part of sim state. Append order is
// deterministic because the sim step is deterministic. Two peers
// running the same inputs produce the same queue contents.

/**
 * Initialize an empty queue on a sim state object.
 * Called from createSimState() and any reset path.
 */
export function initEffectQueue(state) {
  state.effectQueue = [];
}

/**
 * Append an effect descriptor to the queue.
 * `kind` is required and must be a non-empty string.
 * `payload` extends the descriptor with kind-specific fields.
 *
 * Returns the descriptor object (useful in tests).
 */
export function emit(state, kind, payload = null) {
  if (!state || !Array.isArray(state.effectQueue)) {
    throw new Error('emit: state.effectQueue is not initialized');
  }
  if (typeof kind !== 'string' || kind.length === 0) {
    throw new Error('emit: kind must be a non-empty string');
  }
  const desc = (payload && typeof payload === 'object')
    ? { kind, ...payload }
    : { kind };
  state.effectQueue.push(desc);
  return desc;
}

/**
 * Drain ALL queued effects, returning them as an array.
 * Called by the renderer/audio layer once per COMMITTED frame, after
 * sim has finalized the tick (no rollback re-sim will revisit it).
 *
 * The returned array is a fresh allocation; the queue is reset to empty.
 */
export function drain(state) {
  if (!state || !Array.isArray(state.effectQueue)) return [];
  const out = state.effectQueue;
  state.effectQueue = [];
  return out;
}

/**
 * Clear the queue WITHOUT processing — used when discarding a re-simulated
 * tick that will be replayed.
 *
 * Returns the count cleared (useful for instrumentation).
 */
export function clear(state) {
  if (!state || !Array.isArray(state.effectQueue)) return 0;
  const n = state.effectQueue.length;
  state.effectQueue.length = 0;
  return n;
}

/**
 * Snapshot the current queue contents (deep-copied) without draining.
 * Useful for state-serialization round-trips and debugging. The snapshot
 * is a plain array of plain objects safe to JSON-encode.
 */
export function snapshot(state) {
  if (!state || !Array.isArray(state.effectQueue)) return [];
  return state.effectQueue.map((e) => ({ ...e }));
}

/**
 * Restore queue contents from a previously-snapshotted array.
 * Used in rollback re-sim when reverting to a saved sim state.
 */
export function restore(state, queueSnapshot) {
  if (!state) throw new Error('restore: state required');
  if (!Array.isArray(queueSnapshot)) {
    state.effectQueue = [];
    return;
  }
  state.effectQueue = queueSnapshot.map((e) => ({ ...e }));
}

/**
 * Current queue length without draining.
 */
export function size(state) {
  if (!state || !Array.isArray(state.effectQueue)) return 0;
  return state.effectQueue.length;
}
