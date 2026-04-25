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
// D12.3 — D12 used a symmetric staleness check (Math.abs(t - frame.tick)).
// That broke whenever the guest was AHEAD of the host (any pause on host
// — e.g. boon-select screen — that doesn't pause the guest puts guest
// ticks > host_simTick). All "future" frames were marked stale, freezing
// slot 1. Threshold also bumped from 12 (~200 ms) to 60 (~1 s) to
// tolerate normal cross-device frame-clock drift over long sessions.
const STALE_TICK_THRESHOLD = 60; // ~1 s at 60 Hz; tolerates room transitions + drift

function createRemoteInputAdapter(ringBuffer, { getCurrentTick, staleTickThreshold = STALE_TICK_THRESHOLD } = {}) {
  if (!ringBuffer || typeof ringBuffer.peekAt !== 'function') {
    throw new Error('createRemoteInputAdapter: ringBuffer required');
  }
  if (typeof getCurrentTick !== 'function') {
    throw new Error('createRemoteInputAdapter: getCurrentTick required');
  }
  // D11/D12/D12.3 — tick-tolerant lookup with one-sided staleness guard.
  // Returns { frame, stale } where:
  //   frame: best-effort frame to use:
  //     1. exact tick match (perfect)
  //     2. newest frame ≤ t   (host is on / ahead of guest — past frames age)
  //     3. newest frame > t   (host is BEHIND guest — future frames are fresh)
  //     4. null               (empty buffer)
  //   stale: true only when the chosen frame is more than `staleTickThreshold`
  //         ticks IN THE PAST relative to t. Future frames are never stale —
  //         they represent input the guest just sent, ahead of host's clock.
  function selectFrame() {
    const t = getCurrentTick();
    const exact = ringBuffer.peekAt(t);
    if (exact) return { frame: exact, stale: false };
    if (typeof ringBuffer.peekLatestUpTo === 'function') {
      const past = ringBuffer.peekLatestUpTo(t);
      if (past) {
        const ageTicks = t - past.tick; // always >= 0 here
        return { frame: past, stale: ageTicks > staleTickThreshold };
      }
    }
    // Buffer holds only future frames (guest ahead of host). Use the newest
    // — it's the most recent intent. Never stale: guest is actively sending.
    if (typeof ringBuffer.peekNewest === 'function') {
      const future = ringBuffer.peekNewest();
      if (future) return { frame: future, stale: false };
    }
    if (typeof ringBuffer.peekOldest === 'function') {
      const fallback = ringBuffer.peekOldest();
      if (fallback) return { frame: fallback, stale: false };
    }
    return { frame: null, stale: true };
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
