// Phase D5e — Prediction reconciliation for the guest's own slot.
//
// Closes the prediction loop. D5d let the guest predict its own slot 1 body
// from local input, but predicted state can drift from host-authoritative
// state (numerical error, missed obstacle resolution, lag-induced ordering
// differences). Without correction, the predicted body slowly desyncs from
// where the host says it actually is.
//
// Reconciliation algorithm (Source-engine pattern):
//   1. Guest records every local input frame in a tick-keyed ring buffer.
//   2. Each authoritative snapshot carries:
//      - slots[1].x/y/vx/vy — host's view of slot 1 at snapshotSimTick.
//      - lastProcessedInputSeq[1] — the LAST GUEST TICK the host consumed.
//        (Despite the name, this is a sim-tick, not an input "sequence" —
//        named historically; see hostRemoteInputProcessor.js.)
//   3. To find "where prediction *should* be at the guest's current tick":
//      take auth state, replay inputs from lastProcessedInputSeq[1]+1
//      through the guest's current tick using the same prediction math.
//      This is the "corrected" position.
//   4. Compare corrected to the predicted body. If error > hardSnap, snap.
//      Otherwise close a fraction of the error each snapshot (soft pull) so
//      the body slides into agreement without visible jitter.
//
// Why this module owns ONLY history + replay:
//   - The threshold/snap policy and the body mutation live in script.js
//     (the caller knows the body, the constants, the world).
//   - Replay math is pure and trivial to unit-test in isolation.
//   - Obstacle resolution is intentionally NOT replayed in D5e v1: room
//     obstacle layouts depend on game state the reconciler doesn't have.
//     Drift near walls will be slightly larger but next snapshot's
//     correction handles it. World-bounds clamping IS replayed.
//
// Ring buffer:
//   Default capacity 240 ticks ≈ 4 seconds at 60 Hz. Snapshots arrive at
//   10 Hz so the worst case is 6 ticks of replay per snapshot — comfortable
//   margin even with packet loss.

const DEFAULT_CAPACITY = 240;

function createPredictionReconciler({
  capacity = DEFAULT_CAPACITY,
  worldBounds = null, // { left, right, top, bottom } or null
  speedPerSecond = 0,
} = {}) {
  if (!Number.isFinite(capacity) || capacity < 8) {
    throw new Error('createPredictionReconciler: capacity must be >= 8');
  }
  if (!Number.isFinite(speedPerSecond) || speedPerSecond <= 0) {
    throw new Error('createPredictionReconciler: speedPerSecond must be > 0');
  }

  // Tick-keyed slot map. Frame i lives at index (tick % capacity); we also
  // store the tick on the frame so a stale slot from the prior wrap is
  // detectable on read. Missing ticks (gaps from sample skip) are treated
  // as inactive during replay.
  const buffer = new Array(capacity).fill(null);

  function record(frame) {
    if (!frame || typeof frame.tick !== 'number') return;
    const tick = frame.tick >>> 0;
    const slot = tick % capacity;
    buffer[slot] = {
      tick,
      dx: typeof frame.dx === 'number' ? frame.dx : 0,
      dy: typeof frame.dy === 'number' ? frame.dy : 0,
      t: typeof frame.t === 'number' ? frame.t : 0,
      active: !!frame.active,
    };
  }

  function readAt(tick) {
    const t = tick >>> 0;
    const slot = t % capacity;
    const f = buffer[slot];
    if (!f || f.tick !== t) return null;
    return f;
  }

  // Replay the predicted body forward from auth state (at tick `fromTick`)
  // through `toTick` inclusive, applying inputs recorded at each tick > fromTick.
  // Math mirrors updateOnlineGuestPrediction in script.js: when the input is
  // active, vx/vy = dx*SPD*t / dy*SPD*t; otherwise vx=vy=0. World-bounds
  // clamp applied; obstacle collisions skipped (see header).
  //
  // Returns the corrected { x, y, vx, vy } at `toTick`. If toTick <= fromTick,
  // returns auth state unchanged. Inputs at missing ticks are treated as
  // inactive — same as a still player.
  function replay(authState, fromTick, toTick, dt, bodyR = 0) {
    if (!authState || typeof authState.x !== 'number') return null;
    if (!Number.isFinite(dt) || dt <= 0) {
      throw new Error('replay: dt must be > 0');
    }
    let x = authState.x;
    let y = authState.y;
    let vx = authState.vx || 0;
    let vy = authState.vy || 0;
    if (toTick <= fromTick) return { x, y, vx, vy };

    for (let tick = (fromTick >>> 0) + 1; tick <= (toTick >>> 0); tick++) {
      const f = readAt(tick);
      if (f && f.active) {
        vx = f.dx * speedPerSecond * f.t;
        vy = f.dy * speedPerSecond * f.t;
      } else {
        vx = 0;
        vy = 0;
      }
      x += vx * dt;
      y += vy * dt;
      if (worldBounds) {
        if (x < worldBounds.left + bodyR) x = worldBounds.left + bodyR;
        else if (x > worldBounds.right - bodyR) x = worldBounds.right - bodyR;
        if (y < worldBounds.top + bodyR) y = worldBounds.top + bodyR;
        else if (y > worldBounds.bottom - bodyR) y = worldBounds.bottom - bodyR;
      }
    }
    return { x, y, vx, vy };
  }

  function reset() {
    for (let i = 0; i < capacity; i++) buffer[i] = null;
  }

  function setWorldBounds(bounds) {
    worldBounds = bounds;
  }

  function getCapacity() { return capacity; }
  function getRecordedCount() {
    let n = 0;
    for (let i = 0; i < capacity; i++) if (buffer[i]) n++;
    return n;
  }

  return { record, replay, reset, setWorldBounds, getCapacity, getRecordedCount, readAt };
}

export { createPredictionReconciler };
