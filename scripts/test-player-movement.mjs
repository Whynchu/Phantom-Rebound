#!/usr/bin/env node
/**
 * R0.4 Chunk 1 — playerMovement.js unit tests.
 *
 * Locks the joystick→velocity math against the original inline
 * expression so that any future refactor / rollback resim path
 * matches the live game byte-for-byte.
 */
import { strict as assert } from 'node:assert';
import {
  applyJoystickVelocity,
  joystickIntensity,
  computeSubsteps,
  tickBodyPosition,
} from '../src/sim/playerMovement.js';

let pass = 0;
let fail = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (err) { console.log(`  ✗ ${name}\n    ${err.message}`); fail++; }
}

console.log('playerMovement — joystickIntensity');
t('zero at deadzone', () => {
  assert.equal(joystickIntensity(20, 20, 100), 0);
});
t('one at joyMax', () => {
  assert.equal(joystickIntensity(100, 20, 100), 1);
});
t('clamps above joyMax', () => {
  assert.equal(joystickIntensity(500, 20, 100), 1);
});
t('linear midpoint', () => {
  // (60 - 20) / (100 - 20) = 0.5
  assert.equal(joystickIntensity(60, 20, 100), 0.5);
});

console.log('\nplayerMovement — applyJoystickVelocity');
t('zeros when gate=false', () => {
  const body = { vx: 99, vy: -99 };
  const moved = applyJoystickVelocity(body, { active: true, mag: 80, dx: 1, dy: 0 }, 165, 20, 100, false);
  assert.equal(moved, false);
  assert.equal(body.vx, 0);
  assert.equal(body.vy, 0);
});
t('zeros when joystick inactive', () => {
  const body = { vx: 99, vy: -99 };
  applyJoystickVelocity(body, { active: false, mag: 80, dx: 1, dy: 0 }, 165, 20, 100);
  assert.equal(body.vx, 0);
  assert.equal(body.vy, 0);
});
t('zeros when below deadzone', () => {
  const body = { vx: 99, vy: -99 };
  applyJoystickVelocity(body, { active: true, mag: 15, dx: 1, dy: 0 }, 165, 20, 100);
  assert.equal(body.vx, 0);
  assert.equal(body.vy, 0);
});
t('zeros when joy is null', () => {
  const body = { vx: 99, vy: -99 };
  applyJoystickVelocity(body, null, 165, 20, 100);
  assert.equal(body.vx, 0);
  assert.equal(body.vy, 0);
});
t('matches inline expression at full tilt', () => {
  // Replicates script.js:5441-5444 byte-for-byte.
  const joy = { active: true, mag: 100, dx: 0.6, dy: -0.8 };
  const BASE_SPD = 165;
  const DEAD = 20;
  const MAX = 100;

  const expected_t = Math.min((joy.mag - DEAD) / (MAX - DEAD), 1);
  const expectedVx = joy.dx * BASE_SPD * expected_t;
  const expectedVy = joy.dy * BASE_SPD * expected_t;

  const body = { vx: 0, vy: 0 };
  applyJoystickVelocity(body, joy, BASE_SPD, DEAD, MAX);
  assert.equal(body.vx, expectedVx);
  assert.equal(body.vy, expectedVy);
});
t('returns true when joystick produces motion', () => {
  const body = { vx: 0, vy: 0 };
  const moved = applyJoystickVelocity(body, { active: true, mag: 80, dx: 1, dy: 0 }, 165, 20, 100);
  assert.equal(moved, true);
});

console.log('\nplayerMovement — computeSubsteps');
t('clamps to 1 when stationary', () => {
  assert.equal(computeSubsteps(0, 0, 1 / 60), 1);
});
t('clamps to maxSteps when very fast', () => {
  assert.equal(computeSubsteps(99999, 0, 1 / 60), 10);
});
t('produces ceil(travel / 8) substeps in normal range', () => {
  // travel = hypot(300,0)*0.05 = 15 → ceil(15/8) = 2
  assert.equal(computeSubsteps(300, 0, 0.05), 2);
});

