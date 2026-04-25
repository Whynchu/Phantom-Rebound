/**
 * R0.4 Chunk 1 — Player movement (input → velocity).
 *
 * Pure helper extracted from script.js update() so that:
 *   1. The mapping from joystick input to body velocity is deterministic
 *      and unit-testable in isolation.
 *   2. RollbackCoordinator's hostSimStep can call the same code path the
 *      live game uses, guaranteeing byte-identical resim.
 *
 * No globals. No DOM. No render side-effects. Just math.
 */

/**
 * Compute joystick "intensity" t in [0, 1] given current magnitude.
 *
 * Below the deadzone t = 0 (caller should also gate). Above joyMax
 * the value is clamped to 1. Matches the inline expression that
 * lived at script.js:5442 byte-for-byte.
 */
export function joystickIntensity(mag, deadzone, joyMax) {
  return Math.min((mag - deadzone) / (joyMax - deadzone), 1);
}

/**
 * Apply joystick input to a body's velocity, in-place.
 *
 * @param {{vx:number, vy:number}} body         The body to mutate.
 * @param {object} joy                          Joystick state: { active, mag, dx, dy }.
 * @param {number} baseSpeed                    Final speed multiplier (px/s).
 * @param {number} deadzone                     Magnitude below which input is ignored.
 * @param {number} joyMax                       Magnitude that maps to t=1.
 * @param {boolean} [gate=true]                 External gate (e.g. roomPhase !== 'intro').
 *                                              When false, body is forced to (0, 0).
 *
 * Returns true if the joystick produced motion, false if the body was zeroed.
 */
export function applyJoystickVelocity(body, joy, baseSpeed, deadzone, joyMax, gate = true) {
  if (gate && joy && joy.active && joy.mag > deadzone) {
    const t = joystickIntensity(joy.mag, deadzone, joyMax);
    body.vx = joy.dx * baseSpeed * t;
    body.vy = joy.dy * baseSpeed * t;
    return true;
  }
  body.vx = 0;
  body.vy = 0;
  return false;
}

export default applyJoystickVelocity;
