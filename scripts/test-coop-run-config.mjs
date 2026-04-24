// C3a-pre-1 contract tests for src/net/coopRunConfig.js.

import {
  armPendingCoopRun,
  consumePendingCoopRun,
  peekPendingCoopRun,
  clearCoopRun,
  isCoopRun,
  getActiveCoopRun,
} from '../src/net/coopRunConfig.js';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { console.log(`PASS ${name}`); pass++; }
  else { console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

function reset() { clearCoopRun(); }

// initial state
reset();
assert('isCoopRun() is false before arm', isCoopRun() === false);
assert('peekPendingCoopRun() is null before arm', peekPendingCoopRun() === null);
assert('consumePendingCoopRun() returns null before arm', consumePendingCoopRun() === null);
assert('getActiveCoopRun() null before arm', getActiveCoopRun() === null);

// arm + peek
reset();
armPendingCoopRun({ role: 'host', seed: 1234, code: 'ABC123', session: { fake: 1 } });
{
  const p = peekPendingCoopRun();
  assert('peek returns armed config', p && p.role === 'host' && p.seed === 1234 && p.code === 'ABC123');
}
assert('isCoopRun() still false until consumed', isCoopRun() === false);

// consume
{
  const c = consumePendingCoopRun();
  assert('consume returns armed config', c && c.role === 'host' && c.seed === 1234);
  assert('isCoopRun() true after consume', isCoopRun() === true);
  assert('peek returns null after consume', peekPendingCoopRun() === null);
  assert('consume again returns null (one-shot)', consumePendingCoopRun() === null);
  assert('active config available', getActiveCoopRun()?.role === 'host');
}

// clear
reset();
armPendingCoopRun({ role: 'guest', seed: 99, code: 'XYZ' });
consumePendingCoopRun();
clearCoopRun();
assert('clearCoopRun() resets isCoopRun to false', isCoopRun() === false);
assert('clearCoopRun() resets active to null', getActiveCoopRun() === null);

// seed coercion
reset();
armPendingCoopRun({ role: 'local', seed: -1, code: null });
{
  const c = consumePendingCoopRun();
  assert('negative seed coerced to uint32', c.seed >>> 0 === c.seed && c.seed > 0);
}

reset();
armPendingCoopRun({ role: 'local', seed: 0, code: null });
{
  const c = consumePendingCoopRun();
  assert('zero seed coerced to 1 (avoid all-zero state)', c.seed === 1);
}

// validation
reset();
let threw = false;
try { armPendingCoopRun({ role: 'host', seed: 'nope' }); } catch { threw = true; }
assert('non-numeric seed throws', threw);

reset();
threw = false;
try { armPendingCoopRun({ role: 'host', seed: NaN }); } catch { threw = true; }
assert('NaN seed throws', threw);

reset();
threw = false;
try { armPendingCoopRun({ role: 'bogus', seed: 1 }); } catch { threw = true; }
assert('invalid role throws', threw);

// role variants all accepted
reset();
for (const role of ['host', 'guest', 'local']) {
  try {
    armPendingCoopRun({ role, seed: 1 });
    assert(`role '${role}' accepted`, peekPendingCoopRun()?.role === role);
    clearCoopRun();
  } catch {
    assert(`role '${role}' accepted`, false);
  }
}

// re-arming overwrites pending (not-yet-consumed)
reset();
armPendingCoopRun({ role: 'host', seed: 100 });
armPendingCoopRun({ role: 'guest', seed: 200 });
assert('re-arm overwrites pending', peekPendingCoopRun()?.seed === 200);

console.log(`Coop-run-config suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
