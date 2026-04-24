// C3a-core-1 contract tests for src/net/onlineSlotRuntime.js.

import {
  resolveLocalSlotIndex,
  getLocalSlotIndex,
  getLocalSlot,
  isLocalSlot,
} from '../src/net/onlineSlotRuntime.js';
import {
  armPendingCoopRun,
  consumePendingCoopRun,
  clearCoopRun,
} from '../src/net/coopRunConfig.js';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { console.log(`PASS ${name}`); pass++; }
  else { console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

function activate(role, seed = 1) {
  clearCoopRun();
  armPendingCoopRun({ role, seed });
  consumePendingCoopRun();
}

// resolveLocalSlotIndex — pure
assert('resolveLocalSlotIndex host=0', resolveLocalSlotIndex('host') === 0);
assert('resolveLocalSlotIndex guest=1', resolveLocalSlotIndex('guest') === 1);
assert('resolveLocalSlotIndex local=0', resolveLocalSlotIndex('local') === 0);
assert('resolveLocalSlotIndex unknown=0', resolveLocalSlotIndex('bogus') === 0);
assert('resolveLocalSlotIndex undefined=0', resolveLocalSlotIndex(undefined) === 0);
assert('resolveLocalSlotIndex null=0', resolveLocalSlotIndex(null) === 0);

// getLocalSlotIndex — reads from active coop run
clearCoopRun();
assert('getLocalSlotIndex() solo=0', getLocalSlotIndex() === 0);

activate('host');
assert('getLocalSlotIndex() host=0', getLocalSlotIndex() === 0);

activate('guest');
assert('getLocalSlotIndex() guest=1', getLocalSlotIndex() === 1);

activate('local');
assert('getLocalSlotIndex() local=0', getLocalSlotIndex() === 0);

clearCoopRun();
assert('getLocalSlotIndex() after clear=0', getLocalSlotIndex() === 0);

// Explicit override bypasses module state
activate('host');
assert('getLocalSlotIndex(override guest) uses override, not active',
  getLocalSlotIndex({ role: 'guest' }) === 1);
assert('getLocalSlotIndex(null override)=0', getLocalSlotIndex(null) === 0);
clearCoopRun();

// getLocalSlot — returns slot at resolved index
const slot0 = { id: 0, label: 'host-slot' };
const slot1 = { id: 1, label: 'guest-slot' };

activate('host');
assert('getLocalSlot([s0,s1]) host → slot0',
  getLocalSlot([slot0, slot1]) === slot0);

activate('guest');
assert('getLocalSlot([s0,s1]) guest → slot1',
  getLocalSlot([slot0, slot1]) === slot1);

assert('getLocalSlot([s0]) guest → null (slot not spawned)',
  getLocalSlot([slot0]) === null);

activate('host');
assert('getLocalSlot([]) → null', getLocalSlot([]) === null);
assert('getLocalSlot(null) → null', getLocalSlot(null) === null);
assert('getLocalSlot(undefined) → null', getLocalSlot(undefined) === null);

// Solo fallback
clearCoopRun();
assert('getLocalSlot([s0]) solo → slot0', getLocalSlot([slot0]) === slot0);

// Solo with only one slot when guest role somehow accidentally set: null
activate('guest');
assert('getLocalSlot with sparse array returns null when slot missing',
  getLocalSlot([slot0, undefined]) === null);
clearCoopRun();

// isLocalSlot
activate('host');
assert('isLocalSlot(slot0) host=true', isLocalSlot(slot0) === true);
assert('isLocalSlot(slot1) host=false', isLocalSlot(slot1) === false);

activate('guest');
assert('isLocalSlot(slot0) guest=false', isLocalSlot(slot0) === false);
assert('isLocalSlot(slot1) guest=true', isLocalSlot(slot1) === true);

assert('isLocalSlot(null) false', isLocalSlot(null) === false);
assert('isLocalSlot({}) false (no id)', isLocalSlot({}) === false);
clearCoopRun();

// Solo determinism invariant — no role, slot 0 is always local
clearCoopRun();
assert('solo: getLocalSlotIndex=0, getLocalSlot=s0, isLocalSlot(s0)=true',
  getLocalSlotIndex() === 0
  && getLocalSlot([slot0, slot1]) === slot0
  && isLocalSlot(slot0) === true);

console.log(`Online-slot-runtime suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
