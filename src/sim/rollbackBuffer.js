/**
 * Rollback ring buffer for coop netcode.
 * 
 * Stores the last N sim states indexed by tick, plus per-peer input history.
 * On late-arrival input detection: rewind to divergence tick, splice real input,
 * re-simulate forward, and apply result.
 * 
 * Design:
 * - Ring buffer capacity is typically 16 states (~267ms @ 60fps).
 * - Each entry stores { tick, state_snapshot, worldInputs, slot1Inputs }.
 * - If slot 1 input arrives late (predicted != real), we find the divergence tick,
 *   rewind, and re-sim.
 * - Solo/offline: rollback buffer still exists but isn't used (simStep goes straight through).
 * - Coop rollback mode: simStep writes to buffer; on input mismatch, restoreState
 *   and re-simulate.
 */

import { snapshotState, restoreState, serialize } from './simStateSerialize.js';

export function snapshotStateForRollback(simState) {
  const state = snapshotState(simState);
  if (Array.isArray(state.effectQueue)) state.effectQueue = [];
  return state;
}

/**
 * @typedef RollbackSnapshot
 * @property {number} tick - Tick number this snapshot was captured at
 * @property {object} state - Deep snapshot of simState
 * @property {object} worldInputs - Slot 0 input that produced this state
 * @property {object} slot1Inputs - Slot 1 input that produced this state
 */

export class RollbackBuffer {
  /**
   * @param {number} capacity - Number of states to retain (default 16)
   */
  constructor(capacity = 16) {
    this.capacity = capacity;
    this.buffer = []; // Array of RollbackSnapshot, oldest to newest
    this.tick = 0;    // Current tick counter
  }

  /**
   * Push a new state snapshot into the ring buffer.
   * If buffer is at capacity, oldest entry is dropped.
   *
   * @param {object} simState - The live simState to snapshot
   * @param {object} worldInputs - Slot 0 input that led to this state
   * @param {object} slot1Inputs - Slot 1 input that led to this state
   */
  push(simState, worldInputs, slot1Inputs) {
    const snapshot = {
      tick: this.tick,
      state: snapshotStateForRollback(simState),
      worldInputs: { ...worldInputs },
      slot1Inputs: { ...slot1Inputs }
    };

    this.buffer.push(snapshot);
    this.tick++;

    // Enforce capacity by dropping oldest
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
  }

  /**
   * Get a snapshot by tick. Returns null if tick is not in buffer.
   *
   * @param {number} targetTick - Tick to retrieve
   * @returns {RollbackSnapshot|null}
   */
  getAtTick(targetTick) {
    return this.buffer.find(s => s.tick === targetTick) || null;
  }

  /**
   * Get the most recent snapshot in the buffer.
   *
   * @returns {RollbackSnapshot|null}
   */
  getLatest() {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : null;
  }

  /**
   * Replace the state and inputs stored for a specific tick. Used by the
   * rollback coordinator after a resim so subsequent rollbacks rewind to
   * the corrected state, not the stale predicted state. Returns true if the
   * snapshot was found and updated, false otherwise.
   *
   * @param {number} targetTick
   * @param {object} simState - Live simState (will be deep-cloned)
   * @param {object} worldInputs
   * @param {object} slot1Inputs
   * @returns {boolean}
   */
  replaceAtTick(targetTick, simState, worldInputs, slot1Inputs) {
    const snap = this.buffer.find(s => s.tick === targetTick);
    if (!snap) return false;
    snap.state = snapshotStateForRollback(simState);
    snap.worldInputs = { ...worldInputs };
    snap.slot1Inputs = { ...slot1Inputs };
    return true;
  }

  /**
   * Find the first tick where worldInputs or slot1Inputs differ from predictions.
   * Used to detect where rollback should start.
   *
   * @param {Array<object>} worldInputsHistory - Array of actual world inputs by index
   * @param {Array<object>} slot1InputsHistory - Array of actual slot1 inputs by index
   * @param {Array<object>} worldPredictions - Array of predicted world inputs
   * @param {Array<object>} slot1Predictions - Array of predicted slot1 inputs
   * @returns {number} First divergence tick, or -1 if no divergence
   */
  findDivergenceTick(worldInputsHistory, slot1InputsHistory, worldPredictions, slot1Predictions) {
    for (let i = 0; i < this.buffer.length; i++) {
      const snap = this.buffer[i];
      const wPred = worldPredictions[i];
      const wReal = worldInputsHistory[i];
      const s1Pred = slot1Predictions[i];
      const s1Real = slot1InputsHistory[i];

      // Compare actual inputs to what was predicted
      if (!this._inputsEqual(wReal, wPred) || !this._inputsEqual(s1Real, s1Pred)) {
        return snap.tick;
      }
    }
    return -1;
  }

