#!/usr/bin/env node
// Phase C3a-core-2 — Co-op input sync module tests.
// Covers: ring buffer, input batching, ingest/dispatch, remote adapter.

import assert from 'node:assert/strict';
import { createRemoteInputBuffer } from '../src/net/remoteInputBuffer.js';
import { createCoopInputSync } from '../src/net/coopInputSync.js';
import { createRemoteInputAdapter } from '../src/core/inputAdapters.js';

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
    pass++;
  } catch (err) {
    console.log(`FAIL ${name} — ${err.message}`);
    fail++;
  }
}

// ---------------------------------------------------------------------------
// Ring buffer tests (7)
// ---------------------------------------------------------------------------

test('ring buffer: push in order → size grows, peekAt returns correct frame', () => {
  const rb = createRemoteInputBuffer();
  rb.push({ tick: 1, dx: 10, dy: 0, t: 200, still: 0 });
  rb.push({ tick: 2, dx: 20, dy: 0, t: 200, still: 0 });
  rb.push({ tick: 3, dx: 30, dy: 0, t: 200, still: 0 });
  assert.equal(rb.size(), 3);
  assert.equal(rb.peekAt(2).dx, 20);
  assert.equal(rb.peekAt(1).dx, 10);
  assert.equal(rb.peekAt(3).dx, 30);
});

test('ring buffer: push out of order → sorted, peekAt returns by tick', () => {
  const rb = createRemoteInputBuffer();
  rb.push({ tick: 5, dx: 50, dy: 0, t: 0, still: 1 });
  rb.push({ tick: 2, dx: 20, dy: 0, t: 0, still: 1 });
  rb.push({ tick: 8, dx: 80, dy: 0, t: 0, still: 1 });
  rb.push({ tick: 1, dx: 10, dy: 0, t: 0, still: 1 });
  assert.equal(rb.size(), 4);
  assert.equal(rb.peekAt(2).dx, 20);
  assert.equal(rb.peekAt(8).dx, 80);
  // Oldest should be tick 1
  assert.equal(rb.oldestTick(), 1);
  assert.equal(rb.newestTick(), 8);
});

test('ring buffer: duplicate tick → second dropped, first retained, stats.duplicates=1', () => {
  const rb = createRemoteInputBuffer();
  rb.push({ tick: 10, dx: 100, dy: 0, t: 0, still: 0 });
  rb.push({ tick: 10, dx: 200, dy: 0, t: 0, still: 0 }); // duplicate
  assert.equal(rb.size(), 1);
  assert.equal(rb.peekAt(10).dx, 100, 'first frame should be kept');
  assert.equal(rb.stats().duplicates, 1);
});

test('ring buffer: consumeUpTo drops frames ≤ tick only', () => {
  const rb = createRemoteInputBuffer();
  for (let t = 1; t <= 6; t++) rb.push({ tick: t, dx: t, dy: 0, t: 0, still: 0 });
  const dropped = rb.consumeUpTo(3);
  assert.equal(dropped, 3);
  assert.equal(rb.size(), 3);
  assert.equal(rb.peekAt(4).dx, 4);
  assert.equal(rb.peekAt(1), null);
});

test('ring buffer: capacity overflow drops oldest, droppedCount increments', () => {
  const rb = createRemoteInputBuffer({ capacity: 4 });
  for (let t = 1; t <= 5; t++) rb.push({ tick: t, dx: t, dy: 0, t: 0, still: 0 });
  assert.equal(rb.size(), 4);
  assert.equal(rb.stats().droppedCount, 1);
  assert.equal(rb.peekAt(1), null, 'oldest should be dropped');
  assert.equal(rb.peekAt(2).dx, 2);
});

test('ring buffer: hasFrameFor true/false correctness', () => {
  const rb = createRemoteInputBuffer();
  rb.push({ tick: 7, dx: 0, dy: 0, t: 0, still: 1 });
  assert.equal(rb.hasFrameFor(7), true);
  assert.equal(rb.hasFrameFor(8), false);
  assert.equal(rb.hasFrameFor(6), false);
});

test('ring buffer: empty buffer peekAt returns null', () => {
  const rb = createRemoteInputBuffer();
  assert.equal(rb.peekAt(0), null);
  assert.equal(rb.peekAt(100), null);
  assert.equal(rb.oldestTick(), null);
  assert.equal(rb.newestTick(), null);
});

// ---------------------------------------------------------------------------
// InputSync batching tests (8)
// ---------------------------------------------------------------------------

function makeMockAdapter(dx = 0, dy = 0, t = 0, active = false) {
  return {
    kind: 'mock',
    moveVector: () => ({ dx, dy, t, active }),
    isStill: () => !active,
  };
}

