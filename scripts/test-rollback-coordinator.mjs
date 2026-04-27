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

  // Custom simStep using joy format: dx < 0 → slot0 moves +1; slot1 active → +10
  function testSimStep(st, s0, s1, dt) {
    if (s0?.joy?.active && s0.joy.dx < 0) st.slots[0].body.x += 1;
    if (s0?.joy?.active && s0.joy.dx > 0) st.slots[0].body.x -= 1;
    if (s1?.joy?.active && s1.joy.dy < 0) st.slots[1].body.x += 10;
    if (s1?.joy?.active && s1.joy.dy > 0) st.slots[1].body.x -= 10;
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

  const joyLeft  = { joy: { dx: -1, dy: 0, active: true,  mag: 60 } };
  const joyUp    = { joy: { dx:  0, dy: -1, active: true,  mag: 60 } };

  // Step forward with slot 0: left, slot 1: predicted neutral (no movement)
  const slot0X0 = state.slots[0].body.x;
  const slot1X0 = state.slots[1].body.x;
  coordinator.step(joyLeft, 1 / 60);
  // tick 0: slot 0 += 1, slot 1 += 0
  assert.strictEqual(state.slots[0].body.x, slot0X0 + 1, 'slot 0 should have moved +1');
  assert.strictEqual(state.slots[1].body.x, slot1X0, 'slot 1 should not move');

  coordinator.step(joyLeft, 1 / 60);
  // tick 1: slot 0 += 1, slot 1 += 0
  assert.strictEqual(state.slots[0].body.x, slot0X0 + 2, 'slot 0 should be at +2');
  assert.strictEqual(state.slots[1].body.x, slot1X0, 'slot 1 should still be at initial x');

  // Real remote input for tick 0: slot 1 was moving up (dy < 0) — diverges from neutral
  console.log('  Before rollback: Slot 0 at x=' + state.slots[0].body.x + ', Slot 1 at x=' + state.slots[1].body.x);
  remoteInputCallback({ tick: 0, slot: 1, dx: 0, dy: -1, active: true, mag: 60 });

  // Rollback should rewind and resim:
  //   tick 0 (real): slot 0 += 1 (left), slot 1 += 10 (up/dy<0)
  //   tick 1: slot 0 += 1 (left), slot 1 += 0 (predicted neutral for tick 1)
  // Final: slot 0 = X0 + 2, slot 1 = X0 + 10
  const expectedSlot0X = slot0X0 + 2;
  const expectedSlot1X = slot1X0 + 10;
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

  // Active movement in the same direction → equal
  const inp1 = { joy: { dx: 0.71, dy: 0,    active: true,  mag: 60 } };
  const inp2 = { joy: { dx: 0.71, dy: 0,    active: true,  mag: 60 } };
  // Different direction → not equal
  const inp3 = { joy: { dx: 0,    dy: 1,    active: true,  mag: 60 } };
  // Inactive (neutral) → equal to each other
  const inp4 = { joy: { dx: 0.5,  dy: 0.5,  active: false, mag: 0  } };
  const inp5 = { joy: { dx: 0,    dy: 0,    active: false, mag: 0  } };

  assert(coordinator._inputsEqual(inp1, inp2), 'same direction should be equal');
  assert(!coordinator._inputsEqual(inp1, inp3), 'different direction should not be equal');
  assert(coordinator._inputsEqual(inp4, inp5), 'both inactive should be equal regardless of dx/dy');
  assert(!coordinator._inputsEqual(inp1, inp4), 'active vs inactive should not be equal');
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
  assert.ok(neutral.joy, 'neutral should have joy field');
  assert.strictEqual(neutral.joy.active, false, 'neutral active should be false');
  assert.strictEqual(neutral.joy.dx, 0, 'neutral dx should be 0');
  assert.strictEqual(neutral.joy.dy, 0, 'neutral dy should be 0');
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

// Test 11: skipSimStepOnForward — simStep skipped on forward path, called on resim
{
  console.log('Test 11: skipSimStepOnForward skips forward simStep, uses it for resim');
  const state = createSimState({ slotCount: 2 });
  let simStepCalls = 0;
  let remoteInputCallback = null;

  // simStep: moves slot 1 when active
  function movingSimStep(st, s0, s1, dt) {
    simStepCalls++;
    if (s1?.joy?.active) st.slots[1].body.x += 5;
  }

  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: movingSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (cb) => { remoteInputCallback = cb; },
    skipSimStepOnForward: true,
    maxRollbackTicks: 8,
  });

  // External code (game loop / test) advances state manually
  // simStep should NOT be called during coordinator.step()
  const beforeCalls = simStepCalls;
  coordinator.step({ joy: { dx: 0, dy: 0, active: false, mag: 0 } }, 1 / 60);
  coordinator.step({ joy: { dx: 0, dy: 0, active: false, mag: 0 } }, 1 / 60);
  assert.strictEqual(simStepCalls, beforeCalls, 'simStep should not run during forward steps');

  // Remote divergence triggers resim → simStep IS called
  remoteInputCallback({ tick: 0, slot: 1, dx: 1, dy: 0, active: true, mag: 60 });
  assert.ok(simStepCalls > beforeCalls, 'simStep should run during resim');
  console.log('✓ PASS');
}

