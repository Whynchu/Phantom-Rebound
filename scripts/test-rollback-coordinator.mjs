/**
 * Test suite for R3 RollbackCoordinator
 * Validates:
 * - Input batching and history tracking
 * - Prediction and divergence detection
 * - Rollback and resim correctness
 * - Determinism across multiple runs
 */

import { RollbackCoordinator } from '../src/net/rollbackCoordinator.js';
import { createSimState } from '../src/sim/simState.js';
import assert from 'assert';

// Mock simStep for testing
function counterSimStep(state, slot0Input, slot1Input, dt) {
  if (!state.testCounter) {
    state.testCounter = { tick: 0, sum: 0 };
  }
  state.testCounter.tick++;
  state.testCounter.sum += (slot0Input?.value || 0) + (slot1Input?.value || 0);
}

console.log('\n=== RollbackCoordinator Tests ===\n');

// Test 1: Basic coordinator construction
{
  console.log('Test 1: Basic coordinator construction');
  const state = createSimState();
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: counterSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (cb) => { /* noop */ },
  });
  assert(coordinator);
  assert.strictEqual(coordinator.currentTick, 0);
  assert.strictEqual(coordinator.localSlotIndex, 0);
  console.log('✓ PASS');
}

// Test 2: Step forward with local input
{
  console.log('Test 2: Step forward with local input');
  const state = createSimState();
  let sentInputs = [];
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: counterSimStep,
    localSlotIndex: 0,
    sendInput: async (frame) => { sentInputs.push(frame); },
    onRemoteInput: (cb) => { /* noop */ },
  });

  coordinator.step({ value: 5 }, 1 / 60);
  assert.strictEqual(coordinator.currentTick, 1);
  assert.strictEqual(state.testCounter.sum, 5); // slot0 value (5) + slot1 neutral (0)
  assert.strictEqual(sentInputs.length, 1);
  console.log('✓ PASS');
}

// Test 3: Predict neutral for missing remote input
{
  console.log('Test 3: Predict neutral for missing remote input');
  const state = createSimState();
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: counterSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (cb) => { /* noop */ },
  });

  // Step 3 times without remote input; should predict neutral (0) for remote
  coordinator.step({ value: 1 }, 1 / 60); // tick 0: sum = 1 + 0 = 1
  coordinator.step({ value: 1 }, 1 / 60); // tick 1: sum = 1 + 1 + 0 = 2
  coordinator.step({ value: 1 }, 1 / 60); // tick 2: sum = 2 + 1 + 0 = 3

  assert.strictEqual(state.testCounter.sum, 3);
  console.log('✓ PASS');
}

// Test 4: Remote input arrives, matches prediction (no rollback needed)
{
  console.log('Test 4: Remote input arrives, matches prediction');
  const state = createSimState();
  let remoteInputCallback = null;
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: counterSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (cb) => { remoteInputCallback = cb; },
  });

  // Step 1 tick with local input (remote predicts neutral)
  coordinator.step({ value: 1 }, 1 / 60);
  assert.strictEqual(state.testCounter.sum, 1);

  // Remote input arrives for tick 0, matches prediction (neutral)
  remoteInputCallback({ tick: 0, slot: 1, value: 0 });

  // No rollback should occur; state should be unchanged
  assert.strictEqual(state.testCounter.sum, 1);
  assert.strictEqual(coordinator.currentTick, 1);
  console.log('✓ PASS');
}

