import { createWorldSpace } from '../src/core/worldSpace.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}
function assertEq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assertThrows(fn, msgRe) {
  try { fn(); } catch (e) {
    if (msgRe && !msgRe.test(e.message)) throw new Error(`wrong error: ${e.message}`);
    return;
  }
  throw new Error('expected throw');
}

console.log('worldSpace');

test('defaults to 0x0', () => {
  const w = createWorldSpace();
  assertEq(w.width, 0);
  assertEq(w.height, 0);
});

test('initializes with constructor args', () => {
  const w = createWorldSpace(400, 472);
  assertEq(w.width, 400);
  assertEq(w.height, 472);
});

test('get() returns current dims', () => {
  const w = createWorldSpace(400, 472);
  const dims = w.get();
  assertEq(dims.width, 400);
  assertEq(dims.height, 472);
});

test('set() updates both dims', () => {
  const w = createWorldSpace(100, 200);
  w.set(400, 472);
  assertEq(w.width, 400);
  assertEq(w.height, 472);
});

test('set() coerces floats to ints', () => {
  const w = createWorldSpace();
  w.set(400.7, 472.9);
  assertEq(w.width, 400);
  assertEq(w.height, 472);
});

test('set() rejects zero', () => {
  const w = createWorldSpace(400, 472);
  assertThrows(() => w.set(0, 472), /positive/);
  assertThrows(() => w.set(400, 0), /positive/);
});

test('set() rejects negatives', () => {
  const w = createWorldSpace(400, 472);
  assertThrows(() => w.set(-1, 472), /positive/);
});

test('getRenderScale identity when canvas == world', () => {
  const w = createWorldSpace(400, 472);
  const s = w.getRenderScale(400, 472);
  assertEq(s.x, 1);
  assertEq(s.y, 1);
});

test('getRenderScale >1 when canvas larger than world', () => {
  const w = createWorldSpace(400, 400);
  const s = w.getRenderScale(800, 800);
  assertEq(s.x, 2);
  assertEq(s.y, 2);
});

test('getRenderScale <1 when canvas smaller than world', () => {
  const w = createWorldSpace(400, 400);
  const s = w.getRenderScale(200, 200);
  assertEq(s.x, 0.5);
  assertEq(s.y, 0.5);
});

test('getRenderScale non-uniform when aspect differs', () => {
  const w = createWorldSpace(400, 400);
  const s = w.getRenderScale(800, 400);
  assertEq(s.x, 2);
  assertEq(s.y, 1);
});

test('getRenderScale safe when world dims zero', () => {
  const w = createWorldSpace();
  const s = w.getRenderScale(800, 600);
  assertEq(s.x, 1);
  assertEq(s.y, 1);
});

test('set() then getRenderScale reflects new dims', () => {
  const w = createWorldSpace(100, 100);
  w.set(400, 472);
  const s = w.getRenderScale(400, 472);
  assertEq(s.x, 1);
  assertEq(s.y, 1);
});

test('multiple instances are independent', () => {
  const a = createWorldSpace(100, 100);
  const b = createWorldSpace(400, 472);
  a.set(200, 200);
  assertEq(b.width, 400);
  assertEq(b.height, 472);
});

test('co-op scenario: host and guest pin same world on different canvases', () => {
  // simulates D0a -> D2: host arms world 400x472; both peers render into
  // different canvas sizes, both compute their own scale independently.
  const hostWorld = createWorldSpace(400, 472);
  const guestWorld = createWorldSpace(400, 472);
  // sim state (positions) only cares about world dims, which agree.
  assertEq(hostWorld.width, guestWorld.width);
  assertEq(hostWorld.height, guestWorld.height);
  // render-time scale differs per device.
  const hostScale = hostWorld.getRenderScale(400, 472);   // 1080p laptop
  const guestScale = guestWorld.getRenderScale(300, 354); // smaller phone
  assertEq(hostScale.x, 1);
  assertEq(Math.round(guestScale.x * 1000), 750); // 0.75
});

console.log(`worldSpace: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