  /**
   * Perform a rollback: rewind to a specific tick and restore state.
   * Returns the restored snapshot.
   *
   * @param {number} targetTick - Tick to rewind to
   * @param {object} liveState - The live simState to restore into (mutated)
   * @returns {RollbackSnapshot|null} The restored snapshot, or null if not found
   */
  rewind(targetTick, liveState) {
    const snapshot = this.getAtTick(targetTick);
    if (!snapshot) {
      return null;
    }
    restoreState(liveState, snapshot.state);
    return snapshot;
  }

  /**
   * Clear all snapshots (for testing or reset).
   */
  clear() {
    this.buffer = [];
    this.tick = 0;
  }

  /**
   * Get total number of snapshots in buffer.
   */
  size() {
    return this.buffer.length;
  }

  /**
   * Helper: compare two input objects for equality.
   * Inputs are plain objects with keys like 'left', 'right', 'shoot', etc.
   */
  _inputsEqual(a, b) {
    if (!a || !b) return a === b;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (a[key] !== b[key]) return false;
    }
    return true;
  }

  /**
   * Utility: Get a summary of buffer contents for debugging.
   */
  summary() {
    return {
      capacity: this.capacity,
      size: this.buffer.length,
      currentTick: this.tick,
      oldestTick: this.buffer.length > 0 ? this.buffer[0].tick : null,
      newestTick: this.buffer.length > 0 ? this.buffer[this.buffer.length - 1].tick : null
    };
  }
}

/**
 * Rollback harness for testing: validates that a rollback replay produces
 * the same final state as the no-rollback path.
 * 
 * Usage:
 *   const harness = new RollbackTestHarness(simStep, initialState);
 *   harness.runNoRollback(inputs0, inputs1);  // Ground truth
 *   harness.runWithRollback(inputs0, inputs1, lateArrivalTick);  // With rollback
 *   if (harness.compareStates()) { console.log('PASS'); }
 */
export class RollbackTestHarness {
  /**
   * @param {function} simStep - The deterministic sim function: (state, worldInputs, slot1Inputs, dt) => void
   * @param {object} initialState - Fresh simState for each run
   * @param {number} dt - Timestep (default 1/60)
   */
  constructor(simStep, initialState, dt = 1 / 60) {
    this.simStep = simStep;
    this.initialState = initialState;
    this.dt = dt;
    this.noRollbackState = null;
    this.rollbackState = null;
    this.noRollbackSteps = [];
    this.rollbackSteps = [];
  }

  /**
   * Run the no-rollback baseline: feed inputs sequentially, record each tick.
   *
   * @param {Array<object>} slot0Inputs - Input for slot 0 by tick
   * @param {Array<object>} slot1Inputs - Input for slot 1 by tick
   */
  runNoRollback(slot0Inputs, slot1Inputs) {
    this.noRollbackState = snapshotState(this.initialState);
    this.noRollbackSteps = [];

    for (let i = 0; i < slot0Inputs.length; i++) {
      this.simStep(this.noRollbackState, slot0Inputs[i], slot1Inputs[i], this.dt);
      this.noRollbackSteps.push({
        tick: i,
        state: snapshotState(this.noRollbackState)
      });
    }
  }

