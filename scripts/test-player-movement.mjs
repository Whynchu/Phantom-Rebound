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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
