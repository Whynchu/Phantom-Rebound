// Phase D5c — Interpolating snapshot applier (guest-side).
//
// Pure module: reads validated snapshots and mutates render targets in place.
// No transport, no DOM, no globals. D5d (local prediction) and D6
// (reconciliation) will layer on top by replacing or wrapping individual
// mutation steps; the buffer/lerp machinery here is the foundation.
//
// What changed from D5b:
//   - Snap-to-latest is replaced with a 2-snapshot interpolation buffer.
//     We keep `prev` and `curr` decoded snapshots (with their local
//     receive-time stamps) and render at `renderTimeMs - renderDelayMs`,
//     interpolating positions between prev and curr by id.
//   - Wipe-and-rebuild is replaced with upsert-by-id: enemies/bullets
//     visible in `curr` are rebuilt fresh each frame (allocates, but
//     pulls lerped position when an id is also in `prev`); ids missing
//     from `curr` despawn naturally. Local-only entities are NOT touched
//     because the loop targets gameState.enemies/bullets which on guest
//     contain only remote-driven entities (D5d/e change this).
//   - `apply()` always renders when a curr snapshot exists (so the loop
//     can advance interp time at 60 Hz even without new snapshots). It
//     only mutates buffer state when the input snapshot is genuinely
//     newer than `curr` (or runId mismatched).
//
// What this module still does NOT do (intentional D5c scope):
//   - Local prediction. Guest's own slot body is interpolated like any
//     other; D5d will replace this with predicted-state.
//   - Lag-compensated bullet spawn. Bullets visible after the host emits
//     a snapshot containing them; D5e adds predicted player bullets.
//   - Bounce-aware bullet interp. A bullet that bounced between snapshots
//     visually cuts the corner. Acceptable at 10 Hz / 100 ms delay.
//   - Boss visual fidelity. `isBoss` not on wire (carried over from D5b).
//
// Render-delay choice:
//   Default 100 ms ≈ one snapshot interval at 10 Hz. Low enough to keep
//   gameplay responsive, high enough that we always have prev+curr unless
//   a snapshot is dropped — at which point the latest-only path snaps to
//   curr and motion stutters for one frame instead of stalling.

import { isNewerSnapshot } from './coopSnapshot.js';

const TWO_PI = Math.PI * 2;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest-arc angle interpolation. Without this, an aim arrow at angle
// 3.13 → -3.13 (just past π) would spin the long way around.
function lerpAngle(a, b, t) {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  else if (d < -Math.PI) d += TWO_PI;
  return a + d * t;
}

function hydrateEnemy(snapEnemy, lerpedX, lerpedY, lerpedVx, lerpedVy, enemyTypeDefs, resolveColors) {
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
    eid: snapEnemy.id | 0,
    x: lerpedX,
    y: lerpedY,
    vx: lerpedVx,
    vy: lerpedVy,
    r: snapEnemy.r || def.r || 12,
    hp,
    maxHp,
    type,
    fT: snapEnemy.fT || 0,
    fRate: snapEnemy.fRate || def.fRate || 0,
    col: colors.col || '#ff5577',
    glowCol: colors.glowCol || colors.col || '#ff8899',
    isBoss: false,
    eliteStage: 0,
    dangerBounceBudget: 0,
    disruptorBulletCount: 0,
    disruptorCooldown: 0,
    __remote: true,
  };
}

function hydrateBullet(snapBullet, lerpedX, lerpedY, lerpedVx, lerpedVy) {
  return {
    id: snapBullet.id | 0,
    x: lerpedX,
    y: lerpedY,
    vx: lerpedVx,
    vy: lerpedVy,
    r: snapBullet.r || 6,
    type: snapBullet.type || 'p',
    state: snapBullet.state || 'output',
    ownerId: snapBullet.ownerSlot | 0,
    bounces: snapBullet.bounces | 0,
    spawnTick: snapBullet.spawnTick | 0,
    danger: snapBullet.state === 'danger',
    __remote: true,
  };
}

