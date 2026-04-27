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
 *   - R3.4: rusher contact damage during rollback resim (resolveRusherContactHits,
 *     called before tickBulletsKinematic so contact invuln gates same-tick bullet hits).
 */
import { applyJoystickVelocity, tickBodyPosition } from './playerMovement.js';
import { tickPostMovementTimers } from './postMovementTick.js';
import { tickBulletsKinematic } from './bulletKinematic.js';
import { resolveDangerHits, resolveRusherContactHits } from './dangerHitDispatch.js';
import { resolveOutputHits } from './outputHitDispatch.js';
import { tickEnemyCombat } from './enemyCombatStep.js';
import { resolveShieldCollisions } from './shieldCollisionStep.js';
import { resolveVolatileOrbHits } from './volatileOrbStep.js';
import { resolveOrbitSphereContactHits } from './orbitSphereContactStep.js';
import { resolveGreyAbsorbs } from './greyAbsorbStep.js';
import { resolveChargedOrbFires } from './chargedOrbStep.js';
import { tickPlayerFire } from './playerFireStep.js';
import { tickRoomState } from './roomStateStep.js';

const NOOP = () => {};
const FALSE_FN = () => false;

function applyAuthoritativeInputPosition(body, input, world, phaseOpts) {
  if (!body || !input) return;
  if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) return;
  body.x = Math.max(world.M + body.r, Math.min(world.W - world.M - body.r, input.x));
  body.y = Math.max(world.M + body.r, Math.min(world.H - world.M - body.r, input.y));
  try { phaseOpts.resolveCollisions(body); } catch (_) {}
}

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
  const phaseAtStart = state.run?.roomPhase || 'intro';
  const movementGate = gate && phaseAtStart !== 'intro';
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
    applyJoystickVelocity(slot0.body, joy0, baseSpeed, deadzone, joyMax, movementGate);
    tickBodyPosition(slot0.body, dt, world, phaseOpts);
    applyAuthoritativeInputPosition(slot0.body, slot0Input, world, phaseOpts);
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
    // P4: slot1 uses its own speedMult — matches updateGuestSlotMovement() in script.js.
    // opts.baseSpeedRaw is the pre-upg base speed (165 * GLOBAL_SPEED_LIFT); when provided
    // we apply slot1's own speedMult so each slot moves at its correct rate during resim.
    const slot1Speed = opts.baseSpeedRaw != null
      ? opts.baseSpeedRaw * Math.min(2.5, (slot1.upg && slot1.upg.speedMult) || 1)
      : baseSpeed;
    applyJoystickVelocity(slot1.body, joy1, slot1Speed, deadzone, joyMax, movementGate);
    tickBodyPosition(slot1.body, dt, world, phaseOpts);
    applyAuthoritativeInputPosition(slot1.body, slot1Input, world, phaseOpts);
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
  // R0.4-A: Room state machine — advances phase, spawns enemies.
  if (opts.spawnEnemy && state.run) {
    tickRoomState(state, dt, opts);
  }

  // The legacy host update() returns immediately after the READY/GO intro
  // state machine. Guest forward rollback must mirror that barrier exactly:
  // pre-spawned enemies render during READY, but no player movement, enemy AI,
  // bullets, combat, or auto-fire may advance until the next post-intro tick.
  if (phaseAtStart === 'intro') {
    if (typeof state.tick === 'number') state.tick = (state.tick | 0) + 1;
    if (typeof state.timeMs === 'number') state.timeMs += dt * 1000;
    return;
  }

  tickEnemyCombat(state, dt, opts);
  // R3 parity — charged orbs spend charge and fire output bullets during combat.
  resolveChargedOrbFires(state, slot0Input, { ...opts, dt });
  // R3.4 — rusher contact damage: must run BEFORE bullet kinematics so the
  // contact invuln set here gates same-tick projectile hits in resolveDangerHits.
  resolveRusherContactHits(state, opts);
  // R2 — kinematic resim: advance bullet positions + wall bounce + expiry.
  // Enemy bullets spawned above move during the same tick, matching script.js.
  tickBulletsKinematic(state, dt);
  // R3 parity — grey bullets decay and can be absorbed by player slots/orbs.
  resolveGreyAbsorbs(state, dt, opts);
  // R3 parity — volatile orbit spheres remove danger bullets before shields/player hits.
  resolveVolatileOrbHits(state, opts);
  // R3 parity — shields block/reflect danger bullets before player damage.
  resolveShieldCollisions(state, opts);
  // R3.1 — combat resim: danger projectiles can damage player slots.
  resolveDangerHits(state, opts);
  // R3 parity — orbit spheres damage/kill enemies before output bullets.
  resolveOrbitSphereContactHits(state, opts);
  // R3.2 — combat resim: output projectiles can damage/kill enemies.
  resolveOutputHits(state, opts);

  // R0.4-C/D: Player auto-fire — advances fireT, kinetic charge, spawns output bullets.
  {
    const combatActive = state.run?.roomPhase === 'spawning' || state.run?.roomPhase === 'fighting';
    tickPlayerFire(state, slot0Input, slot1Input, dt, { ...opts, combatActive });
  }

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