test('inputSync: sampleFrame below batchSize does not send', () => {
  const sent = [];
  const sync = createCoopInputSync({
    sendGameplay: (msg) => sent.push(msg),
    localAdapter: makeMockAdapter(),
    localSlotIndex: 0,
    batchSize: 4,
  });
  sync.sampleFrame(0);
  sync.sampleFrame(1);
  sync.sampleFrame(2);
  assert.equal(sent.length, 0);
  assert.equal(sync.getStats().pendingLocal, 3);
});

test('inputSync: hitting batchSize flushes once with exactly batchSize frames', () => {
  const sent = [];
  const sync = createCoopInputSync({
    sendGameplay: (msg) => sent.push(msg),
    localAdapter: makeMockAdapter(0.5, 0, 1, true),
    localSlotIndex: 0,
    batchSize: 4,
  });
  for (let i = 0; i < 4; i++) sync.sampleFrame(i);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].frames.length, 4);
  assert.equal(sync.getStats().pendingLocal, 0);
});

test('inputSync: manual flush() sends short batch', () => {
  const sent = [];
  const sync = createCoopInputSync({
    sendGameplay: (msg) => sent.push(msg),
    localAdapter: makeMockAdapter(1, 0, 1, true),
    localSlotIndex: 1,
    batchSize: 4,
  });
  sync.sampleFrame(10);
  sync.sampleFrame(11);
  sync.flush();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].frames.length, 2);
});

test('inputSync: flush() on empty batch is a no-op (no send)', () => {
  const sent = [];
  const sync = createCoopInputSync({
    sendGameplay: (msg) => sent.push(msg),
    localAdapter: makeMockAdapter(),
    localSlotIndex: 0,
    batchSize: 4,
  });
  sync.flush();
  assert.equal(sent.length, 0);
});

test('inputSync: quantization dx=1.0→127, dx=-1.0→-127, t=0.5→~128', () => {
  const sent = [];
  const sync = createCoopInputSync({
    sendGameplay: (msg) => sent.push(msg),
    localAdapter: makeMockAdapter(1.0, -1.0, 0.5, true),
    localSlotIndex: 0,
    batchSize: 1,
  });
  sync.sampleFrame(0);
  const f = sent[0].frames[0];
  assert.equal(f.dx, 127);
  assert.equal(f.dy, -127);
  assert.ok(Math.abs(f.t - 128) <= 1, `t should be ~128, got ${f.t}`);
});

test('inputSync: frames preserve tick monotonicity in outbound message', () => {
  const sent = [];
  const sync = createCoopInputSync({
    sendGameplay: (msg) => sent.push(msg),
    localAdapter: makeMockAdapter(0.5, 0, 1, true),
    localSlotIndex: 0,
    batchSize: 4,
  });
  for (let i = 10; i < 14; i++) sync.sampleFrame(i);
  const ticks = sent[0].frames.map(f => f.tick);
  assert.deepEqual(ticks, [10, 11, 12, 13]);
});

test('inputSync: consecutive batches increment stats.sent', () => {
  const sent = [];
  const sync = createCoopInputSync({
    sendGameplay: (msg) => sent.push(msg),
    localAdapter: makeMockAdapter(1, 0, 1, true),
    localSlotIndex: 0,
    batchSize: 2,
  });
  for (let i = 0; i < 6; i++) sync.sampleFrame(i);
  assert.equal(sync.getStats().sent, 3);
  assert.equal(sent.length, 3);
});

test('inputSync: sent message shape is {kind:"input", slot, frames:[...]}', () => {
  const sent = [];
  const sync = createCoopInputSync({
    sendGameplay: (msg) => sent.push(msg),
    localAdapter: makeMockAdapter(0, 1, 0.8, true),
    localSlotIndex: 1,
    batchSize: 1,
  });
  sync.sampleFrame(99);
  assert.equal(sent[0].kind, 'input');
  assert.equal(sent[0].slot, 1);
  assert.ok(Array.isArray(sent[0].frames));
  const f = sent[0].frames[0];
  assert.equal(typeof f.tick, 'number');
  assert.equal(typeof f.dx, 'number');
  assert.equal(typeof f.dy, 'number');
  assert.equal(typeof f.t, 'number');
  assert.ok(f.still === 0 || f.still === 1);
});

// ---------------------------------------------------------------------------
// Ingest / dispatch tests (5)
// ---------------------------------------------------------------------------

test('ingest: {kind:"input", slot:1, frames:[...]} → onRemoteFrame listener fires', () => {
  const sync = createCoopInputSync({
    sendGameplay: () => {},
    localAdapter: makeMockAdapter(),
    localSlotIndex: 0,
    batchSize: 4,
  });
  const received = [];
  sync.onRemoteFrame((ev) => received.push(ev));
  sync.ingest({ kind: 'input', slot: 1, frames: [{ tick: 5, dx: 10, dy: 0, t: 200, still: 0 }] });
  assert.equal(received.length, 1);
  assert.equal(received[0].slot, 1);
  assert.equal(received[0].frames.length, 1);
});

