/**
 * R0.4 Chunk 1 — Player movement (input → velocity).
 * R0.4 Chunk 2 — Substep position integration with obstacle handling.
 *
 * Pure helpers extracted from script.js update() so that:
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

/**
 * Number of substeps to use for a body moving at (vx, vy) over dt.
 * Caps at 10 substeps and at most 8 px of travel per substep.
 * Mirrors the inline expression that lived at script.js:5444.
 */
export function computeSubsteps(vx, vy, dt, maxStepPx = 8, maxSteps = 10) {
  const travel = Math.hypot(vx, vy) * dt;
  return Math.min(maxSteps, Math.max(1, Math.ceil(travel / maxStepPx)));
}

/**
 * Advance a body's position in deterministic substeps with obstacle handling.
 *
 * The substep loop has the same shape as the inline code that lived at
 * script.js:5447-5470. Movement is clamped to the world margin, then
 * handed to one of three branches:
 *   1. phaseWalk OFF → resolve obstacle collisions every substep.
 *   2. phaseWalk ON, body overlapping obstacle → accumulate overlap/idle
 *      timers and eject when either threshold trips.
 *   3. phaseWalk ON, body clear → reset overlap/idle timers.
 *
 * @param {object} body                      Mutable body. Reads vx/vy/r;
 *                                           mutates x/y/phaseWalkOverlapMs/phaseWalkIdleMs.
 * @param {number} dt                        Frame timestep (s).
 * @param {object} world                     World bounds.
 * @param {number} world.W                   World width (px).
 * @param {number} world.H                   World height (px).
 * @param {number} world.M                   Margin (px).
 * @param {object} opts
 * @param {boolean} opts.phaseWalk           Whether phaseWalk boon is active.
 * @param {number}  opts.phaseWalkMaxOverlapMs   Eject after this much overlap.
 * @param {number}  opts.phaseWalkIdleEjectMs    Eject after this much idle overlap.
 * @param {(body:object) => void} opts.resolveCollisions
 *                                           Resolves body vs static obstacles.
 * @param {(body:object) => boolean} opts.isOverlapping
 *                                           Returns true if body penetrates an obstacle.
 * @param {(body:object) => void} opts.eject Force-pushes body out of any overlap.
 *
 * Returns the number of substeps run.
 */
export function tickBodyPosition(body, dt, world, opts) {
  const { W, H, M } = world;
  const r = body.r;
  const steps = computeSubsteps(body.vx, body.vy, dt);
  const stepDt = dt / steps;
  const isMoving = Math.hypot(body.vx, body.vy) > 12;

  for (let step = 0; step < steps; step++) {
    body.x = Math.max(M + r, Math.min(W - M - r, body.x + body.vx * stepDt));
    body.y = Math.max(M + r, Math.min(H - M - r, body.y + body.vy * stepDt));
    if (!opts.phaseWalk) {
      opts.resolveCollisions(body);
      body.phaseWalkOverlapMs = 0;
      body.phaseWalkIdleMs = 0;
    } else if (opts.isOverlapping(body)) {
      body.phaseWalkOverlapMs += stepDt * 1000;
      if (isMoving) body.phaseWalkIdleMs = 0;
      else body.phaseWalkIdleMs += stepDt * 1000;
      if (
        body.phaseWalkOverlapMs >= opts.phaseWalkMaxOverlapMs
        || body.phaseWalkIdleMs >= opts.phaseWalkIdleEjectMs
      ) {
        opts.eject(body);
        body.phaseWalkOverlapMs = 0;
        body.phaseWalkIdleMs = 0;
      }
    } else {
      body.phaseWalkOverlapMs = 0;
      body.phaseWalkIdleMs = 0;
    }
  }
  return steps;
}

export default applyJoystickVelocity;