  /**
   * Run with rollback: use predictions, then inject late-arrival input at lateArrivalTick.
   * On injection, rewind and resimulate.
   *
   * @param {Array<object>} slot0Actual - Actual slot 0 inputs
   * @param {Array<object>} slot1Actual - Actual slot 1 inputs
   * @param {Array<object>} slot0Predictions - Predicted slot 0 inputs
   * @param {Array<object>} slot1Predictions - Predicted slot 1 inputs
   * @param {number} lateArrivalTick - Tick at which real slot1 input arrives
   */
  runWithRollback(slot0Actual, slot1Actual, slot0Predictions, slot1Predictions, lateArrivalTick) {
    this.rollbackState = snapshotState(this.initialState);
    this.rollbackSteps = [];
    const buffer = new RollbackBuffer(16);

    // Capture the initial state (before any ticks)
    // Store it with a special marker that we can find
    buffer.buffer.push({
      tick: -1,
      state: snapshotState(this.rollbackState),
      worldInputs: {},
      slot1Inputs: {}
    });

    // Phase 1: sim forward with predictions until lateArrivalTick
    for (let i = 0; i < lateArrivalTick; i++) {
      const s0 = slot0Predictions[i] || slot0Actual[i];
      const s1 = slot1Predictions[i] || slot1Actual[i];

      this.simStep(this.rollbackState, s0, s1, this.dt);
      buffer.push(this.rollbackState, s0, s1);

      this.rollbackSteps.push({
        tick: i,
        state: snapshotState(this.rollbackState),
        isPredicted: true
      });
    }

    // Phase 2: detect divergence and rewind
    const divergenceTick = buffer.findDivergenceTick(
      slot0Actual,
      slot1Actual,
      slot0Predictions,
      slot1Predictions
    );

    if (divergenceTick >= 0) {
      // Rewind to just before divergence point
      const rewindTick = divergenceTick - 1;
      const rewindSnap = buffer.getAtTick(rewindTick);
      if (!rewindSnap) {
        throw new Error(`Failed to find snapshot to rewind to tick ${rewindTick} (divergence was at ${divergenceTick})`);
      }
      restoreState(this.rollbackState, rewindSnap.state);

      // Resimulate from divergence forward with real inputs
      let tick = divergenceTick;
      while (tick < slot0Actual.length) {
        const s0 = slot0Actual[tick] || slot0Predictions[tick];
        const s1 = slot1Actual[tick] || slot1Predictions[tick];

        this.simStep(this.rollbackState, s0, s1, this.dt);
        this.rollbackSteps.push({
          tick: tick,
          state: snapshotState(this.rollbackState),
          isPredicted: false
        });
        tick++;
      }
    } else {
      // No divergence; continue to end with predictions
      for (let i = lateArrivalTick; i < slot0Actual.length; i++) {
        const s0 = slot0Predictions[i] || slot0Actual[i];
        const s1 = slot1Predictions[i] || slot1Actual[i];

        this.simStep(this.rollbackState, s0, s1, this.dt);
        this.rollbackSteps.push({
          tick: i,
          state: snapshotState(this.rollbackState),
          isPredicted: true
        });
      }
    }
  }

  /**
   * Compare final states from no-rollback and rollback runs.
   * Returns true if they match, false otherwise.
   * 
   * For debugging, logs the first difference if states diverge.
   */
  compareStates() {
    if (!this.noRollbackState || !this.rollbackState) {
      console.error('compareStates: Both runNoRollback and runWithRollback must complete first');
      return false;
    }

    // Simple comparison: serialize both and compare JSON
    const noRollStr = JSON.stringify(this.noRollbackState);
    const rollStr = JSON.stringify(this.rollbackState);

    if (noRollStr === rollStr) {
      return true;
    }

    // For debugging: find first difference
    console.error('State mismatch between no-rollback and rollback paths');
    console.error(`No-rollback final tick: ${this.noRollbackSteps.length}`);
    console.error(`Rollback final tick: ${this.rollbackSteps.length}`);
    console.error('Serialized states differ.');

    return false;
  }

  /**
   * Get a summary of the rollback run for debugging.
   */
  rollbackSummary() {
    if (!this.rollbackSteps || this.rollbackSteps.length === 0) {
      return { ticks: 0, divergences: 0 };
    }

    let divergences = 0;
    let predicted = 0;
    for (const step of this.rollbackSteps) {
      if (step.isPredicted === false && predicted > 0) {
        divergences++;
      }
      if (step.isPredicted) predicted++;
    }

    return {
      ticks: this.rollbackSteps.length,
      predictedTicks: this.rollbackSteps.filter(s => s.isPredicted).length,
      rewindCount: divergences,
      finalTick: this.rollbackSteps.length > 0 ? this.rollbackSteps[this.rollbackSteps.length - 1].tick : 0
    };
  }
}
