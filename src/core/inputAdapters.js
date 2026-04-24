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
// them back to the moveVector contract. If no frame is available for the
// current tick, returns an inactive/stall vector — the lockstep gate (C3a-
// core-3) prevents the sim from advancing past a missing tick, so this
// fallback should rarely fire in a healthy run.
//
// Dequantization:
//   dx = frame.dx / 127   (inverse of Math.round(v * 127))
//   dy = frame.dy / 127
//   t  = frame.t  / 255
function createRemoteInputAdapter(ringBuffer, { getCurrentTick } = {}) {
  if (!ringBuffer || typeof ringBuffer.peekAt !== 'function') {
    throw new Error('createRemoteInputAdapter: ringBuffer required');
  }
  if (typeof getCurrentTick !== 'function') {
    throw new Error('createRemoteInputAdapter: getCurrentTick required');
  }
  // D11 — tick-tolerant lookup. Try exact tick match first (deterministic
  // path used by the host-remote-input processor), then fall back to the
  // newest frame at-or-before the requested tick (for when host's simTick
  // has drifted past available frames — e.g. out-of-sync start, network
  // jitter, post-pause resume). If the host is BEHIND any buffered frame
  // (peekLatestUpTo returns null), use the oldest available frame so slot 1
  // still moves while ticks catch up. Without this fallback chain, slot 1
  // freezes whenever the two simTick clocks diverge by more than one frame.
  function selectFrame() {
    const t = getCurrentTick();
    let frame = ringBuffer.peekAt(t);
    if (frame) return frame;
    if (typeof ringBuffer.peekLatestUpTo === 'function') {
      frame = ringBuffer.peekLatestUpTo(t);
      if (frame) return frame;
    }
    if (typeof ringBuffer.peekOldest === 'function') {
      frame = ringBuffer.peekOldest();
      if (frame) return frame;
    }
    return null;
  }
  return {
    kind: 'remote',
    moveVector() {
      const frame = selectFrame();
      if (!frame) return { dx: 0, dy: 0, t: 0, active: false };
      return {
        dx: frame.dx / 127,
        dy: frame.dy / 127,
        t: frame.t / 255,
        active: frame.still === 0,
      };
    },
    isStill() {
      const frame = selectFrame();
      if (!frame) return true;
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