test('ingest: wrong kind is ignored (no listener call)', () => {
  const sync = createCoopInputSync({
    sendGameplay: () => {},
    localAdapter: makeMockAdapter(),
    localSlotIndex: 0,
    batchSize: 4,
  });
  let fired = false;
  sync.onRemoteFrame(() => { fired = true; });
  sync.ingest({ kind: 'ping', slot: 1, frames: [] });
  assert.equal(fired, false);
});

test('ingest: malformed frames array is ignored (no throw)', () => {
  const sync = createCoopInputSync({
    sendGameplay: () => {},
    localAdapter: makeMockAdapter(),
    localSlotIndex: 0,
    batchSize: 4,
  });
  let threw = false;
  try {
    sync.ingest({ kind: 'input', slot: 1, frames: null });
    sync.ingest(null);
    sync.ingest({ kind: 'input', slot: 1 }); // no frames field
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
});

test('ingest: ring buffer populated after ingest (peekAt returns the frame)', () => {
  const sync = createCoopInputSync({
    sendGameplay: () => {},
    localAdapter: makeMockAdapter(),
    localSlotIndex: 0,
    batchSize: 4,
  });
  const frame = { tick: 42, dx: 50, dy: -30, t: 180, still: 0 };
  sync.ingest({ kind: 'input', slot: 1, frames: [frame] });
  const rb = sync.getRemoteRingBuffer();
  const found = rb.peekAt(42);
  assert.ok(found !== null);
  assert.equal(found.dx, 50);
});

test('ingest: multiple listeners all fire; unsubscribe stops one', () => {
  const sync = createCoopInputSync({
    sendGameplay: () => {},
    localAdapter: makeMockAdapter(),
    localSlotIndex: 0,
    batchSize: 4,
  });
  const log1 = [], log2 = [];
  const unsub1 = sync.onRemoteFrame((ev) => log1.push(ev));
  sync.onRemoteFrame((ev) => log2.push(ev));
  sync.ingest({ kind: 'input', slot: 1, frames: [{ tick: 1, dx: 0, dy: 0, t: 0, still: 1 }] });
  assert.equal(log1.length, 1);
  assert.equal(log2.length, 1);
  unsub1();
  sync.ingest({ kind: 'input', slot: 1, frames: [{ tick: 2, dx: 0, dy: 0, t: 0, still: 1 }] });
  assert.equal(log1.length, 1, 'unsubscribed listener must not fire again');
  assert.equal(log2.length, 2);
});

// ---------------------------------------------------------------------------
// Remote adapter tests (4)
// ---------------------------------------------------------------------------

test('remote adapter: moveVector() with no frame returns inactive', () => {
  const rb = createRemoteInputBuffer();
  let currentTick = 5;
  const adapter = createRemoteInputAdapter(rb, { getCurrentTick: () => currentTick });
  const v = adapter.moveVector();
  assert.equal(v.active, false);
  assert.equal(v.dx, 0);
  assert.equal(v.dy, 0);
  assert.equal(v.t, 0);
  assert.equal(adapter.isStill(), true);
});

test('remote adapter: moveVector() with frame dequantized correctly (within ±0.01)', () => {
  const rb = createRemoteInputBuffer();
  // Simulate frame from dx=0.8, dy=-0.6, t=0.75, active=true
  const frame = {
    tick: 10,
    dx: Math.round(0.8 * 127),
    dy: Math.round(-0.6 * 127),
    t: Math.round(0.75 * 255),
    still: 0,
  };
  rb.push(frame);
  let currentTick = 10;
  const adapter = createRemoteInputAdapter(rb, { getCurrentTick: () => currentTick });
  const v = adapter.moveVector();
  assert.ok(Math.abs(v.dx - 0.8) < 0.01, `dx=${v.dx} not close to 0.8`);
  assert.ok(Math.abs(v.dy - (-0.6)) < 0.01, `dy=${v.dy} not close to -0.6`);
  assert.ok(Math.abs(v.t - 0.75) < 0.01, `t=${v.t} not close to 0.75`);
  assert.equal(v.active, true);
});

test('remote adapter: isStill() matches frame.still', () => {
  const rb = createRemoteInputBuffer();
  rb.push({ tick: 20, dx: 0, dy: 0, t: 0, still: 1 });
  rb.push({ tick: 21, dx: 100, dy: 0, t: 200, still: 0 });
  let tick = 20;
  const adapter = createRemoteInputAdapter(rb, { getCurrentTick: () => tick });
  assert.equal(adapter.isStill(), true);
  tick = 21;
  assert.equal(adapter.isStill(), false);
});

test('remote adapter: kind is "remote"', () => {
  const rb = createRemoteInputBuffer();
  const adapter = createRemoteInputAdapter(rb, { getCurrentTick: () => 0 });
  assert.equal(adapter.kind, 'remote');
});

// ---------------------------------------------------------------------------

console.log(`\nCoop-input-sync suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