console.log('\nplayerMovement — tickBodyPosition');
t('integrates position with no obstacles, phaseWalk off', () => {
  const body = { x: 100, y: 100, vx: 60, vy: 0, r: 10, phaseWalkOverlapMs: 0, phaseWalkIdleMs: 0 };
  const calls = { resolve: 0, overlap: 0, eject: 0 };
  const steps = tickBodyPosition(body, 1 / 60, { W: 1000, H: 1000, M: 10 }, {
    phaseWalk: false,
    phaseWalkMaxOverlapMs: 1000,
    phaseWalkIdleEjectMs: 120,
    resolveCollisions: () => { calls.resolve++; },
    isOverlapping: () => { calls.overlap++; return false; },
    eject: () => { calls.eject++; },
  });
  // 1 substep, position advanced by vx*dt = 1
  assert.equal(steps, 1);
  assert.ok(Math.abs(body.x - 101) < 1e-9, `x=${body.x}`);
  assert.equal(body.y, 100);
  assert.equal(calls.resolve, 1);
  assert.equal(calls.overlap, 0); // phaseWalk=false skips this
  assert.equal(calls.eject, 0);
});
t('clamps to world bounds at left edge', () => {
  const body = { x: 15, y: 100, vx: -5000, vy: 0, r: 10, phaseWalkOverlapMs: 0, phaseWalkIdleMs: 0 };
  tickBodyPosition(body, 1 / 60, { W: 1000, H: 1000, M: 10 }, {
    phaseWalk: false,
    phaseWalkMaxOverlapMs: 1000,
    phaseWalkIdleEjectMs: 120,
    resolveCollisions: () => {},
    isOverlapping: () => false,
    eject: () => {},
  });
  assert.equal(body.x, 20); // M + r
});
t('phaseWalk: accumulates overlap and ejects past threshold', () => {
  const body = { x: 100, y: 100, vx: 0, vy: 0, r: 10, phaseWalkOverlapMs: 0, phaseWalkIdleMs: 0 };
  let ejected = 0;
  // dt = 1.5s, 1 substep (no movement) → overlap += 1500ms ≥ 1000ms threshold → eject
  tickBodyPosition(body, 1.5, { W: 1000, H: 1000, M: 10 }, {
    phaseWalk: true,
    phaseWalkMaxOverlapMs: 1000,
    phaseWalkIdleEjectMs: 120,
    resolveCollisions: () => {},
    isOverlapping: () => true,
    eject: () => { ejected++; },
  });
  assert.equal(ejected, 1);
  assert.equal(body.phaseWalkOverlapMs, 0); // reset after eject
});
t('phaseWalk: idle threshold ejects even when overlap is low', () => {
  const body = { x: 100, y: 100, vx: 0, vy: 0, r: 10, phaseWalkOverlapMs: 0, phaseWalkIdleMs: 0 };
  let ejected = 0;
  // dt = 0.2s = 200ms idle ≥ 120ms threshold → eject
  tickBodyPosition(body, 0.2, { W: 1000, H: 1000, M: 10 }, {
    phaseWalk: true,
    phaseWalkMaxOverlapMs: 1000,
    phaseWalkIdleEjectMs: 120,
    resolveCollisions: () => {},
    isOverlapping: () => true,
    eject: () => { ejected++; },
  });
  assert.equal(ejected, 1);
});
t('phaseWalk: clear body resets timers', () => {
  const body = { x: 100, y: 100, vx: 0, vy: 0, r: 10, phaseWalkOverlapMs: 999, phaseWalkIdleMs: 99 };
  tickBodyPosition(body, 1 / 60, { W: 1000, H: 1000, M: 10 }, {
    phaseWalk: true,
    phaseWalkMaxOverlapMs: 1000,
    phaseWalkIdleEjectMs: 120,
    resolveCollisions: () => {},
    isOverlapping: () => false,
    eject: () => {},
  });
  assert.equal(body.phaseWalkOverlapMs, 0);
  assert.equal(body.phaseWalkIdleMs, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
