#!/usr/bin/env node
// Phase C2d-1a — Enemy-targeting unit tests.
// The real selector lives in script.js (closure over playerSlots + module
// hp/UPG). Here we test the algorithm in isolation against a minimal stub.

import assert from 'node:assert/strict';

function pickNearestSlot(enemy, slots) {
  let best = null;
  let bestDistSq = Infinity;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot) continue;
    const body = slot.body;
    if (!body || typeof body.x !== 'number') continue;
    if ((slot.metrics.hp || 0) <= 0) continue;
    const dx = body.x - enemy.x;
    const dy = body.y - enemy.y;
    const d2 = dx * dx + dy * dy;
    if (best === null || d2 < bestDistSq) { best = slot; bestDistSq = d2; }
    else if (d2 === bestDistSq && slot.id < best.id) { best = slot; }
  }
  return best;
}

function mkSlot(id, x, y, hp = 3) {
  return { id, body: { x, y, r: 9 }, metrics: { hp } };
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS', name); passed++; }
  catch (e) { console.error('FAIL', name, '\n  ', e.message); failed++; }
}

test('solo picks slot 0', () => {
  const slots = [mkSlot(0, 100, 100)];
  const result = pickNearestSlot({ x: 200, y: 200 }, slots);
  assert.equal(result.id, 0);
});

test('picks nearer slot over farther', () => {
  const slots = [mkSlot(0, 300, 300), mkSlot(1, 100, 100)];
  const result = pickNearestSlot({ x: 50, y: 50 }, slots);
  assert.equal(result.id, 1);
});

test('tie-break by id ASC when equidistant', () => {
  const slots = [mkSlot(0, 200, 100), mkSlot(1, 0, 100)];
  // enemy at (100,100) — both at distance 100
  const result = pickNearestSlot({ x: 100, y: 100 }, slots);
  assert.equal(result.id, 0, 'lower id should win tie');
});

test('dead slot is skipped', () => {
  const slots = [mkSlot(0, 100, 100, 0), mkSlot(1, 500, 500)];
  const result = pickNearestSlot({ x: 50, y: 50 }, slots);
  assert.equal(result.id, 1, 'skip dead slot 0 and target slot 1');
});

test('returns null if all slots dead', () => {
  const slots = [mkSlot(0, 100, 100, 0), mkSlot(1, 200, 200, 0)];
  const result = pickNearestSlot({ x: 0, y: 0 }, slots);
  assert.equal(result, null);
});

test('sparse slot array (slot 1 present, slot 0 missing) works', () => {
  const slots = [undefined, mkSlot(1, 100, 100)];
  const result = pickNearestSlot({ x: 0, y: 0 }, slots);
  assert.equal(result.id, 1);
});

test('slot with bad body is skipped', () => {
  const slots = [{ id: 0, body: null, metrics: { hp: 5 } }, mkSlot(1, 100, 100)];
  const result = pickNearestSlot({ x: 0, y: 0 }, slots);
  assert.equal(result.id, 1);
});

test('enemy exactly on slot 1 picks slot 1 over distant slot 0', () => {
  const slots = [mkSlot(0, 9999, 9999), mkSlot(1, 100, 100)];
  const result = pickNearestSlot({ x: 100, y: 100 }, slots);
  assert.equal(result.id, 1);
});

console.log(`\nEnemy-targeting suite: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
