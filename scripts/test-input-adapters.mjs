#!/usr/bin/env node
// Phase C2c — Input adapter contract tests.
// Verifies host (joystick) and arrow-keys adapters return uniform move vectors.

import assert from 'node:assert/strict';
import {
  createHostInputAdapter,
  createArrowKeysInputAdapter,
  createNullInputAdapter,
} from '../src/core/inputAdapters.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS', name); passed++; }
  catch (e) { console.error('FAIL', name, '\n  ', e.message); failed++; }
}

test('host adapter inactive when joystick off', () => {
  const joy = { active: false, mag: 0, dx: 0, dy: 0, max: 60 };
  const a = createHostInputAdapter(joy);
  const v = a.moveVector();
  assert.equal(v.active, false);
  assert.equal(v.t, 0);
  assert.equal(a.isStill(), true);
});

test('host adapter active past deadzone scales t 0..1', () => {
  const joy = { active: true, mag: 60, dx: 1, dy: 0, max: 60 };
  const a = createHostInputAdapter(joy);
  const v = a.moveVector();
  assert.equal(v.active, true);
  assert.ok(v.t > 0 && v.t <= 1, `t out of range: ${v.t}`);
  assert.equal(v.dx, 1);
  assert.equal(v.dy, 0);
  assert.equal(a.isStill(), false);
});

test('host adapter t saturates at 1 when mag >= max', () => {
  const joy = { active: true, mag: 999, dx: 0, dy: 1, max: 60 };
  const a = createHostInputAdapter(joy);
  assert.equal(a.moveVector().t, 1);
});

test('arrow-keys adapter inactive when no keys', () => {
  const keys = {};
  const a = createArrowKeysInputAdapter(keys);
  const v = a.moveVector();
  assert.equal(v.active, false);
  assert.equal(a.isStill(), true);
});

test('arrow-keys single direction: up', () => {
  const keys = { ArrowUp: true };
  const v = createArrowKeysInputAdapter(keys).moveVector();
  assert.equal(v.active, true);
  assert.equal(v.dx, 0);
  assert.equal(v.dy, -1);
  assert.equal(v.t, 1);
});

test('arrow-keys diagonal normalized to unit vector', () => {
  const keys = { ArrowRight: true, ArrowDown: true };
  const v = createArrowKeysInputAdapter(keys).moveVector();
  assert.equal(v.active, true);
  const mag = Math.hypot(v.dx, v.dy);
  assert.ok(Math.abs(mag - 1) < 1e-9, `expected unit vector, got mag=${mag}`);
  assert.ok(Math.abs(v.dx - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(v.dy - Math.SQRT1_2) < 1e-9);
});

test('arrow-keys opposing keys cancel', () => {
  const keys = { ArrowLeft: true, ArrowRight: true };
  const v = createArrowKeysInputAdapter(keys).moveVector();
  assert.equal(v.active, false);
  assert.equal(v.dx, 0);
  assert.equal(v.dy, 0);
});

test('null adapter always inactive', () => {
  const a = createNullInputAdapter();
  assert.equal(a.moveVector().active, false);
  assert.equal(a.isStill(), true);
});

console.log(`\nInput-adapter suite: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
