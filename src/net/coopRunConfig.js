// Co-op run configuration — the handoff from lobby-ready to run-start.
//
// Problem this solves (C3a-pre-1):
//   `script.js init()` reseeds simRng from `?seed=` / time seed at line ~2247
//   BEFORE any lobby state is consulted. For online coop, the seed negotiated
//   during the lobby handshake (see coopSession.js) MUST win over the URL/time
//   seed or the two peers start with different RNG streams.
//
// The handoff is a one-shot armed config: the lobby's `onReady` callback arms
// it; `init()` consumes it. If a normal (solo) run starts, nothing is armed
// and init() uses its existing URL/time seeding unchanged.
//
// Design notes:
//   - One-shot: `consumePendingCoopRun()` clears the armed config. If the run
//     ends and the player starts another one without re-joining a room, it
//     correctly falls back to solo behavior.
//   - `isCoopRun()` returns true only while a run is ACTIVE under coop config.
//     The C2f gates (saveRunState, pushLeaderboardEntry, Continue Run) should
//     key off this, not `COOP_DEBUG`, so both the same-device harness and
//     real online coop trip the same protections.
//   - The `COOP_DEBUG` same-device harness also arms this via init so
//     `isCoopRun()` returns true there too (unified gate).
//   - `session` is stored as an opaque reference so C3a-pre-2 (gameplay msg
//     surface) can fetch `sendGameplay/onGameplay` from it without this
//     module importing coopSession directly.

let _pending = null;
let _active = null;

function armPendingCoopRun({ role, seed, code, session }) {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new Error('armPendingCoopRun: seed must be a finite number');
  }
  if (role !== 'host' && role !== 'guest' && role !== 'local') {
    throw new Error(`armPendingCoopRun: invalid role '${role}'`);
  }
  _pending = { role, seed: (seed >>> 0) || 1, code: code || null, session: session || null };
}

function consumePendingCoopRun() {
  if (!_pending) return null;
  _active = _pending;
  _pending = null;
  return _active;
}

function peekPendingCoopRun() {
  return _pending;
}

function clearCoopRun() {
  _pending = null;
  _active = null;
}

function isCoopRun() {
  return _active !== null;
}

function getActiveCoopRun() {
  return _active;
}

// Returns true only for real online peers (host or guest).
// solo (no run) and COOP_DEBUG (role:'local') both return false so neither
// path hits the single-room termination gate introduced in C3a-min-1.
function isOnlineCoopRun() {
  const role = _active?.role;
  return role === 'host' || role === 'guest';
}

// Phase D2 — EXACT role checks. Use these to key host-vs-guest behavior
// differences (authoritative sim ownership, snapshot producer vs consumer,
// input uplink direction). Never negate (`!isCoopGuest()`) — solo and
// COOP_DEBUG (role:'local') must fall through the host-like code path.
function isCoopHost() {
  return _active?.role === 'host';
}

function isCoopGuest() {
  return _active?.role === 'guest';
}

export {
  armPendingCoopRun,
  consumePendingCoopRun,
  peekPendingCoopRun,
  clearCoopRun,
  isCoopRun,
  getActiveCoopRun,
  isOnlineCoopRun,
  isCoopHost,
  isCoopGuest,
};
