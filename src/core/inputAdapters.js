// Phase C2c — Input adapter abstraction.
// Each slot's movement/aim/fire decisions read from an input adapter that
// exposes a uniform API: `moveVector()` + `isStill()`. This lets the main-
// loop movement helper treat slot 0 (touch/mouse joystick) and slot 1
// (arrow-keys) identically.
//
// moveVector() returns { dx, dy, t, active } where:
//   dx, dy: unit-vector direction (0 if inactive)
//   t: speed scale 0..1 (host: joystick magnitude past deadzone; keys: 1 when any held)
//   active: true if the player is moving this frame

import { JOY_DEADZONE, JOY_MAX } from '../input/joystick.js';

function createHostInputAdapter(joy) {
  return {
    kind: 'host',
    moveVector() {
      if (!joy.active || joy.mag <= JOY_DEADZONE) {
        return { dx: 0, dy: 0, t: 0, active: false };
      }
      const joyMax = joy.max || JOY_MAX;
      const t = Math.min((joy.mag - JOY_DEADZONE) / (joyMax - JOY_DEADZONE), 1);
      return { dx: joy.dx, dy: joy.dy, t, active: true };
    },
    isStill() {
      return !joy.active || joy.mag <= JOY_DEADZONE;
    },
  };
}

// Minimal key state interface: `{ ArrowUp, ArrowDown, ArrowLeft, ArrowRight }`
// (booleans for "held right now"). Host code owns the DOM listeners that
// populate this object.
function createArrowKeysInputAdapter(keyState) {
  return {
    kind: 'arrow-keys',
    moveVector() {
      let dx = 0, dy = 0;
      if (keyState.ArrowLeft)  dx -= 1;
      if (keyState.ArrowRight) dx += 1;
      if (keyState.ArrowUp)    dy -= 1;
      if (keyState.ArrowDown)  dy += 1;
      const mag = Math.hypot(dx, dy);
      if (mag === 0) return { dx: 0, dy: 0, t: 0, active: false };
      return { dx: dx / mag, dy: dy / mag, t: 1, active: true };
    },
    isStill() {
      return !keyState.ArrowLeft && !keyState.ArrowRight
          && !keyState.ArrowUp && !keyState.ArrowDown;
    },
  };
}

// Null adapter for slots that shouldn't move (e.g., spectators, remote peers
// before input arrives). Always inactive.
function createNullInputAdapter() {
  return {
    kind: 'null',
    moveVector() { return { dx: 0, dy: 0, t: 0, active: false }; },
    isStill() { return true; },
  };
}

// Phase C3a-core-2 — Remote input adapter.
//
// Reads quantized frames from a remoteInputBuffer ring buffer and dequantizes
// them back to the moveVector contract. If no fresh frame is available for the
// current tick, returns a stale/no-signal vector (active=false, isStill=false)
// so the consumer can suppress autofire instead of locking on a stale still=1
// frame.
//
// D12 — staleness guard. Previously, a missing exact-tick match would either
// freeze slot 1 (pre-D11) or, with D11's peekOldest fallback, return a
// possibly-ancient still=1 frame which made the host's slot 1 autofire
// continuously even though the guest had moved on. Now: if the best matching
// frame is more than STALE_TICK_THRESHOLD ticks behind the requested tick (or
// no frame exists at all), we report `stale: true` and `active: false` so
// updateGuestFire can skip charging+firing during gaps. Movement zeroes out
// for the gap; consumers that want to lerp through gaps can read `stale`.
//
// Dequantization:
//   dx = frame.dx / 127   (inverse of Math.round(v * 127))
//   dy = frame.dy / 127
//   t  = frame.t  / 255
const STALE_TICK_THRESHOLD = 12; // ~200 ms at 60 Hz; tolerates a 4-frame batch + jitter

function createRemoteInputAdapter(ringBuffer, { getCurrentTick, staleTickThreshold = STALE_TICK_THRESHOLD } = {}) {
  if (!ringBuffer || typeof ringBuffer.peekAt !== 'function') {
    throw new Error('createRemoteInputAdapter: ringBuffer required');
  }
  if (typeof getCurrentTick !== 'function') {
    throw new Error('createRemoteInputAdapter: getCurrentTick required');
  }
  // D11/D12 — tick-tolerant lookup with staleness guard.
  // Returns { frame, stale } where:
  //   frame: best-effort frame to use (newest ≤ tick, then oldest, then null)
  //   stale: true when no frame is "fresh" — caller should suppress autofire,
  //          stop motion, etc. Determinism path (hostRemoteInputProcessor)
  //          uses peekAt directly and is unaffected.
  function selectFrame() {
    const t = getCurrentTick();
    const exact = ringBuffer.peekAt(t);
    if (exact) return { frame: exact, stale: false };
    let frame = null;
    if (typeof ringBuffer.peekLatestUpTo === 'function') {
      frame = ringBuffer.peekLatestUpTo(t);
    }
    if (!frame && typeof ringBuffer.peekOldest === 'function') {
      frame = ringBuffer.peekOldest();
    }
    if (!frame) return { frame: null, stale: true };
    const ageTicks = Math.abs(t - frame.tick);
    return { frame, stale: ageTicks > staleTickThreshold };
  }
  return {
    kind: 'remote',
    moveVector() {
      const { frame, stale } = selectFrame();
      if (!frame || stale) {
        return { dx: 0, dy: 0, t: 0, active: false, stale: true };
      }
      return {
        dx: frame.dx / 127,
        dy: frame.dy / 127,
        t: frame.t / 255,
        active: frame.still === 0,
        stale: false,
      };
    },
    isStill() {
      const { frame, stale } = selectFrame();
      // No fresh signal: report not-still so autofire callers (which trigger
      // on `isStill === true`) don't fire on stale data.
      if (!frame || stale) return false;
      return frame.still === 1;
    },
  };
}

export {
  createHostInputAdapter,
  createArrowKeysInputAdapter,
  createNullInputAdapter,
  createRemoteInputAdapter,
};
