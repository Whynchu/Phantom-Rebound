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
      // When true the coordinator is operating in "snapshot-only" mode: the
      // game loop (update()) already advanced state each tick, so the forward
      // path must NOT call simStep again or we'd double-advance. simStep is
      // still called during _rollbackAndResim where update() is NOT running.
      skipSimStepOnForward = false,
    } = config;

    if (!simState || typeof simState !== 'object') throw new Error('RollbackCoordinator: simState required');
    if (typeof simStep !== 'function') throw new Error('RollbackCoordinator: simStep required');
    if (typeof localSlotIndex !== 'number' || ![0, 1].includes(localSlotIndex)) {
      throw new Error('RollbackCoordinator: localSlotIndex must be 0 or 1');
    }
    if (typeof sendInput !== 'function') throw new Error('RollbackCoordinator: sendInput required');
    if (typeof onRemoteInput !== 'function') throw new Error('RollbackCoordinator: onRemoteInput required');

    // R4: enforce config invariant. The ring buffer must hold at least one
    // pre-divergence snapshot (the rewind target) plus maxRollbackTicks worth
    // of resim frames; otherwise getAtTick() during _rollbackAndResim will
    // miss and the resim is silently skipped.
    if (bufferCapacity < maxRollbackTicks + 1) {
      throw new Error(
        `RollbackCoordinator: bufferCapacity (${bufferCapacity}) must be >= maxRollbackTicks + 1 (${maxRollbackTicks + 1})`
      );
    }

    this.simState = simState;
    this.simStep = simStep;
    this.skipSimStepOnForward = skipSimStepOnForward;
    this.localSlotIndex = localSlotIndex;
    this.remoteSlotIndex = 1 - localSlotIndex;
    this.sendInput = sendInput;
    this.bufferCapacity = bufferCapacity;
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

    // R4 telemetry
    this._stats = {
      rollbacksPerformed: 0,
      maxRollbackDepthSeen: 0,
      predictionMisses: 0,
      remoteFramesReceived: 0,
      lateRemoteFrames: 0,        // arrived after currentTick → triggered rollback path
      pendingRemoteFrames: 0,     // arrived before currentTick reached them (normal)
    };
    this._lastReceivedRemoteTick = -1;

    // R4 listener disposal: capture any unsubscribe handle the registrar
    // returns so dispose() can detach cleanly. Older callers return undefined,
    // which is fine — we just have nothing to detach.
    const unsub = onRemoteInput((remoteInputEvent) => {
      this._onRemoteInputArrived(remoteInputEvent);
    });
    this._remoteUnsub = typeof unsub === 'function' ? unsub : null;
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

    // Simulate forward — skip when game loop's update() already did it
    // (skipSimStepOnForward mode). simStep is still used during _rollbackAndResim.
    if (!this.skipSimStepOnForward) {
      this.simStep(this.simState, slot0Input, slot1Input, dt);
    }

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

    // R4: bounded history. Once we're past the rollback window, the entry
    // at (currentTick - bufferCapacity - 1) can never be referenced again
    // because rollback can't reach that far. Drop it to keep memory bounded
    // for long sessions. `delete` keeps the array sparse (no dense holes).
    const pruneTick = this.currentTick - this.bufferCapacity - 1;
    if (pruneTick >= 0) {
      delete this.localInputHistory[pruneTick];
      delete this.remoteInputHistory[pruneTick];
      delete this.remotePredictions[pruneTick];
    }

    // R4: stall status. Once we've seen at least one remote input, flag
    // stalled when the freshest remote is older than the rollback window —
    // continuing to predict past this point will fall outside what rollback
    // can correct. Caller can use this to pause UI / show "waiting for peer".
    const stalled = this._lastReceivedRemoteTick >= 0 &&
      (this.currentTick - 1 - this._lastReceivedRemoteTick) > this.maxRollbackTicks;
    return { stalled };
  }

  /**
   * Handle arrival of remote input from peer.
   * If it diverges from prediction, trigger rollback.
   *
   * @private
   */
  _onRemoteInputArrived(event) {
    // event = { tick, slot, dx?, dy?, active?, mag? } — flat joy fields for transport
    const { tick } = event;
    const remoteInput = {
      joy: {
        dx:     event.dx     ?? 0,
        dy:     event.dy     ?? 0,
        active: event.active ?? false,
        mag:    event.mag    ?? 0,
      },
    };

    // Store the actual input
    this.remoteInputHistory[tick] = remoteInput;
    this._stats.remoteFramesReceived++;
    if (tick > this._lastReceivedRemoteTick) this._lastReceivedRemoteTick = tick;

    // Check if we already simmed this tick with a prediction
    if (tick >= this.currentTick) {
      // Input arrived before we reached that tick; normal case for network buffering
      this._stats.pendingRemoteFrames++;
      return;
    }

    this._stats.lateRemoteFrames++;

    // We've already simmed past this tick with a prediction.
    // Compare the actual input against the prediction we recorded.
    const predictedInput = this.remotePredictions[tick] ?? this._neutralInput();

    const matchesPrediction = this._inputsEqual(remoteInput, predictedInput);
    this.logger?.(`_onRemoteInputArrived: tick=${tick}, predicted=${JSON.stringify(predictedInput)}, actual=${JSON.stringify(remoteInput)}, matches=${matchesPrediction}`);
    if (!matchesPrediction) {
      this._stats.predictionMisses++;
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
    this._stats.rollbacksPerformed++;
    if (rollbackDepth > this._stats.maxRollbackDepthSeen) {
      this._stats.maxRollbackDepthSeen = rollbackDepth;
    }
  }

  /**
   * Compare two input objects for equality.
   * Inputs use joy format: { joy: { dx, dy, active, mag } }.
   * Quantized to 2dp (dx/dy) and 1dp (mag) to avoid float drift.
   *
   * @private
   */
  _inputsEqual(a, b) {
    if (!a || !b) return a === b;
    const aq = this._quantizeJoy(a.joy), bq = this._quantizeJoy(b.joy);
    if (aq.active !== bq.active) return false;
    if (!aq.active) return true; // both inactive — direction doesn't matter
    return aq.dx === bq.dx && aq.dy === bq.dy && aq.mag === bq.mag;
  }

  /**
   * Create a neutral input (no movement).
   *
   * @private
   */
  _neutralInput() {
    return { joy: { dx: 0, dy: 0, active: false, mag: 0 } };
  }

  /**
   * Quantize a raw joy value to stable, comparable scalars.
   * dx/dy rounded to 2dp; mag rounded to 1dp.
   * Returns a neutral record if joy is missing or inactive.
   *
   * @private
   */
  _quantizeJoy(joy) {
    if (!joy || !joy.active) return { active: false, dx: 0, dy: 0, mag: 0 };
    return {
      active: true,
      dx:  Math.round((joy.dx  || 0) * 100) / 100,
      dy:  Math.round((joy.dy  || 0) * 100) / 100,
      mag: Math.round((joy.mag || 0) * 10)  / 10,
    };
  }

  /**
   * Debug: get coordinator state summary.
   */
  summary() {
    return {
      currentTick: this.currentTick,
      bufferSize: this.buffer.size(),
      localInputCount: this._countLive(this.localInputHistory),
      remoteInputCount: this._countLive(this.remoteInputHistory),
      pendingPredictions: this._countLive(this.remotePredictions),
    };
  }

  /**
   * R4: number of ticks since the freshest received remote input.
   * Returns Infinity if no remote input has ever been received.
   * Used by callers (and step()'s stalled flag) to gauge prediction risk.
   */
  getRemoteAgeTicks() {
    if (this._lastReceivedRemoteTick < 0) return Infinity;
    return Math.max(0, this.currentTick - 1 - this._lastReceivedRemoteTick);
  }

  /**
   * R4: telemetry snapshot. Counters accumulate over the coordinator's
   * lifetime; sizes reflect current state.
   */
  getStats() {
    return {
      ...this._stats,
      currentTick: this.currentTick,
      bufferCapacity: this.bufferCapacity,
      maxRollbackTicks: this.maxRollbackTicks,
      lastReceivedRemoteTick: this._lastReceivedRemoteTick,
      remoteAgeTicks: this.getRemoteAgeTicks(),
      historySize: {
        local: this._countLive(this.localInputHistory),
        remote: this._countLive(this.remoteInputHistory),
        predictions: this._countLive(this.remotePredictions),
      },
    };
  }

  /**
   * R4: detach the remote-input listener and drop references.
   * Safe to call multiple times. After dispose(), step() should not be
   * invoked — the coordinator is effectively dead.
   */
  dispose() {
    if (this._remoteUnsub) {
      try { this._remoteUnsub(); } catch (err) {
        this.logger?.('RollbackCoordinator: dispose unsub failed', err);
      }
      this._remoteUnsub = null;
    }
  }

  _countLive(arr) {
    let n = 0;
    for (let i = 0; i < arr.length; i++) if (arr[i]) n++;
    return n;
  }
}