// Test 12: Partial resync fires when divergence exceeds maxRollbackTicks
{
  console.log('Test 12: Partial resync on deep divergence (depth > maxRollbackTicks)');
  const state = createSimState();
  let remoteInputCallback = null;
  let simStepCalls = 0;
  const maxRollback = 4;

  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: (s, s0, s1, dt) => {
      counterSimStep(s, s0, s1, dt);
      simStepCalls++;
    },
    localSlotIndex: 1,
    sendInput: async () => {},
    onRemoteInput: (cb) => { remoteInputCallback = cb; },
    maxRollbackTicks: maxRollback,
    bufferCapacity: maxRollback * 2 + 2,
  });

  const neutral = { joy: { dx: 0, dy: 0, active: false, mag: 0 } };

  // Advance 10 ticks (well beyond maxRollbackTicks)
  for (let i = 0; i < 10; i++) {
    coordinator.step(neutral, 1 / 60);
  }
  assert.strictEqual(coordinator.currentTick, 10);

  // Deliver a remote input for tick 0 — divergence depth = 10 > maxRollback (4)
  // This should trigger partial resync, not a silent give-up
  const stepsBefore = simStepCalls;
  remoteInputCallback({ tick: 0, slot: 0, dx: 1, dy: 0, active: true, mag: 60 });

  // Partial resync must have called simStep for maxRollbackTicks frames
  assert.ok(simStepCalls >= stepsBefore + maxRollback,
    `Partial resync should call simStep >= ${maxRollback} times, got ${simStepCalls - stepsBefore}`);
  console.log('✓ PASS');
}

// Test 13: Local joy is canonicalized before sim and wire send
{
  console.log('Test 13: Local joy input is canonicalized before sim and send');
  const state = createSimState({ slotCount: 2 });
  const sentInputs = [];
  let captured = null;
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: (st, s0, s1) => { captured = s0; },
    localSlotIndex: 0,
    sendInput: async (frame) => { sentInputs.push(frame); },
    onRemoteInput: (cb) => { /* noop */ },
    inputDeadzoneMag: 3,
    inputJoyMax: 56,
    canonicalJoyMax: 28,
  });

  coordinator.step({ joy: { dx: 0.1234, dy: 0.9876, active: true, mag: 56 } }, 1 / 60);

  assert.strictEqual(captured.joy.dx, 0.12);
  assert.strictEqual(captured.joy.dy, 0.99);
  assert.strictEqual(captured.joy.mag, 28);
  assert.strictEqual(sentInputs[0].dx, 0.12);
  assert.strictEqual(sentInputs[0].dy, 0.99);
  assert.strictEqual(sentInputs[0].mag, 28);
  console.log('✓ PASS');
}

// Test 14: Neutral/under-deadzone active touches do not create prediction misses
{
  console.log('Test 14: active true with neutral magnitude quantizes to inactive');
  const state = createSimState();
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: counterSimStep,
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (cb) => { /* noop */ },
    inputDeadzoneMag: 3,
  });

  assert.deepStrictEqual(
    coordinator._quantizeJoy({ dx: 0, dy: 0, active: true, mag: 0 }),
    { active: false, dx: 0, dy: 0, mag: 0 },
  );
  assert.deepStrictEqual(
    coordinator._quantizeJoy({ dx: 1, dy: 0, active: true, mag: 3 }),
    { active: false, dx: 0, dy: 0, mag: 0 },
  );
  console.log('✓ PASS');
}

// Test 15: Rollback resim effects are discarded after correction
{
  console.log('Test 15: rollback resim clears effectQueue instead of leaking effects');
  const state = createSimState({ slotCount: 2 });
  const slot1StartX = state.slots[1].body.x;
  let remoteInputCallback = null;
  const coordinator = new RollbackCoordinator({
    simState: state,
    simStep: (st, s0, s1) => {
      st.effectQueue.push({ kind: 'resim.damageNumber', x: 1, y: 2 });
      if (s1?.joy?.active) st.slots[1].body.x += 1;
    },
    localSlotIndex: 0,
    sendInput: async () => {},
    onRemoteInput: (cb) => { remoteInputCallback = cb; },
    skipSimStepOnForward: true,
    maxRollbackTicks: 8,
  });

  coordinator.step({ joy: { dx: 0, dy: 0, active: false, mag: 0 } }, 1 / 60);
  coordinator.step({ joy: { dx: 0, dy: 0, active: false, mag: 0 } }, 1 / 60);
  remoteInputCallback({ tick: 0, slot: 1, dx: 1, dy: 0, active: true, mag: 60 });

  assert.strictEqual(state.effectQueue.length, 0, 'resim effects must not drain into visible frame effects');
  assert.strictEqual(state.slots[1].body.x, slot1StartX + 1, 'resim still mutates gameplay state');
  console.log('✓ PASS');
}

console.log('\n=== All RollbackCoordinator Tests Passed ===\n');
