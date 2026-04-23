#!/usr/bin/env node
// Phase C2a — Player-slot bundle contract tests.
// Verifies:
//  - createPlayerSlot validates inputs and freezes the result
//  - body/upg getters reflect the CURRENT singleton (reassignment-safe)
//  - metrics/timers/aim getter-setter bridges round-trip through closure state
//  - registry helpers (register/get/reset/getActive) behave as expected
//
// Solo golden invariant (future C2b): once call-sites route through
// `slot.metrics.score`, `slot.timers.slipCooldown`, etc., these tests are
// the contract protecting solo play.

import assert from 'node:assert/strict';
import {
  createPlayerSlot,
  playerSlots,
  resetPlayerSlots,
  registerPlayerSlot,
  getPlayerSlot,
  getActiveSlots,
} from '../src/core/playerSlot.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS', name); passed++; }
  catch (e) { console.error('FAIL', name, '\n  ', e.message); failed++; }
}

test('createPlayerSlot requires integer id', () => {
  assert.throws(() => createPlayerSlot({}), /id must be a non-negative integer/);
  assert.throws(() => createPlayerSlot({ id: -1 }), /id must be a non-negative integer/);
  assert.throws(() => createPlayerSlot({ id: 1.5 }), /id must be a non-negative integer/);
});

test('createPlayerSlot requires getBody + getUpg functions', () => {
  assert.throws(() => createPlayerSlot({ id: 0 }), /getBody/);
  assert.throws(() => createPlayerSlot({ id: 0, getBody: () => ({}) }), /getUpg/);
});

test('createPlayerSlot requires metrics/timers/aim objects', () => {
  const base = { id: 0, getBody: () => ({}), getUpg: () => ({}) };
  assert.throws(() => createPlayerSlot({ ...base }), /metrics/);
  assert.throws(() => createPlayerSlot({ ...base, metrics: {} }), /timers/);
  assert.throws(() => createPlayerSlot({ ...base, metrics: {}, timers: {} }), /aim/);
});

test('createPlayerSlot returns frozen object', () => {
  const slot = createPlayerSlot({
    id: 0,
    getBody: () => ({}),
    getUpg: () => ({}),
    metrics: {},
    timers: {},
    aim: {},
  });
  assert.ok(Object.isFrozen(slot));
  assert.throws(() => { slot.id = 99; }); // cannot reassign id
});

test('body/upg getters reflect latest singleton (reassignment-safe)', () => {
  let player = { x: 1, y: 2 };
  let UPG = { shotSize: 1 };
  const slot = createPlayerSlot({
    id: 0,
    getBody: () => player,
    getUpg: () => UPG,
    metrics: {},
    timers: {},
    aim: {},
  });
  assert.equal(slot.body.x, 1);
  assert.equal(slot.upg.shotSize, 1);
  // Reassign singletons as script.js does on new run / room reset:
  player = { x: 99, y: 42 };
  UPG = { shotSize: 2.5, voidWalker: true };
  assert.equal(slot.body.x, 99, 'body getter must follow reassignment');
  assert.equal(slot.upg.voidWalker, true, 'upg getter must follow reassignment');
});

test('metrics/timers/aim bridges round-trip through closure', () => {
  let score = 0;
  let slipCooldown = 0;
  let aimAngle = 0;
  const metrics = {
    get score() { return score; },
    set score(v) { score = v; },
  };
  const timers = {
    get slipCooldown() { return slipCooldown; },
    set slipCooldown(v) { slipCooldown = v; },
  };
  const aim = {
    get angle() { return aimAngle; },
    set angle(v) { aimAngle = v; },
  };
  const slot = createPlayerSlot({
    id: 0,
    getBody: () => ({}),
    getUpg: () => ({}),
    metrics, timers, aim,
  });
  slot.metrics.score = 500;
  slot.timers.slipCooldown = 1.2;
  slot.aim.angle = Math.PI;
  assert.equal(score, 500);
  assert.equal(slipCooldown, 1.2);
  assert.equal(aimAngle, Math.PI);
});

test('registry: register/get/reset/getActive', () => {
  resetPlayerSlots();
  assert.equal(playerSlots.length, 0);
  assert.equal(getPlayerSlot(0), null);
  const slot = createPlayerSlot({
    id: 0,
    getBody: () => ({}), getUpg: () => ({}),
    metrics: {}, timers: {}, aim: {},
  });
  registerPlayerSlot(slot);
  assert.equal(getPlayerSlot(0), slot);
  assert.equal(getActiveSlots().length, 1);
  assert.throws(() => registerPlayerSlot({}), /integer id/);
  resetPlayerSlots();
  assert.equal(playerSlots.length, 0);
});

test('registry supports sparse ids (slot 1 without slot 0 during rebuild)', () => {
  resetPlayerSlots();
  const guest = createPlayerSlot({
    id: 1,
    getBody: () => ({}), getUpg: () => ({}),
    metrics: {}, timers: {}, aim: {},
  });
  registerPlayerSlot(guest);
  assert.equal(getPlayerSlot(0), null);
  assert.equal(getPlayerSlot(1), guest);
  assert.equal(getActiveSlots().length, 1); // filter(Boolean) skips the hole
});

console.log(`\nPlayer-slot suite: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
