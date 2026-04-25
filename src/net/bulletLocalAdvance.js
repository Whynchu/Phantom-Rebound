// D19.1 — Guest-side bullet local-advance pool.
//
// Background: guests render the body at sim-time-now (predicted forward
// each tick from input), but bullets/enemies/dangers were rendered at
// sim-time-now-renderDelayMs via prev/curr snapshot lerp. That meant
// the body and bullets lived on different clocks, and visual moments
// of contact (especially grey-bullet pickups) felt off — body glides
// through where bullet "was" 70 ms ago.
//
// This module narrows the gap for the bullet states we can model
// cheaply and accurately: 'output' (player shots) and 'danger' (enemy
// shots). It maintains its own pool of bullets keyed by id, advances
// them with a fixed-timestep accumulator (matching host's 60 Hz sim
// cadence + 6-substep cap from script.js update() bullet block), and
// reconciles against authoritative snapshots once per shift.
//
// Out of scope for D19.1 (intentional; rubber-duck flagged these as
// risky without additional wire fields):
//   - 'grey' bullets (decelerate every host tick — straight-line model
//     would drift and the body-vs-grey misalignment is already small
//     because both move slowly)
//   - charge orbs / triangle bursts (host owns spawn timing of children)
//   - homing/splitting output bullets (need behavior fields on wire)
//   - obstacle bounces (obstacle data not on wire)
//   - gravity-well bullet speed mods
//
// The reconciler thresholds catch divergence from these unmodeled
// behaviors: if the host ran the bullet through obstacle-bounce or
// homing logic and our linear advance disagrees by > 24 px, we hard
// snap to authoritative; > 6 px we soft pull at 30%; ≤ 6 px we leave
// position alone and just refresh velocity.
//
// Determinism: this module is constructed only on guest. Solo / host
// / COOP_DEBUG never instantiate it. Determinism canary unaffected.

const RECONCILE_HARD_SNAP_PX = 24;
const RECONCILE_SOFT_THRESH_PX = 6;
const RECONCILE_SOFT_FACTOR = 0.30;
const FIXED_TICK_S = 1 / 60;

// States we predict locally. Everything else falls through to the
// applier's snapshot-lerp path (caller is responsible for not
// double-rendering — see filtering in script.js after applier.apply).
const PREDICTABLE_STATES = new Set(['output', 'danger']);

function isPredictableBullet(b) {
  return !!(b && b.state && PREDICTABLE_STATES.has(b.state));
}

// Step a bullet forward by stepDt seconds with arena-wall bounce. Mirrors
// host's bullet bounce block in script.js update() (the M/W/H corners +
// abs/-abs reflection + radius clamp). Obstacle bounces are intentionally
// omitted — see header.
function stepBulletOnce(b, stepDt, W, H, M) {
  b.x += b.vx * stepDt;
  b.y += b.vy * stepDt;
  if (b.x - b.r < M) { b.x = M + b.r; b.vx = Math.abs(b.vx); }
  if (b.x + b.r > W - M) { b.x = W - M - b.r; b.vx = -Math.abs(b.vx); }
  if (b.y - b.r < M) { b.y = M + b.r; b.vy = Math.abs(b.vy); }
  if (b.y + b.r > H - M) { b.y = H - M - b.r; b.vy = -Math.abs(b.vy); }
}

// Advance a bullet by `dt` seconds at host's sub-stepping cadence: divide
// dt into ≤6 substeps when fast bullets would travel >10 px in a single
// step. Same formula as script.js:5510 host loop.
function stepBullet(b, dt, W, H, M) {
  const maxTravel = Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt;
  const subSteps = Math.min(6, Math.max(1, Math.ceil(maxTravel / 10)));
  const sd = dt / subSteps;
  for (let s = 0; s < subSteps; s++) stepBulletOnce(b, sd, W, H, M);
}

