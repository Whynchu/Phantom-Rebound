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

export {
  createHostInputAdapter,
  createArrowKeysInputAdapter,
  createNullInputAdapter,
};
