/**
 * R4 polish tests for RollbackCoordinator.
 *
 * Covers:
 *  - Listener disposal (unsubscribe handle is invoked on dispose)
 *  - Bounded history pruning (entries past the rollback window are dropped)
 *  - Telemetry getStats() accumulates rollbacks / misses / counts
 *  - Config invariant: bufferCapacity >= maxRollbackTicks + 1
 *  - Stall status from step() and getRemoteAgeTicks()
 */

import { RollbackCoordinator } from '../src/net/rollbackCoordinator.js';
import { createSimState } from '../src/sim/simState.js';
import assert from 'assert';

function counterSimStep(state, slot0Input, slot1Input, dt) {
  if (!state.testCounter) state.testCounter = { tick: 0, sum: 0 };
  state.testCounter.tick++;
  state.testCounter.sum += (slot0Input?.value || 0) + (slot1Input?.value || 0);
}

function makeCoordinator(opts = {}) {
  const state = createSimState();
  let cb = null;
  const config = {
    simState: state,
    simStep: counterSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (fn) => {
      cb = fn;
      // R4: registrar may return an unsubscribe handle
      return () => { cb = null; };
    },
    ...opts,
  };
  const coord = new RollbackCoordinator(config);
  return { coord, state, getCb: () => cb };
}

console.log('\n=== RollbackCoordinator R4 Polish Tests ===\n');

// Test 1: dispose() invokes unsubscribe handle
{
  console.log('Test 1: dispose() invokes unsubscribe handle');
  let unsubCalled = 0;
  const state = createSimState();
  const coord = new RollbackCoordinator({
    simState: state,
    simStep: counterSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: () => () => { unsubCalled++; },
  });
  coord.dispose();
  assert.strictEqual(unsubCalled, 1, 'unsubscribe should be called once');
  // Idempotent
  coord.dispose();
  assert.strictEqual(unsubCalled, 1, 'second dispose() should not re-invoke');
  console.log('✓ PASS');
}

// Test 2: dispose() works even when registrar returns nothing
{
  console.log('Test 2: dispose() tolerates registrar returning undefined');
  const state = createSimState();
  const coord = new RollbackCoordinator({
    simState: state,
    simStep: counterSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: () => { /* no return */ },
  });
  coord.dispose(); // should not throw
  console.log('✓ PASS');
}

// Test 3: history pruning keeps memory bounded
{
  console.log('Test 3: history pruning keeps in-window entries only');
  const { coord } = makeCoordinator({ bufferCapacity: 8, maxRollbackTicks: 4 });
  for (let i = 0; i < 50; i++) {
    coord.step({ value: 1 }, 1 / 60);
  }
  const stats = coord.getStats();
  // After pruning, only the last bufferCapacity ticks should be live.
  // Pruning removes (currentTick - bufferCapacity - 1) each step, so live
  // entries occupy ticks [currentTick - bufferCapacity, currentTick - 1]
  // = bufferCapacity entries.
  assert.ok(stats.historySize.local <= 8, `local history ${stats.historySize.local} should be <= 8`);
  assert.ok(stats.historySize.predictions <= 8, `predictions ${stats.historySize.predictions} should be <= 8`);
  assert.strictEqual(stats.currentTick, 50);
  console.log(`✓ PASS (local=${stats.historySize.local}, predictions=${stats.historySize.predictions})`);
}

// Test 4: config invariant rejected
{
  console.log('Test 4: config invariant rejects bufferCapacity < maxRollbackTicks + 1');
  let threw = false;
  try {
    new RollbackCoordinator({
      simState: createSimState(),
      simStep: counterSimStep,
      localSlotIndex: 0,
      sendInput: async () => {},
      onRemoteInput: () => {},
      bufferCapacity: 4,
      maxRollbackTicks: 8,
    });
  } catch (e) {
    threw = true;
    assert.ok(/bufferCapacity/.test(e.message), `error mentions bufferCapacity: ${e.message}`);
  }
  assert.ok(threw, 'should throw on invalid config');
  console.log('✓ PASS');
}