// Construct a guest-side bullet local-advance pool. `getWorldSize` returns
// `{ w, h }`; `wallMargin` is the arena bounce inset (host const M=18).
function createBulletLocalAdvance({ wallMargin, getWorldSize } = {}) {
  if (typeof getWorldSize !== 'function') {
    throw new Error('bulletLocalAdvance: getWorldSize() required');
  }
  const M = Number.isFinite(wallMargin) ? wallMargin : 18;
  const local = new Map();
  let pendingDt = 0;

  function readWorld() {
    const ws = getWorldSize() || {};
    return { W: ws.w | 0, H: ws.h | 0 };
  }

  // Drive the local pool forward by dt seconds (real frame dt). Uses a
  // fixed-tick accumulator to avoid render-dt jitter affecting position
  // reconcile thresholds.
  function advance(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    pendingDt += dt;
    // Cap to avoid catastrophic catch-up on first frame after long pause.
    if (pendingDt > 0.25) pendingDt = 0.25;
    const { W, H } = readWorld();
    if (W <= 0 || H <= 0) { pendingDt = 0; return; }
    while (pendingDt >= FIXED_TICK_S) {
      pendingDt -= FIXED_TICK_S;
      for (const b of local.values()) stepBullet(b, FIXED_TICK_S, W, H, M);
    }
  }

  // Project an authoritative bullet (state at host's snapshotSimTick)
  // forward to the guest's current sim tick using the same linear+bounce
  // model. ticksElapsed clamped to [0, 60] to keep first-sight pop-in
  // bounded if a snapshot arrives wildly stale.
  function ageAuthForward(authBullet, ticksElapsed, W, H) {
    const t = Math.min(60, Math.max(0, ticksElapsed | 0));
    if (t === 0) return { x: authBullet.x, y: authBullet.y, vx: authBullet.vx, vy: authBullet.vy };
    const tmp = {
      x: authBullet.x, y: authBullet.y,
      vx: authBullet.vx, vy: authBullet.vy,
      r: authBullet.r,
    };
    for (let i = 0; i < t; i++) stepBulletOnce(tmp, FIXED_TICK_S, W, H, M);
    return { x: tmp.x, y: tmp.y, vx: tmp.vx, vy: tmp.vy };
  }

  // Reconcile against a fresh snapshot. Caller must ensure this is invoked
  // only once per snapshot SHIFT (not every render frame). Non-predictable
  // bullets in the snapshot are ignored — they remain on the legacy
  // applier path. Predictable bullets missing from the snapshot are
  // dropped immediately (no fade-out — host has spoken, the bullet is
  // gone). ticksElapsed = guest simTick - snapshot's snapshotSimTick.
  function reconcile(snapBullets, ticksElapsed) {
    if (!Array.isArray(snapBullets)) return;
    const { W, H } = readWorld();
    const seen = new Set();
    for (let i = 0; i < snapBullets.length; i++) {
      const ab = snapBullets[i];
      if (!ab || !Number.isFinite(ab.id)) continue;
      if (!isPredictableBullet(ab)) continue;
      const id = ab.id | 0;
      seen.add(id);
      const aged = ageAuthForward(ab, ticksElapsed, W, H);
      const existing = local.get(id);
      if (!existing) {
        local.set(id, {
          id,
          x: aged.x, y: aged.y,
          vx: aged.vx, vy: aged.vy,
          r: ab.r || 6,
          type: ab.type || 'p',
          state: ab.state,
          ownerId: (ab.ownerSlot | 0),
          bounces: (ab.bounces | 0),
          spawnTick: (ab.spawnTick | 0),
          danger: ab.state === 'danger',
          __remote: true,
          __predicted: true,
        });
        continue;
      }
      const dx = aged.x - existing.x;
      const dy = aged.y - existing.y;
      const dist = Math.hypot(dx, dy);
      if (dist > RECONCILE_HARD_SNAP_PX) {
        existing.x = aged.x;
        existing.y = aged.y;
        existing.vx = aged.vx;
        existing.vy = aged.vy;
      } else if (dist > RECONCILE_SOFT_THRESH_PX) {
        existing.x += dx * RECONCILE_SOFT_FACTOR;
        existing.y += dy * RECONCILE_SOFT_FACTOR;
        existing.vx = aged.vx;
        existing.vy = aged.vy;
      } else {
        existing.vx = aged.vx;
        existing.vy = aged.vy;
      }
      // discrete refreshes
      existing.r = ab.r || existing.r;
      existing.bounces = ab.bounces | 0;
      existing.state = ab.state;
      existing.danger = ab.state === 'danger';
    }
    // immediate despawn of ids missing from this snapshot
    for (const id of [...local.keys()]) {
      if (!seen.has(id)) local.delete(id);
    }
  }

  // Snapshot of the pool's bullets, suitable for splicing into the
  // game's render-time bullets[] array. Returns fresh objects so caller
  // mutations don't disturb internal state.
  function getBullets() {
    const out = [];
    for (const b of local.values()) {
      out.push({
        id: b.id,
        x: b.x, y: b.y, vx: b.vx, vy: b.vy,
        r: b.r, type: b.type, state: b.state,
        ownerId: b.ownerId,
        bounces: b.bounces,
        spawnTick: b.spawnTick,
        danger: b.danger,
        __remote: true,
        __predicted: true,
      });
    }
    return out;
  }

  function clear() { local.clear(); pendingDt = 0; }
  function size() { return local.size; }
  function has(id) { return local.has(id | 0); }

  return {
    advance,
    reconcile,
    getBullets,
    clear,
    size,
    has,
    // exposed for tests
    _internal: {
      get pool() { return local; },
      RECONCILE_HARD_SNAP_PX,
      RECONCILE_SOFT_THRESH_PX,
      RECONCILE_SOFT_FACTOR,
      FIXED_TICK_S,
      PREDICTABLE_STATES,
    },
  };
}

export {
  createBulletLocalAdvance,
  isPredictableBullet,
  PREDICTABLE_STATES,
  RECONCILE_HARD_SNAP_PX,
  RECONCILE_SOFT_THRESH_PX,
  RECONCILE_SOFT_FACTOR,
};
