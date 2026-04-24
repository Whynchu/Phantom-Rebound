// Phase C2f — coop-mode gating contract tests.
//
// Verifies the algorithmic shape of the save/leaderboard/continue gates.
// The real functions close over module-scope COOP_DEBUG + the DOM, so we
// port the decision logic to a pure form and test those.

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { console.log(`PASS ${name}`); pass++; }
  else { console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

// --- ported decision functions ---
function shouldSaveRun(coopDebug) {
  if (coopDebug) return false;
  return true;
}

function shouldSubmitLeaderboard(coopDebug) {
  if (coopDebug) return false;
  return true;
}

function resolveContinueRun(coopDebug, storedRun) {
  // Mirrors: const savedRun = COOP_DEBUG ? null : loadSavedRun();
  if (coopDebug) return null;
  return storedRun;
}

// --- tests ---

// Save gate
assert('solo saves run state', shouldSaveRun(false) === true);
assert('coop does NOT save run state', shouldSaveRun(true) === false);

// Leaderboard gate
assert('solo submits to leaderboard', shouldSubmitLeaderboard(false) === true);
assert('coop does NOT submit to leaderboard', shouldSubmitLeaderboard(true) === false);

// Continue-run gate
{
  const storedRun = { roomIndex: 5, score: 1234 };
  const result = resolveContinueRun(false, storedRun);
  assert('solo surfaces stored run for continue', result === storedRun);
}
{
  const storedRun = { roomIndex: 5, score: 1234 };
  const result = resolveContinueRun(true, storedRun);
  assert('coop ignores stored run (returns null)', result === null);
}
{
  const result = resolveContinueRun(false, null);
  assert('solo with no stored run returns null', result === null);
}
{
  const result = resolveContinueRun(true, null);
  assert('coop with no stored run returns null', result === null);
}

// Determinism — gates are pure functions of coopDebug
{
  const a = shouldSaveRun(true), b = shouldSaveRun(true), c = shouldSaveRun(true);
  assert('shouldSaveRun is deterministic', a === b && b === c);
}
{
  const a = shouldSubmitLeaderboard(true), b = shouldSubmitLeaderboard(true);
  assert('shouldSubmitLeaderboard is deterministic', a === b);
}

console.log(`Coop-gating suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
