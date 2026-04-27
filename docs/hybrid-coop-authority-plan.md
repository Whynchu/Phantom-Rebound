# Hybrid Coop Authority Plan

**Status:** proposed recovery architecture  
**Branch:** `coop` on `experimental-origin`  
**Created:** 2026-04-27  
**Context builds:** v1.20.143-v1.20.150 rollback playtests

---

## Why This Plan Exists

Phantom Rebound has now tested two incomplete coop models:

1. **D-series snapshots:** gameplay authority mostly worked, but the guest felt like they were streaming the host's game. Input delay and delayed local feedback were unacceptable.
2. **R-series full rollback:** input felt better in places, but the game is not deterministic enough for full combat rollback. Enemies, bullets, kills, pickups, and room progression can diverge. v1.20.150 logs also show guest-side rollback input starvation, causing rollback stalls and disconnects.

The correct path is not pure snapshots and not full rollback. The target is a **hybrid host-authoritative model with local prediction**:

- Guest controls feel instant.
- Host owns combat truth.
- Snapshots/events correct and confirm state; they do not drive every input response.
- Rollback is reserved for small deterministic islands after the authority model is stable.

---

## Core Contract

### Host Owns Truth

The host is authoritative for:

- Enemy positions, HP, death, spawn/despawn, and AI state.
- Enemy bullets and enemy bullet collisions.
- Player bullet hit confirmation.
- Pickups and pickup collection.
- Room phase, room clear, boon/reward entry, score, and kill counts.
- Player HP/damage/death/respawn outcomes.
- Damage number and pickup effect events that represent confirmed gameplay.

### Guest Owns Feel

The guest may predict locally:

- Their own player movement.
- Their own fire animation and pending bullet visuals.
- Local charge/HUD affordances that can be reconciled.
- Cosmetic particles that do not imply confirmed damage or pickups.

The guest must not decide:

- Enemy death.
- Enemy HP mutation.
- Room clear.
- Pickup ownership.
- Score/kills/rewards.
- Enemy bullet damage outcomes.

### Snapshots Are Correction Anchors

Snapshots should not be treated as video streaming. They are periodic host-authored state anchors used to:

- Keep remote enemies/bullets visually aligned.
- Repair packet loss or missed events.
- Reconcile guest predicted entities.
- Provide desync hashes and diagnostics.

Authoritative events should carry immediate gameplay outcomes between snapshots.

---

## Runtime Shape

### Guest Loop

Guest frame/tick behavior:

1. Sample local input.
2. Move the guest body immediately using local prediction.
3. Send input/action frames to host.
4. Render predicted local player and pending local shots.
5. Apply host events as they arrive.
6. Interpolate host snapshots for enemies, enemy bullets, pickups, remote player, room state, and confirmed projectile state.
7. Reconcile pending local predictions against host confirmations/rejections.

The guest does not run enemy AI, enemy bullet collision, enemy HP/death, room progression, or pickup collection as authoritative simulation.

### Host Loop

Host frame/tick behavior:

1. Sample host input.
2. Consume latest guest input frames.
3. Simulate the full authoritative game.
4. Emit authoritative events for gameplay outcomes.
5. Emit periodic compact snapshots with state hashes.

The host may use guest position/input stamps to keep guest movement responsive and fair, but host remains the source of truth for outcomes.

---

## Message Contracts

### Input Frame: Guest to Host

Sent at fixed cadence or batched.

```js
{
  kind: 'coop-input',
  seq: 1234,
  tick: 5678,
  slot: 1,
  joy: { dx, dy, mag, active },
  x, y,
  fireHeld,
  clientTimeMs
}
```

Rules:

- `seq` is monotonic per sender.
- `x/y` are guest-predicted display position stamps, not authority.
- Host may clamp/reject impossible deltas.
- Missing frames should not pause host combat; host uses last valid input with age limits.

### Action Frame: Guest to Host

Optional if firing needs more detail than input frames.

```js
{
  kind: 'coop-action',
  seq: 220,
  tick: 5700,
  action: 'fire',
  slot: 1,
  localShotId: 901,
  originX, originY,
  aimX, aimY,
  chargeSpent
}
```

Rules:

- Guest can render `localShotId` immediately as pending.
- Host confirms, corrects, or rejects the shot.

### Authoritative Event: Host to Guest

Sent immediately when gameplay truth changes.

