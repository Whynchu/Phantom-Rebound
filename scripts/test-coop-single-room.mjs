// C3a-min-1 contract tests — single-room online coop termination.
//
// Pure Node tests: no DOM, no script.js. Tests cover:
//   - isOnlineCoopRun() helper correctness
//   - shouldEndAfterRoomClear() pure logic helper
//   - state-machine round-trips

import {
  armPendingCoopRun,
  consumePendingCoopRun,
  clearCoopRun,
  isCoopRun,
  getActiveCoopRun,
  isOnlineCoopRun,
} from '../src/net/coopRunConfig.js';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { console.log(`PASS ${name}`); pass++; }
  else { console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

function reset() { clearCoopRun(); }

// ── isOnlineCoopRun() helper ─────────────────────────────────────────────────

// 1. false when no coop run is armed
reset();
assert('isOnlineCoopRun() false when no run armed', isOnlineCoopRun() === false);

// 2. false when role='local' (COOP_DEBUG parity — must NOT hit single-room gate)
reset();
armPendingCoopRun({ role: 'local', seed: 42, code: null });
consumePendingCoopRun();
assert("isOnlineCoopRun() false when role='local' (COOP_DEBUG)", isOnlineCoopRun() === false);

// 3. true when role='host'
reset();
armPendingCoopRun({ role: 'host', seed: 1234, code: 'ABC' });
consumePendingCoopRun();
assert("isOnlineCoopRun() true when role='host'", isOnlineCoopRun() === true);

// 4. true when role='guest'
reset();
armPendingCoopRun({ role: 'guest', seed: 5678, code: 'XYZ' });
consumePendingCoopRun();
assert("isOnlineCoopRun() true when role='guest'", isOnlineCoopRun() === true);

// 5. false after clearCoopRun()
reset();
armPendingCoopRun({ role: 'host', seed: 99, code: null });
consumePendingCoopRun();
assert('isOnlineCoopRun() true before clear', isOnlineCoopRun() === true);
clearCoopRun();
assert('isOnlineCoopRun() false after clearCoopRun()', isOnlineCoopRun() === false);

// 6. Order preserved: arm host → true; clear → false; arm local → false
reset();
armPendingCoopRun({ role: 'host', seed: 1, code: null });
consumePendingCoopRun();
assert('sequence: host arm → isOnlineCoopRun true', isOnlineCoopRun() === true);
clearCoopRun();
assert('sequence: clear → isOnlineCoopRun false', isOnlineCoopRun() === false);
armPendingCoopRun({ role: 'local', seed: 2, code: null });
consumePendingCoopRun();
assert('sequence: local arm → isOnlineCoopRun false', isOnlineCoopRun() === false);

// 7. Roundtrip arm → consume → isOnlineCoopRun matches role
for (const [role, expected] of [['host', true], ['guest', true], ['local', false]]) {
  reset();
  armPendingCoopRun({ role, seed: 10, code: null });
  const consumed = consumePendingCoopRun();
  assert(
    `roundtrip role='${role}': consumed.role matches`,
    consumed?.role === role
  );
  assert(
    `roundtrip role='${role}': isOnlineCoopRun() === ${expected}`,
    isOnlineCoopRun() === expected
  );
}

// 8. All-four-states matrix
{
  const matrix = [
    { armed: false, role: null,    expectOnline: false, expectCoop: false },
    { armed: true,  role: 'local', expectOnline: false, expectCoop: true  },
    { armed: true,  role: 'host',  expectOnline: true,  expectCoop: true  },
    { armed: true,  role: 'guest', expectOnline: true,  expectCoop: true  },
  ];
  for (const { armed, role, expectOnline, expectCoop } of matrix) {
    reset();
    if (armed) {
      armPendingCoopRun({ role, seed: 1, code: null });
      consumePendingCoopRun();
    }
    const label = armed ? `role='${role}'` : 'no run';
    assert(`matrix [${label}] isCoopRun()=${expectCoop}`, isCoopRun() === expectCoop);
    assert(`matrix [${label}] isOnlineCoopRun()=${expectOnline}`, isOnlineCoopRun() === expectOnline);
  }
}

// ── shouldEndAfterRoomClear() pure logic ─────────────────────────────────────
// This captures the exact decision rule: end only for online coop after room 0.

function shouldEndAfterRoomClear(roomIndex, online) {
  return online === true && roomIndex === 0;
}

// 9. Ends online run at room 0
assert('shouldEndAfterRoomClear: online room 0 → true',
  shouldEndAfterRoomClear(0, true) === true);

// 10. Does NOT end solo/local run at room 0
assert('shouldEndAfterRoomClear: offline room 0 → false',
  shouldEndAfterRoomClear(0, false) === false);

// 11. Does NOT end online run at room 1+ (future: multi-room coop)
assert('shouldEndAfterRoomClear: online room 1 → false',
  shouldEndAfterRoomClear(1, true) === false);

// ── Results ──────────────────────────────────────────────────────────────────
console.log(`\nCoop-single-room suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