// Build a Map<id, entity> from a snapshot's entity list. Empty map if list
// missing. Duplicates keep the last entry seen.
function indexById(list) {
  const map = new Map();
  if (!Array.isArray(list)) return map;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e && Number.isFinite(e.id)) map.set(e.id | 0, e);
  }
  return map;
}

function applySlot(snapSlot, prevSnapSlot, slot, alpha, opts) {
  if (!slot) return;
  const skipBody = !!(opts && opts.skipBody);
  // D5d — re-anchor on lifecycle discontinuities even when the slot is
  // predicted: first snapshot for this slot (no prev) and alive-edge
  // transitions (death / respawn). Without this, a predicted body would
  // never see authoritative respawn/death teleports.
  const prevAlive = prevSnapSlot ? (prevSnapSlot.alive ? 1 : 0) : null;
  const currAlive = snapSlot.alive ? 1 : 0;
  const aliveEdge = prevAlive !== null && prevAlive !== currAlive;
  const roomChanged = !!(opts && opts.roomChanged);
  // D13.1 — same-tick death+respawn never flips the alive flag because
  // respawnGuestSlot restores hp before the snapshot serializes. Track an
  // explicit respawnSeq on the body and treat any change as a re-anchor.
  const prevRespawn = prevSnapSlot ? (prevSnapSlot.respawnSeq | 0) : null;
  const currRespawn = (snapSlot.respawnSeq | 0);
  const respawnEdge = prevRespawn !== null && prevRespawn !== currRespawn;
  const forceAnchor = !prevSnapSlot || aliveEdge || roomChanged || respawnEdge;
  const writeBody = !skipBody || forceAnchor;
  const body = (typeof slot.getBody === 'function') ? slot.getBody() : (slot.body || null);
  if (body && writeBody) {
    if (skipBody && forceAnchor) {
      // Snap to curr and zero local velocity so a stale predicted vx/vy
      // doesn't keep drifting after death / respawn re-anchor.
      body.x = snapSlot.x;
      body.y = snapSlot.y;
      body.vx = 0;
      body.vy = 0;
    } else {
      const px = prevSnapSlot ? prevSnapSlot.x : snapSlot.x;
      const py = prevSnapSlot ? prevSnapSlot.y : snapSlot.y;
      const pvx = prevSnapSlot ? (prevSnapSlot.vx || 0) : (snapSlot.vx || 0);
      const pvy = prevSnapSlot ? (prevSnapSlot.vy || 0) : (snapSlot.vy || 0);
      body.x = lerp(px, snapSlot.x, alpha);
      body.y = lerp(py, snapSlot.y, alpha);
      body.vx = lerp(pvx, snapSlot.vx || 0, alpha);
      body.vy = lerp(pvy, snapSlot.vy || 0, alpha);
    }
  }
  if (body) {
    // Discrete: take from curr (timers tick at sim rate; lerping would
    // re-introduce sub-tick fractions and confuse the renderer). Always
    // applied, even when body position is owned by local prediction —
    // these flags gate the prediction loop (don't move while dead).
    body.invincible = snapSlot.invulnT || 0;
    // D13.3 — distort wobble for hurt animation. Pulls from curr so the
    // guest sees the same hit-flicker the host renders for slot 1.
    body.distort = snapSlot.distort || 0;
    // D18.15a — coop spectator flag. Carries the dead-but-walking visual
    // state to the receiver so the partner renders translucent + frowning.
    body.coopSpectating = !!snapSlot.spectating;
    if (!snapSlot.alive) {
      if ((body.deadAt ?? 0) === 0) body.deadAt = 1;
    } else {
      body.deadAt = 0;
    }
  }
  if (slot.metrics) {
    slot.metrics.hp = snapSlot.hp || 0;
    slot.metrics.maxHp = snapSlot.maxHp || slot.metrics.maxHp || 0;
    // D18.12 — lerp charge between prev and curr snapshot so the charge
    // ring on the guest updates at render-rate (60Hz visible) instead of
    // popping at snapshot-rate (~15-20Hz). Without lerp, the ring fills
    // in discrete steps and feels "wrong pace" vs the host's smooth fill.
    // D18.13 — but snap on big jumps (room resets, boon-applied maxCharge
    // bumps, damage events that reset charge): without this, prev=80 →
    // curr=0 lerps through 40,30,20... showing a fake ramp-down between
    // rooms. Threshold: any single-snapshot delta > 50% of maxCharge is
    // a discontinuity, not a smooth fill.
    if (prevSnapSlot && Number.isFinite(prevSnapSlot.charge)) {
      const pc = prevSnapSlot.charge || 0;
      const cc = snapSlot.charge || 0;
      const maxC = snapSlot.maxCharge || prevSnapSlot.maxCharge || 1;
      if (Math.abs(cc - pc) > maxC * 0.5) {
        slot.metrics.charge = cc;
      } else {
        slot.metrics.charge = pc + (cc - pc) * alpha;
      }
    } else {
      slot.metrics.charge = snapSlot.charge || 0;
    }
    slot.metrics.stillTimer = snapSlot.stillTimer || 0;
  }
  if (slot.upg && Number.isFinite(snapSlot.maxCharge) && snapSlot.maxCharge > 0) {
    slot.upg.maxCharge = snapSlot.maxCharge;
  }
  if (slot.aim) {
    if (prevSnapSlot) {
      slot.aim.angle = lerpAngle(prevSnapSlot.aimAngle || 0, snapSlot.aimAngle || 0, alpha);
    } else {
      slot.aim.angle = snapSlot.aimAngle || 0;
    }
    // D13.4 — discrete: drives the aim-arrow render gate in drawGuestSlots.
    slot.aim.hasTarget = !!snapSlot.hasTarget;
  }
}