// Test 5: telemetry tracks rollback events
{
  console.log('Test 5: telemetry tracks rollback events');
  const { coord, getCb } = makeCoordinator();

  // Step forward 3 ticks with no remote input (predicting neutral)
  coord.step({ value: 0 }, 1 / 60);
  coord.step({ value: 0 }, 1 / 60);
  coord.step({ value: 0 }, 1 / 60);

  // Now deliver a remote input for tick 0 that diverges from the neutral prediction
  const cb = getCb();
  cb({ tick: 0, slot: 1, dx: 1, dy: 0, active: true, mag: 60 });

  const stats = coord.getStats();
  assert.strictEqual(stats.rollbacksPerformed, 1, 'one rollback');
  assert.strictEqual(stats.predictionMisses, 1, 'one miss');
  assert.strictEqual(stats.maxRollbackDepthSeen, 3, '3-tick rollback depth');
  assert.strictEqual(stats.lateRemoteFrames, 1, '1 late frame');
  assert.strictEqual(stats.remoteFramesReceived, 1);
  assert.strictEqual(stats.lastReceivedRemoteTick, 0);
  console.log('✓ PASS');
}

// Test 6: telemetry counts pending vs late remote frames
{
  console.log('Test 6: pending remote frames counted separately from late');
  const { coord, getCb } = makeCoordinator();
  const cb = getCb();
  // Deliver tick 5 BEFORE we step to tick 5 → pending, no rollback path
  cb({ tick: 5, slot: 1, left: false, right: false, up: false, down: false, shoot: false });
  const stats = coord.getStats();
  assert.strictEqual(stats.pendingRemoteFrames, 1);
  assert.strictEqual(stats.lateRemoteFrames, 0);
  assert.strictEqual(stats.rollbacksPerformed, 0);
  console.log('✓ PASS');
}

// Test 7: stall status — step() returns stalled=true once remote falls behind window
{
  console.log('Test 7: step() returns stalled=true when remote age exceeds maxRollbackTicks');
  const { coord, getCb } = makeCoordinator({ bufferCapacity: 16, maxRollbackTicks: 4 });
  const cb = getCb();
  // Receive remote tick 0 immediately
  cb({ tick: 0, slot: 1, left: false, right: false, up: false, down: false, shoot: false });
  // Step a few times; while remote age <= 4, not stalled
  let last;
  for (let i = 0; i < 5; i++) last = coord.step({ value: 0 }, 1 / 60);
  // After 5 steps, currentTick=5, lastRemote=0, age = 5 - 1 - 0 = 4 → not stalled
  assert.strictEqual(last.stalled, false, 'age=4 should not stall');
  // One more step pushes age to 5 > 4
  last = coord.step({ value: 0 }, 1 / 60);
  assert.strictEqual(last.stalled, true, 'age=5 should stall');
  // getRemoteAgeTicks reflects the same
  assert.strictEqual(coord.getRemoteAgeTicks(), 5);
  console.log('✓ PASS');
}

// Test 8: stall not flagged before any remote received
{
  console.log('Test 8: no stall before first remote input');
  const { coord } = makeCoordinator({ bufferCapacity: 16, maxRollbackTicks: 4 });
  let last;
  for (let i = 0; i < 20; i++) last = coord.step({ value: 0 }, 1 / 60);
  assert.strictEqual(last.stalled, false, 'no remote yet → not stalled');
  assert.strictEqual(coord.getRemoteAgeTicks(), Infinity);
  console.log('✓ PASS');
}

// Test 9: getStats() exposes config + state
{
  console.log('Test 9: getStats() exposes coordinator config + state');
  const { coord } = makeCoordinator({ bufferCapacity: 12, maxRollbackTicks: 5 });
  const stats = coord.getStats();
  assert.strictEqual(stats.bufferCapacity, 12);
  assert.strictEqual(stats.maxRollbackTicks, 5);
  assert.strictEqual(stats.currentTick, 0);
  assert.strictEqual(stats.lastReceivedRemoteTick, -1);
  console.log('✓ PASS');
}

console.log('\n=== All R4 Polish Tests Passed ===\n');