```js
{
  kind: 'coop-event-batch',
  seq: 880,
  hostTick: 5740,
  events: [
    {
      type: 'enemyHit',
      enemyId,
      damage,
      hpAfter,
      ownerSlot,
      localShotId,
      x, y
    },
    {
      type: 'enemyKilled',
      enemyId,
      ownerSlot,
      scoreDelta,
      x, y
    },
    {
      type: 'pickupCollected',
      pickupId,
      slot,
      kind,
      x, y
    },
    {
      type: 'playerDamaged',
      slot,
      damage,
      hpAfter,
      sourceId,
      x, y
    },
    {
      type: 'roomPhase',
      roomIndex,
      phase
    }
  ]
}
```

Rules:

- Events are idempotent by `(seq, type, id)` or dedicated event id.
- Guest never infers enemy death without `enemyKilled` or snapshot absence plus host state hash agreement.
- Damage numbers come from confirmed `enemyHit` / `playerDamaged` events.

### Snapshot: Host to Guest

Sent at a lower fixed rate, e.g. 10-20 Hz, plus on room transitions.

```js
{
  kind: 'coop-snapshot',
  seq,
  hostTick,
  room: { index, phase, timer },
  slots: [{ id, x, y, vx, vy, hp, maxHp, charge, alive }],
  enemies: [{ id, type, x, y, vx, vy, hp, maxHp, fT, flags }],
  bullets: [{ id, ownerSlot, state, x, y, vx, vy, r, flags }],
  pickups: [{ id, kind, x, y }],
  score,
  hashes: {
    enemies,
    bullets,
    pickups,
    room
  }
}
```

Rules:

- Snapshot is authoritative for non-local world state.
- Guest interpolates enemies/bullets from snapshots.
- Snapshot can repair missed events.
- Snapshot should include enough flags to render bounce rings, triangle bullets, elite stages, grey bullets, and owner colors correctly.

---

## Prediction And Reconciliation

### Guest Player Movement

Guest body movement stays local and immediate. Host snapshots should not hard-snap the guest body every frame.

Reconcile rules:

- Small correction: blend over 80-150 ms.
- Medium correction: fast blend over 40-80 ms.
- Large correction, death, room transition, respawn: snap.
- Host should not constantly overwrite the local body unless the guest is invalid or stale.

### Guest Bullets

Guest bullets should have two states:

- `pending`: local-only predicted visual.
- `confirmed`: host accepted and assigned authoritative bullet/hit data.

Reconcile rules:

- If host confirms hit with `localShotId`, attach local visual to host result.
- If host confirms miss or no longer includes the pending bullet after timeout, fade it out.
- Pending bullets must not mutate enemy HP locally.

### Enemies

Enemies are host-rendered on guest via snapshot interpolation plus event corrections.

Rules:

- Guest must not run enemy AI as authoritative.
- Guest must not decrement enemy HP locally.
- `enemyHit` events may update HP immediately between snapshots.
- Snapshot wins if event state and snapshot state disagree.

---

## Implementation Phases

### H1: Stop Split Authority

Goal: remove the ability for guest to independently kill enemies or clear rooms.

Tasks:

- Disable guest-side `hostSimStep` for enemy AI, bullets, output hits, pickups, room progression, and rewards.
- Keep guest-local movement prediction.
- Keep guest input upload.
- Host remains full simulation owner.

Acceptance:

- If an enemy dies on host, it cannot remain interactable/alive on guest after the next event/snapshot.
- Guest cannot clear a room unless host sends room clear/phase event.

### H2: Restore Host Snapshot Channel As Correction Layer

Goal: reintroduce snapshots without returning to streamed-feel gameplay.

Tasks:

- Restore or replace `coopSnapshotBroadcaster`.
- Restore or replace `snapshotApplier` for enemies, bullets, pickups, room, score, and remote slots.
- Keep `predictedSlotId` for guest local body.
- Add missing render flags: bounce-ring bullets, triangle bullets, elite stage, owner color, pickup type.

Acceptance:

- Guest sees host-authored enemy and bullet state.
- Guest own body remains locally responsive.
- Host and guest enemy counts converge within snapshot delay.

### H3: Add Authoritative Event Stream

Goal: gameplay outcomes arrive immediately instead of waiting for snapshot cadence.

Tasks:

- Add `coop-event-batch` transport.
- Emit `enemyHit`, `enemyKilled`, `pickupCollected`, `playerDamaged`, `roomPhase`, and `bulletSpawned`.
- Make event application idempotent.
- Route damage numbers and pickup effects from confirmed events.

Acceptance:

