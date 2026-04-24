// Phase D5b — Snap-to-latest snapshot applier (guest-side).
//
// Pure function module: reads a (validated) snapshot and mutates the
// caller-provided render targets in place. No transport, no DOM, no globals.
// Built so that D5c (interpolation), D5d (local prediction), and D6
// (reconciliation) can layer on top without rewriting this module — they
// will each replace or wrap individual mutation steps (e.g. interpolated
// position writes instead of raw snap, predicted slot body instead of
// snapshot slot body).
//
// What this module does NOT do (intentional D5b scope):
//   - Local prediction. Guest's own slot body is snapped to host's last
//     known position; D5d will replace this with predicted-state.
//   - Interpolation. State jumps to the latest snapshot; D5c will buffer.
//   - Lag-compensated bullet spawn. Bullets visible after the host emits
//     a snapshot containing them, never before; D5e will pre-render
//     predicted player bullets.
//   - Boss visual fidelity. `isBoss` is not on the wire — guest derives
//     visuals from ENEMY_TYPES[type] only. Boss HP-bar and "★ BOSS"
//     label may be wrong on guest until a follow-up adds the flag.
//
// Sequence handling (rubber-duck D5b finding):
//   - The applier remembers the last snapshotSeq it actually applied per
//     runId. Snap-to-latest at 60 Hz against a 10 Hz feed would otherwise
//     thrash arrays uselessly. createSnapshotApplier() returns a closure
//     that no-ops when the snapshot is not newer than the last applied.
//   - runId mismatch resets the seq tracker (host restarted / new run).
//
// Slot mapping (rubber-duck D5b finding):
//   - Slots are matched by `slot.id`, not array index. The applier accepts
//     an `slotsById` map keyed by id (0=host, 1=guest in wire format).

import { isNewerSnapshot } from './coopSnapshot.js';

// Build a render-ready enemy object from a snapshot enemy entry. The wire
// only carries position/velocity/hp/maxHp/r/type/fT/fRate. Visual flags
// (isElite, doubleBounce, forcePurpleShots, isTriangle, isSiphon, isRusher,
// label, etc.) are static-per-type and are read from `enemyTypeDefs[type]`.
// `resolveColors(type)` callback returns { col, glowCol } from the active
// player palette (host and guest may have different palettes — that's
// acceptable cosmetic divergence for D5b).
function hydrateEnemy(snapEnemy, enemyTypeDefs, resolveColors) {
  const type = snapEnemy.type || 'chaser';
  const def = (enemyTypeDefs && enemyTypeDefs[type]) || {};
  const colors = (typeof resolveColors === 'function')
    ? (resolveColors(type, def) || {})
    : {};
  const hp = Number.isFinite(snapEnemy.hp) ? snapEnemy.hp : 0;
  const maxHp = Number.isFinite(snapEnemy.maxHp) && snapEnemy.maxHp > 0
    ? snapEnemy.maxHp
    : Math.max(hp, 1);
  return {
    // Type-static visual + behavioral defaults (booleans default false via ??).
    label: def.label || null,
    colorRole: def.colorRole || 'danger',
    isElite: !!def.isElite,
    isTriangle: !!def.isTriangle,
    isSiphon: !!def.isSiphon,
    isRusher: !!def.isRusher,
    doubleBounce: !!def.doubleBounce,
    forcePurpleShots: !!def.forcePurpleShots,
    spd: def.spd || 0,
    burst: def.burst || 0,
    spread: def.spread || 0,
    pts: def.pts || 0,
    // Wire-driven dynamic state.
    eid: snapEnemy.id | 0,
    x: snapEnemy.x,
    y: snapEnemy.y,
    vx: snapEnemy.vx || 0,
    vy: snapEnemy.vy || 0,
    r: snapEnemy.r || def.r || 12,
    hp,
    maxHp,
    type,
    fT: snapEnemy.fT || 0,
    fRate: snapEnemy.fRate || def.fRate || 0,
    // Color: prefer caller-resolved from active palette; otherwise use a
    // safe fallback so renderer never gets undefined fillStyle.
    col: colors.col || '#ff5577',
    glowCol: colors.glowCol || colors.col || '#ff8899',
    // Renderer-touched dynamic flags. Defaulting to safe zero-state so
    // getEnemyBounceRingCount, HP-bar, and label paths don't crash.
    isBoss: false, // not on wire (D5b limitation)
    eliteStage: 0,
    dangerBounceBudget: 0,
    disruptorBulletCount: 0,
    disruptorCooldown: 0,
    // Tag so debug tooling can distinguish remote-applied from local-sim'd.
    __remote: true,
  };
}

function hydrateBullet(snapBullet) {
  return {
    id: snapBullet.id | 0,
    x: snapBullet.x,
    y: snapBullet.y,
    vx: snapBullet.vx || 0,
    vy: snapBullet.vy || 0,
    r: snapBullet.r || 6,
    type: snapBullet.type || 'p',
    state: snapBullet.state || 'output',
    ownerId: snapBullet.ownerSlot | 0,
    bounces: snapBullet.bounces | 0,
    spawnTick: snapBullet.spawnTick | 0,
    // Renderer reads .danger as a fallback discriminator some places.
    danger: snapBullet.state === 'danger',
    __remote: true,
  };
}

