/**
 * R3 Host Sim Step
 *
 * Deterministic sim step for rollback-based coop. Mutates simState in place.
 *
 * Signature: hostSimStep(state, slot0Input, slot1Input, dt, opts?)
 *
 * Population strategy: this function is built up chunk by chunk during R0.4.
 * Each chunk (player movement → timers/shields/orbs → bullets → enemies →
 * collisions) is added here AND extracted out of script.js's update() in the
 * same commit, so the two paths stay equivalent. The black-box replay test
 * (scripts/test-sim-replay.mjs) drives hostSimStep through N ticks with a
 * deterministic input stream and asserts byte-identity across runs — this
 * is the gate that catches non-determinism the moment a chunk lands.
 *
 * Currently wired:
 *   - R0.4 chunks 1+2: player movement (joystick → velocity, position
 *     integration with substeps + phase-walk obstacle handling).
 *   - R0.4 step 3: post-movement deterministic decrements (body transients,
 *     shield array sync, slot timer block, volatile orb cooldowns).
 *   - R0.4 step 5 (clock seam): state.tick and state.timeMs advance per call.
 *     Reads world dims from state.world.{w,h} with legacy state.worldW/H
 *     fallback for callers that haven't migrated yet. Required prerequisite
 *     for any bullet/enemy carve-out: those regions read `ts` for decay,
 *     expireAt, orb/shield rotation, mirror cooldowns. Sourcing that from
 *     state.timeMs (vs. performance.now) is what makes them rollback-safe.
 *
 *   - R3.3: enemy combat state (movement archetypes, fire timers, projectile
 *     spawn, siphon charge drain) during rollback resim.
 */
import { applyJoystickVelocity, tickBodyPosition } from './playerMovement.js';
import { tickPostMovementTimers } from './postMovementTick.js';
import { tickBulletsKinematic } from './bulletKinematic.js';
import { resolveDangerHits } from './dangerHitDispatch.js';
import { resolveOutputHits } from './outputHitDispatch.js';
import { tickEnemyCombat } from './enemyCombatStep.js';

const NOOP = () => {};
const FALSE_FN = () => false;

/**
 * @param {object} state - SimState (mutated in-place)
 * @param {object|null} slot0Input - { joy: {dx,dy,active,max?}, ... } or null
 * @param {object|null} slot1Input - same shape, for coop slot
 * @param {number} dt - timestep in seconds
 * @param {object} [opts] - sim config + obstacle helpers (see below)
 *
 * opts fields (with defaults):
 *   baseSpeed=200, deadzone=0.15, joyMax=60, gate=true,
 *   worldW=state.world.w||state.worldW||800,
 *   worldH=state.world.h||state.worldH||600, margin=16,
 *   phaseWalk=false, phaseWalkMaxOverlapMs=500, phaseWalkIdleEjectMs=250,
 *   resolveCollisions=noop, isOverlapping=()=>false, eject=noop.
 */
export function hostSimStep(state, slot0Input, slot1Input, dt, opts = {}) {
  const baseSpeed = opts.baseSpeed != null ? opts.baseSpeed : 200;
  const deadzone = opts.deadzone != null ? opts.deadzone : 0.15;
  const joyMax = opts.joyMax != null ? opts.joyMax : 60;
  const gate = opts.gate !== false;
  // R0.4 step 5: prefer state.world.{w,h} (the canonical sim shape); fall
  // back to legacy state.worldW/H so older callers don't regress.
  const stateWorld = state.world || {};
  const worldW = opts.worldW != null
    ? opts.worldW
    : (stateWorld.w || state.worldW || 800);
  const worldH = opts.worldH != null
    ? opts.worldH
    : (stateWorld.h || state.worldH || 600);
  const margin = opts.margin != null ? opts.margin : 16;
  const phaseOpts = {
    phaseWalk: !!opts.phaseWalk,
    phaseWalkMaxOverlapMs: opts.phaseWalkMaxOverlapMs != null ? opts.phaseWalkMaxOverlapMs : 500,
    phaseWalkIdleEjectMs: opts.phaseWalkIdleEjectMs != null ? opts.phaseWalkIdleEjectMs : 250,
    resolveCollisions: opts.resolveCollisions || NOOP,
    isOverlapping: opts.isOverlapping || FALSE_FN,
    eject: opts.eject || NOOP,
  };
  const world = { W: worldW, H: worldH, M: margin };

  const slot0 = state.slots && state.slots[0];
  if (slot0 && slot0.body) {
    const joy0 = slot0Input && slot0Input.joy;
    applyJoystickVelocity(slot0.body, joy0, baseSpeed, deadzone, joyMax, gate);
    tickBodyPosition(slot0.body, dt, world, phaseOpts);
    tickPostMovementTimers(
      slot0.body,
      slot0.shields,
      slot0.timers,
      slot0.orbState && slot0.orbState.cooldowns,
      dt,
      {
        shieldTier: (slot0.upg && slot0.upg.shieldTier) | 0,
        shieldTempered: !!(slot0.upg && slot0.upg.shieldTempered),
        colossusActive: !!(slot0.upg && slot0.upg.colossus),
      }
    );
  }

  const slot1 = state.slots && state.slots[1];
  if (slot1 && slot1.body) {
    const joy1 = slot1Input && slot1Input.joy;
    applyJoystickVelocity(slot1.body, joy1, baseSpeed, deadzone, joyMax, gate);
    tickBodyPosition(slot1.body, dt, world, phaseOpts);
    tickPostMovementTimers(
      slot1.body,
      slot1.shields,
      slot1.timers,
      slot1.orbState && slot1.orbState.cooldowns,
      dt,
      {
        shieldTier: (slot1.upg && slot1.upg.shieldTier) | 0,
        shieldTempered: !!(slot1.upg && slot1.upg.shieldTempered),
        colossusActive: !!(slot1.upg && slot1.upg.colossus),
      }
    );
  }

  // R3.3 — enemy combat resim: movement archetypes + fire cadence/projectiles.
  tickEnemyCombat(state, dt, opts);
  // R2 — kinematic resim: advance bullet positions + wall bounce + expiry.
  // Enemy bullets spawned above move during the same tick, matching script.js.
  tickBulletsKinematic(state, dt);
  // R3.1 — combat resim: danger projectiles can damage player slots.
  resolveDangerHits(state, opts);
  // R3.2 — combat resim: output projectiles can damage/kill enemies.
  resolveOutputHits(state, opts);

  // R0.4 step 5: advance the deterministic sim clock LAST, after all per-tick
  // logic above has read the pre-tick values. Bullet/enemy carve-outs landing
  // later will read state.timeMs at the TOP of their region (matching the
  // legacy update() which captures `ts = performance.now()` at the top of the
  // frame), so post-increment keeps semantics aligned: the tick that just ran
  // saw timeMs=N; the next tick will see timeMs=N+dtMs.
  if (typeof state.tick === 'number') state.tick = (state.tick | 0) + 1;
  if (typeof state.timeMs === 'number') state.timeMs += dt * 1000;
}

export default hostSimStep;