- Damage numbers appear on guest for guest and host hits with correct owner color.
- Enemy death appears quickly on guest even between snapshots.
- Pickup effects appear for guest when host confirms collection.

### H4: Prediction For Guest Shots

Goal: guest firing feels instant without local combat authority.

Tasks:

- Tag guest local shots with `localShotId`.
- Render pending guest bullets immediately.
- Send shot/action to host.
- Host confirms/rejects via events.
- Reconcile pending bullets.

Acceptance:

- Guest firing has no perceived input delay.
- Enemy HP/death still follows host confirmation.
- Rejected/corrected shots fade or blend without corrupting state.

### H5: Diagnostics And Desync Probes

Goal: stop debugging blind.

Tasks:

- Log/send counters:
  - inputs sent/received per second
  - snapshots sent/received per second
  - events sent/received per second
  - last inbound age per channel
  - dropped/out-of-order seq counts
  - pending prediction count
- Add host enemy/bullet/pickup hashes to snapshots.
- Guest logs local render hash after applying snapshot.
- Add `?coopdiag=1` overlay with channel health.

Acceptance:

- A test log can answer whether the issue is transport starvation, event loss, snapshot loss, or local reconciliation.
- Desync has a tick/seq/hash instead of a visual-only report.

### H6: Smoothing Pass

Goal: make host-authored state look good without adding authority ambiguity.

Tasks:

- Interpolate enemies and enemy bullets.
- Extrapolate briefly only if snapshot age is healthy and bounded.
- Snap on death, room transition, boss spawn, and severe desync.
- Smooth remote player only; never smooth local input response.

Acceptance:

- Enemies no longer jitter under normal network conditions.
- No enemy remains alive after confirmed death.
- Guest local movement still feels immediate.

### H7: Rollback Reintroduction, Narrow Only

Goal: use rollback only where determinism is proven.

Candidate systems:

- Local player body prediction.
- Guest pending projectile visuals.
- Optional short-window correction for player movement.

Non-candidates until proven:

- Enemy AI.
- Enemy HP/death.
- Room progression.
- Pickups/rewards.
- Full combat.

Acceptance:

- Rollback never owns truth for enemy death unless full deterministic parity has a dedicated two-peer replay test with hash checks.

---

## Test Gates

### Unit Tests

- Snapshot encode/decode preserves all render-critical fields.
- Event application is idempotent.
- Pending bullet confirmation/rejection works.
- Guest cannot mutate enemy HP locally.
- Guest cannot clear room locally.

### Harness Tests

- Host sim + guest applier harness:
  - host kills enemy
  - event arrives
  - guest removes enemy
  - later snapshot agrees
- Dropped event harness:
  - host kills enemy
  - event dropped
  - next snapshot repairs guest
- Delayed input harness:
  - guest input delayed
  - host keeps sim running
  - guest remains responsive locally
  - authoritative corrections arrive without split kills

### Manual QA Gates

- Guest can move immediately after GO, not before.
- Guest shot appears immediately.
- Enemy damage/death agrees on both devices.
- Pickups collect consistently.
- Room clear agrees.
- Disconnect/stall shows useful diagnostics instead of silent divergence.

---

## Migration Notes

### Keep

- `createCoopInputSync` batching concepts.
- Guest local movement prediction.
- Snapshot encoder/applier concepts, but scoped to authority anchors.
- Effect descriptors for host-authored visual events.
- Determinism tests for pure modules.

### Retire Or Gate

- Full guest `hostSimStep` combat forward simulation.
- Rollback correction for enemy/bullet/kill state.
- Any guest-side enemy HP mutation.
- Any guest-side room clear/reward decision.

### Update Existing Docs

After H1 lands, update:

- `docs/rollback-netcode-handoff.md` to mark full combat rollback as suspended.
- `docs/coop-multiplayer-plan.md` to reference this hybrid authority plan.
- `docs/rollback-r-series-status.md` to separate reusable rollback infrastructure from rejected full-combat ownership.

---

## Decision Record

The current strategic decision is:

**Ship coop as host-authoritative combat with guest-local prediction, not full deterministic rollback.**

Reason:

- Phantom Rebound's current live game state is not deterministic enough for full rollback combat.
- Transport logs show rollback input starvation in real sessions.
- Split combat authority creates unrecoverable user-facing failures: enemy dead on one device and alive on another.
- A hybrid model preserves the main UX requirement, responsive guest controls, while restoring a single source of gameplay truth.
