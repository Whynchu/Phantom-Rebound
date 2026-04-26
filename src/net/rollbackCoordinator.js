/**
 * R3 Rollback Netcode Coordinator
 * 
 * Integrates RollbackBuffer into the coop gameplay loop.
 * Responsibilities:
 * - Maintain rollback buffer (last 16 states)
 * - Collect local inputs and send to peer
 * - Receive and buffer remote inputs with tick numbers
 * - Predict remote input (repeat-last or neutral)
 * - On late-arrival input: detect divergence, rewind, resim, apply
 * - Expose a `step()` API that game loop calls each tick
 * 
 * Design philosophy:
 * - Stateless in-place rollback: restoreState never replaces objects
 * - RNG state rolls back with simState (seeded RNG determinism)
 * - Bridges in script.js work transparently across rollback
 * - No snapshots transmitted: only lightweight input frames
 */

import { RollbackBuffer } from '../sim/rollbackBuffer.js';
import { restoreState, snapshotState } from '../sim/simStateSerialize.js';

/**
 * @typedef RollbackCoordinatorConfig
 * @property {object} simState - The live SimState (mutated in-place on rollback)
 * @property {function} simStep - The deterministic sim: (state, worldInputs, slot1Inputs, dt) => void
 * @property {number} localSlotIndex - 0 (world) or 1 (slot1)
 * @property {function} sendInput - Send local input to peer: (frame) => Promise
 * @property {function} onRemoteInput - Register callback for remote input arrival: (callback) => void
 * @property {number} bufferCapacity - Ring buffer size (default 16 ticks)
 * @property {number} maxRollbackTicks - Max ticks to rollback (safety limit, default 8)
 * @property {function} logger - Debug logger (default null)
 */

export class RollbackCoordinator {
  constructor(config = {}) {
    const {
      simState,
      simStep,
      localSlotIndex,
      sendInput,
      onRemoteInput,
      bufferCapacity = 16,
      maxRollbackTicks = 8,
      logger = null,
    } = config;

    if (!simState || typeof simState !== 'object') throw new Error('RollbackCoordinator: simState required');
    if (typeof simStep !== 'function') throw new Error('RollbackCoordinator: simStep required');
    if (typeof localSlotIndex !== 'number' || ![0, 1].includes(localSlotIndex)) {
      throw new Error('RollbackCoordinator: localSlotIndex must be 0 or 1');
    }
    if (typeof sendInput !== 'function') throw new Error('RollbackCoordinator: sendInput required');
    if (typeof onRemoteInput !== 'function') throw new Error('RollbackCoordinator: onRemoteInput required');

    this.simState = simState;
    this.simStep = simStep;
    this.localSlotIndex = localSlotIndex;
    this.remoteSlotIndex = 1 - localSlotIndex;
    this.sendInput = sendInput;
    this.maxRollbackTicks = maxRollbackTicks;
    this.logger = logger;

    // Ring buffer stores last N ticks
    this.buffer = new RollbackBuffer(bufferCapacity);
    this.currentTick = 0;

    // Store initial state (before any ticks) as tick -1
    // This allows rollback to tick 0 to start from a clean slate
    this.buffer.buffer.push({
      tick: -1,
      state: snapshotState(simState),
      worldInputs: {},
      slot1Inputs: {}
    });

    // Input tracking
    this.localInputHistory = [];  // [tick] → input
    this.remoteInputHistory = []; // [tick] → input (actual received)
    this.remotePredictions = [];  // [tick] → predicted input

    // Register for remote input arrival
    onRemoteInput((remoteInputEvent) => {
      this._onRemoteInputArrived(remoteInputEvent);
    });
  }

  /**
   * Step the simulation forward by dt.
   * Called once per tick by the game loop.
   *
   * @param {object} localInput - Local player's input for this tick
   * @param {number} dt - Timestep (1/60 typically)
   */
  step(localInput, dt) {
    // Store local input
    this.localInputHistory[this.currentTick] = { ...localInput };

    // Get remote input: actual if available, else prediction
    let remoteInput = this.remoteInputHistory[this.currentTick];
    if (!remoteInput) {
      // Predict: repeat-last or neutral
      const lastRemote = this.remoteInputHistory[this.currentTick - 1];
      remoteInput = lastRemote ? { ...lastRemote } : this._neutralInput();
      // Store the actual predicted input so we can compare correctly when
      // the real remote input arrives. Earlier code stored `true` here,
      // which made _onRemoteInputArrived assume we always predicted neutral
      // — causing a spurious rollback even when repeat-last was correct.
      this.remotePredictions[this.currentTick] = { ...remoteInput };
    }

    // Prepare slot inputs in world/slot1 order
    const slot0Input = this.localSlotIndex === 0 ? localInput : remoteInput;
    const slot1Input = this.localSlotIndex === 1 ? localInput : remoteInput;

    // Simulate forward
    this.simStep(this.simState, slot0Input, slot1Input, dt);

    // Snapshot state in buffer
    this.buffer.push(this.simState, slot0Input, slot1Input);

    // Send local input to peer
    this.sendInput({
      tick: this.currentTick,
      slot: this.localSlotIndex,
      ...localInput,
    }).catch((err) => {
      this.logger?.('RollbackCoordinator: sendInput failed', err);
    });

    this.currentTick++;
  }