export function createSnapshotApplier({
  enemyTypeDefs = {},
  resolveColors = null,
  renderDelayMs = 100,
  // D5d — id of the slot whose body x/y/vx/vy is owned by local prediction.
  // When set, applySlot skips continuous body writes for that slot and only
  // re-anchors on lifecycle discontinuities (first snapshot, alive-edge).
  // Aim, hp, charge, invulnT, alive flag, maxHp, maxCharge are still applied
  // from snapshot every frame — host remains authoritative on those.
  predictedSlotId = null,
  // D13.3 — optional callback fired ONCE per fresh snapshot (not per render
  // frame) when a slot's hp dropped relative to the previous snapshot. Lets
  // the renderer spawn local-only damage numbers + sparks without putting
  // those visual events on the wire. Signature:
  //   onSlotDamage({ slotId, damage, x, y })
  onSlotDamage = null,
} = {}) {
  // Buffer: prev/curr each hold { snapshot, recvAtMs }. Newest applied
  // snapshot is `curr`; the one just before it is `prev`. Older snapshots
  // are dropped (not used for extrapolation in D5c).
  let prev = null;
  let curr = null;
  // Tracker for "is this incoming snapshot newer than what we already have?"
  // Same wrap-aware comparator as the broadcaster's own ack tracking.
  let lastAppliedSeq = null;
  let lastRunId = null;

  return {
    /**
     * Apply the latest known snapshot to render targets. Called once per
     * frame on the guest. Mutates `target.enemies`, `target.bullets`, and
     * `target.slotsById[id]` slot bundles in place.
     *
     * @param {object} snapshot - decoded snapshot (post-decodeSnapshot).
     *   May be the same reference as a previous call — buffer state is
     *   only mutated when (runId, seq) is genuinely new.
     * @param {object} target - { enemies, bullets, slotsById }
     * @param {object} [opts]
     * @param {number} [opts.snapshotRecvAtMs] - wall-clock time at which
     *   this snapshot was received locally. Used as the buffer
     *   timestamp on shift. Defaults to opts.renderTimeMs (caller
     *   equivalence: "I just got it now") if omitted.
     * @param {number} [opts.renderTimeMs] - wall-clock render time. If
     *   absent, the applier snaps to `curr` with no interpolation
     *   (D5b-compatible). When present, the applier interpolates
     *   between prev and curr at `renderTimeMs - renderDelayMs`.
     * @returns {object|null} { applied, snapshotSeq, room, score, alpha,
     *   interpolated } or null if no curr buffered yet.
     */
    apply(snapshot, target, opts) {
      if (!target || typeof target !== 'object') return null;

      const renderTimeMs = opts && Number.isFinite(opts.renderTimeMs)
        ? opts.renderTimeMs
        : null;
      const recvAtMs = opts && Number.isFinite(opts.snapshotRecvAtMs)
        ? opts.snapshotRecvAtMs
        : renderTimeMs;

      // Buffer-shift step: only when this snapshot is newer than what's
      // in curr (or run epoch changed). Subsequent same-snapshot calls
      // re-render at advancing renderTime without disturbing the buffer.
      if (snapshot && typeof snapshot === 'object' && Number.isFinite(snapshot.snapshotSeq)) {
        const runId = snapshot.runId;
        const seq = snapshot.snapshotSeq;
        let shift = false;
        if (runId !== lastRunId) {
          // Run epoch changed — reset buffer entirely. Clearing prev
          // means the first frame of the new run snaps to curr (no
          // stale interp into the new world).
          prev = null;
          curr = null;
          lastRunId = runId;
          lastAppliedSeq = null;
          shift = true;
        } else if (lastAppliedSeq == null || isNewerSnapshot(seq, lastAppliedSeq)) {
          shift = true;
        }
        if (shift) {
          // D13.3 — detect hp drops between the outgoing prev (current
          // `curr`) and the incoming snapshot. Fire onSlotDamage once per
          // detected drop. Gated on `shift` so each snapshot triggers at
          // most one notification per slot, regardless of how many render
          // frames re-apply the same `curr`.
          if (typeof onSlotDamage === 'function' && curr && curr.snapshot && Array.isArray(curr.snapshot.slots) && Array.isArray(snapshot.slots)) {
            const prevById = new Map();
            for (let i = 0; i < curr.snapshot.slots.length; i++) {
              const ps = curr.snapshot.slots[i];
              if (ps && Number.isFinite(ps.id)) prevById.set(ps.id | 0, ps);
            }
            for (let i = 0; i < snapshot.slots.length; i++) {
              const cs = snapshot.slots[i];
              if (!cs || !Number.isFinite(cs.id)) continue;
              const ps = prevById.get(cs.id | 0);
              if (!ps) continue;
              const drop = (ps.hp || 0) - (cs.hp || 0);
              if (drop > 0) {
                try {
                  onSlotDamage({
                    slotId: cs.id | 0,
                    damage: drop,
                    x: cs.x,
                    y: cs.y,
                  });
                } catch (_) {}
              }
            }
          }
          prev = curr;
          curr = { snapshot, recvAtMs: Number.isFinite(recvAtMs) ? recvAtMs : 0 };
          lastAppliedSeq = seq;
        }
      }

      if (!curr) return null;

      // Decide alpha. Without renderTimeMs we behave as "snap to curr".
      let alpha = 1;
      let interpolated = false;
      if (prev && renderTimeMs != null) {
        const targetT = renderTimeMs - renderDelayMs;
        if (targetT <= prev.recvAtMs) {
          alpha = 0;
          interpolated = true;
        } else if (targetT >= curr.recvAtMs) {
          alpha = 1; // beyond newest — snap to curr (no extrapolation in D5c)
        } else {
          const span = curr.recvAtMs - prev.recvAtMs;
          alpha = span > 0 ? (targetT - prev.recvAtMs) / span : 1;
          interpolated = true;
        }
      }

      const currSnap = curr.snapshot;
      const prevSnap = prev ? prev.snapshot : null;

      // Enemies — upsert by id, dropping ids missing from curr.
      if (Array.isArray(target.enemies)) {
        const prevById = indexById(prevSnap && prevSnap.enemies);
        target.enemies.length = 0;
        const list = Array.isArray(currSnap.enemies) ? currSnap.enemies : [];
        for (let i = 0; i < list.length; i++) {
          const ce = list[i];
          if (!ce) continue;
          const pe = prevById.get(ce.id | 0);
          const lx = pe ? lerp(pe.x, ce.x, alpha) : ce.x;
          const ly = pe ? lerp(pe.y, ce.y, alpha) : ce.y;
          const lvx = pe ? lerp(pe.vx || 0, ce.vx || 0, alpha) : (ce.vx || 0);
          const lvy = pe ? lerp(pe.vy || 0, ce.vy || 0, alpha) : (ce.vy || 0);
          target.enemies.push(hydrateEnemy(ce, lx, ly, lvx, lvy, enemyTypeDefs, resolveColors));
        }
      }

      // Bullets — same upsert-by-id pattern. Bullets also lerp position;
      // visible state (output|grey|danger) and bounce count come from curr.
      if (Array.isArray(target.bullets)) {
        const prevById = indexById(prevSnap && prevSnap.bullets);
        target.bullets.length = 0;
        const list = Array.isArray(currSnap.bullets) ? currSnap.bullets : [];
        for (let i = 0; i < list.length; i++) {
          const cb = list[i];
          if (!cb) continue;
          const pb = prevById.get(cb.id | 0);
          const lx = pb ? lerp(pb.x, cb.x, alpha) : cb.x;
          const ly = pb ? lerp(pb.y, cb.y, alpha) : cb.y;
          const lvx = pb ? lerp(pb.vx || 0, cb.vx || 0, alpha) : (cb.vx || 0);
          const lvy = pb ? lerp(pb.vy || 0, cb.vy || 0, alpha) : (cb.vy || 0);
          target.bullets.push(hydrateBullet(cb, lx, ly, lvx, lvy));
        }
      }

      // Slots — match by id. Body x/y/vx/vy + aimAngle are lerped; hp,
      // charge, invulnT etc. come from curr (discrete values).
      const slotsById = target.slotsById || {};
      const slotList = Array.isArray(currSnap.slots) ? currSnap.slots : [];
      const prevSlotsById = new Map();
      if (prevSnap && Array.isArray(prevSnap.slots)) {
        for (let i = 0; i < prevSnap.slots.length; i++) {
          const ps = prevSnap.slots[i];
          if (ps && Number.isFinite(ps.id)) prevSlotsById.set(ps.id | 0, ps);
        }
      }
      const prevRoomIdx = prevSnap && prevSnap.room ? (prevSnap.room.index | 0) : null;
      const currRoomIdx = currSnap.room ? (currSnap.room.index | 0) : 0;
      const roomChanged = prevRoomIdx !== null && prevRoomIdx !== currRoomIdx;
      for (let i = 0; i < slotList.length; i++) {
        const cs = slotList[i];
        if (!cs) continue;
        const slotTarget = slotsById[cs.id];
        if (!slotTarget) continue;
        applySlot(cs, prevSlotsById.get(cs.id | 0) || null, slotTarget, alpha, {
          skipBody: predictedSlotId !== null && (cs.id | 0) === (predictedSlotId | 0),
          roomChanged,
        });
      }

      const room = currSnap.room || { index: 0, phase: 'intro', clearTimer: 0 };
      return {
        applied: true,
        snapshotSeq: currSnap.snapshotSeq | 0,
        snapshotSimTick: currSnap.snapshotSimTick | 0,
        room: {
          index: room.index | 0,
          phase: room.phase || 'intro',
          clearTimer: room.clearTimer || 0,
        },
        score: currSnap.score | 0,
        alpha,
        interpolated,
      };
    },

    // Test/diagnostic accessors.
    getLastAppliedSeq() { return lastAppliedSeq; },
    getLastRunId() { return lastRunId; },
    getBufferDepth() { return (prev ? 1 : 0) + (curr ? 1 : 0); },
    reset() {
      prev = null; curr = null; lastAppliedSeq = null; lastRunId = null;
    },
  };
}