function applySlot(snapSlot, slot) {
  if (!slot) return;
  const body = (typeof slot.getBody === 'function') ? slot.getBody() : (slot.body || null);
  if (body) {
    body.x = snapSlot.x;
    body.y = snapSlot.y;
    body.vx = snapSlot.vx || 0;
    body.vy = snapSlot.vy || 0;
    body.invincible = snapSlot.invulnT || 0;
    // deadAt convention: 0 means alive.
    if (!snapSlot.alive) {
      if ((body.deadAt ?? 0) === 0) body.deadAt = 1; // marker; exact value not consumed by renderer
    } else {
      body.deadAt = 0;
    }
  }
  if (slot.metrics) {
    slot.metrics.hp = snapSlot.hp || 0;
    slot.metrics.maxHp = snapSlot.maxHp || slot.metrics.maxHp || 0;
    slot.metrics.charge = snapSlot.charge || 0;
    slot.metrics.stillTimer = snapSlot.stillTimer || 0;
  }
  if (slot.upg && Number.isFinite(snapSlot.maxCharge) && snapSlot.maxCharge > 0) {
    slot.upg.maxCharge = snapSlot.maxCharge;
  }
  if (slot.aim) {
    slot.aim.angle = snapSlot.aimAngle || 0;
  }
}

// Factory: each applier instance keeps its own seq/runId memory. Tests
// (and theoretically multiple peer connections in the future) can spin
// up isolated appliers.
export function createSnapshotApplier({ enemyTypeDefs = {}, resolveColors = null } = {}) {
  let lastAppliedSeq = null;
  let lastRunId = null;

  return {
    /**
     * Apply a (decoded) snapshot to the target world. Mutates target in place.
     *
     * @param {object} snapshot - decoded snapshot (passed through decodeSnapshot
     *   already; this function does not re-validate scalars).
     * @param {object} target - { enemies, bullets, slotsById }
     *   - enemies: mutable array (e.g. gameState.enemies). Cleared & rebuilt.
     *   - bullets: mutable array. Cleared & rebuilt.
     *   - slotsById: { 0: slot|null, 1: slot|null } — slot bundles to update.
     * @returns {object|null} { applied, room, score, snapshotSimTick } if
     *   applied, or null if the snapshot was older than last applied (no-op).
     */
    apply(snapshot, target) {
      if (!snapshot || typeof snapshot !== 'object') return null;
      if (!target || typeof target !== 'object') return null;

      const runId = snapshot.runId;
      const seq = snapshot.snapshotSeq;

      if (runId !== lastRunId) {
        // New run epoch — reset memory and accept.
        lastRunId = runId;
        lastAppliedSeq = null;
      } else if (lastAppliedSeq != null && !isNewerSnapshot(seq, lastAppliedSeq)) {
        // Same run, same-or-older seq — no-op (newest-wins, no thrash).
        return null;
      }

      lastAppliedSeq = seq;

      const enemiesArr = Array.isArray(target.enemies) ? target.enemies : null;
      const bulletsArr = Array.isArray(target.bullets) ? target.bullets : null;
      const slotsById = target.slotsById || {};

      // Wipe-and-rebuild enemies. D5c will replace with upsert-by-id +
      // interpolation buffer.
      if (enemiesArr) {
        enemiesArr.length = 0;
        const list = Array.isArray(snapshot.enemies) ? snapshot.enemies : [];
        for (let i = 0; i < list.length; i++) {
          enemiesArr.push(hydrateEnemy(list[i], enemyTypeDefs, resolveColors));
        }
      }

      if (bulletsArr) {
        bulletsArr.length = 0;
        const list = Array.isArray(snapshot.bullets) ? snapshot.bullets : [];
        for (let i = 0; i < list.length; i++) {
          bulletsArr.push(hydrateBullet(list[i]));
        }
      }

      // Slots: match by id (0=host, 1=guest in wire format), NOT by array
      // position. Snapshot.slots is sparse-tolerant.
      const slotList = Array.isArray(snapshot.slots) ? snapshot.slots : [];
      for (let i = 0; i < slotList.length; i++) {
        const snapSlot = slotList[i];
        if (!snapSlot) continue;
        const slotTarget = slotsById[snapSlot.id];
        if (!slotTarget) continue;
        applySlot(snapSlot, slotTarget);
      }

      const room = snapshot.room || { index: 0, phase: 'intro', clearTimer: 0, spawnQueueLen: 0 };
      return {
        applied: true,
        snapshotSeq: seq,
        snapshotSimTick: snapshot.snapshotSimTick | 0,
        room: {
          index: room.index | 0,
          phase: room.phase || 'intro',
          clearTimer: room.clearTimer || 0,
        },
        score: snapshot.score | 0,
        // elapsedMs is intentionally NOT returned — guest advances its own
        // run timer locally (rubber-duck D5b finding: overwriting it every
        // applied snapshot would cause stutter/jump backward between ~10 Hz
        // arrivals). D6 reconciliation will revisit if it matters for sync.
      };
    },

    // Test/diagnostic accessors.
    getLastAppliedSeq() { return lastAppliedSeq; },
    getLastRunId() { return lastRunId; },
    reset() { lastAppliedSeq = null; lastRunId = null; },
  };
}