  /**
   * Handle arrival of remote input from peer.
   * If it diverges from prediction, trigger rollback.
   *
   * @private
   */
  _onRemoteInputArrived(event) {
    // event = { tick, slot, ...inputFields }
    const { tick } = event;
    const remoteInput = {
      left: event.left ?? false,
      right: event.right ?? false,
      up: event.up ?? false,
      down: event.down ?? false,
      shoot: event.shoot ?? false,
      // ... other input fields
    };

    // Store the actual input
    this.remoteInputHistory[tick] = remoteInput;

    // Check if we already simmed this tick with a prediction
    if (tick >= this.currentTick) {
      // Input arrived before we reached that tick; normal case for network buffering
      return;
    }

    // We've already simmed past this tick with a prediction.
    // Compare the actual input against the prediction we recorded.
    const predictedInput = this.remotePredictions[tick] ?? this._neutralInput();

    const matchesPrediction = this._inputsEqual(remoteInput, predictedInput);
    this.logger?.(`_onRemoteInputArrived: tick=${tick}, predicted=${JSON.stringify(predictedInput)}, actual=${JSON.stringify(remoteInput)}, matches=${matchesPrediction}`);
    if (!matchesPrediction) {
      // Divergence detected! Rollback and resim.
      this._rollbackAndResim(tick);
    }
  }

  /**
   * Rollback to just before divergenceTick and resimulate forward with real input.
   *
   * @private
   */
  _rollbackAndResim(divergenceTick) {
    // Safety check: don't rollback too far
    const rollbackDepth = this.currentTick - divergenceTick;
    if (rollbackDepth > this.maxRollbackTicks) {
      this.logger?.(
        `RollbackCoordinator: divergence at tick ${divergenceTick} exceeds max rollback (${rollbackDepth} > ${this.maxRollbackTicks})`
      );
      return; // Give up; state is too old
    }

    // Find the snapshot just before divergenceTick
    const rewindTick = divergenceTick - 1;
    const rewindSnap = this.buffer.getAtTick(rewindTick);
    if (!rewindSnap) {
      this.logger?.(
        `RollbackCoordinator: no snapshot found for rewind tick ${rewindTick} (divergence at ${divergenceTick})`
      );
      return;
    }

    // Restore state
    restoreState(this.simState, rewindSnap.state);
    this.logger?.(`_rollbackAndResim: restored state from tick ${rewindTick}`);

    // Resimulate from divergenceTick to currentTick with real inputs
    for (let tick = divergenceTick; tick < this.currentTick; tick++) {
      const localInput = this.localInputHistory[tick] ?? {};
      const remoteInput = this.remoteInputHistory[tick] ?? this._neutralInput();

      const slot0Input = this.localSlotIndex === 0 ? localInput : remoteInput;
      const slot1Input = this.localSlotIndex === 1 ? localInput : remoteInput;

      this.logger?.(`_rollbackAndResim: tick ${tick}: s0=${JSON.stringify(slot0Input)}, s1=${JSON.stringify(slot1Input)}`);
      this.simStep(this.simState, slot0Input, slot1Input, 1 / 60); // Assume 60 Hz

      // Persist the corrected snapshot back into the buffer so that future
      // rollbacks rewind to the post-resim state, not the stale prediction.
      // Without this, a second divergence at tick T+1 would restore the
      // OLD predicted state at tick T and re-introduce the prediction error.
      this.buffer.replaceAtTick(tick, this.simState, slot0Input, slot1Input);

      // Clear the prediction marker for this tick — we now have authoritative
      // data, so this slot in remotePredictions is no longer relevant. (The
      // matching remoteInputHistory[tick] entry was already set by the caller.)
      this.remotePredictions[tick] = null;
    }

    this.logger?.(
      `RollbackCoordinator: rolled back ${rollbackDepth} ticks from divergence at tick ${divergenceTick}`
    );
  }

  /**
   * Compare two input objects for equality.
   *
   * @private
   */
  _inputsEqual(a, b) {
    if (!a || !b) return a === b;
    return (a.left === b.left &&
            a.right === b.right &&
            a.up === b.up &&
            a.down === b.down &&
            a.shoot === b.shoot);
  }

  /**
   * Create a neutral input (no movement, no shoot).
   *
   * @private
   */
  _neutralInput() {
    return { left: false, right: false, up: false, down: false, shoot: false };
  }

  /**
   * Debug: get coordinator state summary.
   */
  summary() {
    return {
      currentTick: this.currentTick,
      bufferSize: this.buffer.size(),
      localInputCount: this.localInputHistory.length,
      remoteInputCount: this.remoteInputHistory.length,
      pendingPredictions: this.remotePredictions.filter(p => p).length,
    };
  }
}