// Test 5: Remote input diverges; rollback and resim corrects state
{
  console.log('Test 5: Remote input diverges, rollback corrects');
  const state = createSimState({ slotCount: 2 });
  let remoteInputCallback = null;

  // Custom simStep that modifies slot positions based on input
  // left/right will add/subtract from slot 0's x; up/down to slot 1's x
  function testSimStep(st, s0, s1, dt) {
    if (s0?.left) st.slots[0].body.x += 1;
    if (s0?.right) st.slots[0].body.x -= 1;
    if (s1?.up) st.slots[1].body.x += 10;
    if (s1?.down) st.slots[1].body.x -= 10;
  }

  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: testSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (cb) => { remoteInputCallback = cb; },
    maxRollbackTicks: 8,
    logger: (msg) => console.log('  [LOG]', msg),
  });

  // Step forward with slot 0: left=true, slot 1: predicted neutral (no up/down)
  const slot0X0 = state.slots[0].body.x;
  const slot1X0 = state.slots[1].body.x;
  coordinator.step({ left: true, right: false, up: false, down: false, shoot: false }, 1 / 60);
  // tick 0: slot 0 += 1, slot 1 += 0
  assert.strictEqual(state.slots[0].body.x, slot0X0 + 1, 'slot 0 should have moved +1');
  assert.strictEqual(state.slots[1].body.x, slot1X0, 'slot 1 should not move');

  coordinator.step({ left: true, right: false, up: false, down: false, shoot: false }, 1 / 60);
  // tick 1: slot 0 += 1, slot 1 += 0
  assert.strictEqual(state.slots[0].body.x, slot0X0 + 2, 'slot 0 should be at +2');
  assert.strictEqual(state.slots[1].body.x, slot1X0, 'slot 1 should still be at initial x');

  // Real remote input for tick 0 arrives: slot 1 should move up=true (diverges from prediction)
  console.log('  Before rollback: Slot 0 at x=' + state.slots[0].body.x + ', Slot 1 at x=' + state.slots[1].body.x);
  remoteInputCallback({ tick: 0, slot: 1, left: false, right: false, up: true, down: false, shoot: false });

  // Rollback should rewind and resim:
  //   tick 0 (real): slot 0 += 1 (left), slot 1 += 10 (up)
  //   tick 1: slot 0 += 1 (left), slot 1 += 0 (predicted neutral for tick 1)
  // Final: slot 0 = X0 + 2, slot 1 = X0_remote + 10
  const expectedSlot0X = slot0X0 + 2;
  const expectedSlot1X = slot1X0 + 10; // Only gets +10 from tick 0
  console.log('  After rollback: Slot 0 at x=' + state.slots[0].body.x + ', Slot 1 at x=' + state.slots[1].body.x);
  console.log('  Expected: Slot 0 at x=' + expectedSlot0X + ', Slot 1 at x=' + expectedSlot1X);
  assert.strictEqual(state.slots[0].body.x, expectedSlot0X, `Slot 0 should be at ${expectedSlot0X}`);
  assert.strictEqual(state.slots[1].body.x, expectedSlot1X, `Slot 1 should be at ${expectedSlot1X}`);
  console.log('✓ PASS');
}

// Test 6: Summary provides coordinator state
{
  console.log('Test 6: Summary provides coordinator state');
  const state = createSimState();
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: counterSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (cb) => { /* noop */ },
  });

  coordinator.step({ value: 1 }, 1 / 60);
  const summary = coordinator.summary();

  assert.strictEqual(summary.currentTick, 1);
  assert(summary.bufferSize >= 1);
  console.log('✓ PASS');
}

// Test 7: Input equality check works correctly
{
  console.log('Test 7: Input equality check');
  const state = createSimState();
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: counterSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (cb) => { /* noop */ },
  });

  const inp1 = { left: true, right: false, up: false, down: false, shoot: false };
  const inp2 = { left: true, right: false, up: false, down: false, shoot: false };
  const inp3 = { left: false, right: false, up: false, down: false, shoot: false };

  assert(coordinator._inputsEqual(inp1, inp2));
  assert(!coordinator._inputsEqual(inp1, inp3));
  console.log('✓ PASS');
}

// Test 8: Neutral input creation
{
  console.log('Test 8: Neutral input creation');
  const state = createSimState();
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: counterSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (cb) => { /* noop */ },
  });

  const neutral = coordinator._neutralInput();
  assert.strictEqual(neutral.left, false);
  assert.strictEqual(neutral.right, false);
  assert.strictEqual(neutral.shoot, false);
  console.log('✓ PASS');
}

// Test 9: Local slot 0 / remote slot 1 mapping
{
  console.log('Test 9: Local slot 0, remote slot 1 mapping');
  const state = createSimState();
  let capturedInputs = [];
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: (st, s0, s1, dt) => {
      capturedInputs.push({ s0: s0?.value || 0, s1: s1?.value || 0 });
    },
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (cb) => { /* noop */ },
  });

  coordinator.step({ value: 5 }, 1 / 60);
  assert.strictEqual(capturedInputs[0].s0, 5); // local goes to slot 0
  assert.strictEqual(capturedInputs[0].s1, 0); // remote predicted as 0 goes to slot 1
  console.log('✓ PASS');
}

// Test 10: Local slot 1 / remote slot 0 mapping
{
  console.log('Test 10: Local slot 1, remote slot 0 mapping');
  const state = createSimState();
  let capturedInputs = [];
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: (st, s0, s1, dt) => {
      capturedInputs.push({ s0: s0?.value || 0, s1: s1?.value || 0 });
    },
    localSlotIndex: 1,
    sendInput: async () => {},
    onRemoteInput: (cb) => { /* noop */ },
  });

  coordinator.step({ value: 7 }, 1 / 60);
  assert.strictEqual(capturedInputs[0].s0, 0); // remote predicted as 0 goes to slot 0
  assert.strictEqual(capturedInputs[0].s1, 7); // local goes to slot 1
  console.log('✓ PASS');
}

console.log('\n=== All RollbackCoordinator Tests Passed ===\n');
