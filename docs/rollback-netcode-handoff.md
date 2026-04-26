# Rollback Netcode — Codex Handoff Document

**Current version:** v1.20.106  
**Branch:** `coop` on `experimental-origin` (`Whynchu/Phantom-Rebound-Experimental`)  
**Last updated:** 2026-04-26

---

## What This Document Is

A complete handoff for any agent (Codex, Copilot, or human) continuing the rollback netcode
(R-series) implementation. Covers what has shipped, how the system works, what comes next, and
the invariants that must never be broken.

---

## Big Picture

Phantom Rebound is a solo/coop bullet-hell. The original coop model (D-series) was
host-authoritative + client prediction + snapshot reconciliation. That model was scrapped because
the fundamental architecture made high-latency play feel awful. The replacement is **GGPO-style
rollback netcode**:

- Both peers run the **same deterministic simulation** locally.
- Only lightweight **input frames** are transmitted (not snapshots).
- When a peer's remote input arrives late, the coordinator **rewinds to the divergence point,
  replays with the real input, and fast-forwards** to the current tick.
- Visually: corrections are invisible. Input always feels local.

The D-series infrastructure (snapshotBroadcaster, snapshotApplier, predictionReconciler,
hostRemoteInputProcessor, greyLagComp, etc.) is still present in the codebase but will be
**deleted at R3.3** once rollback is validated end-to-end.

**Gate flag:** `?rollback=1` in the URL enables the rollback path. Off by default so solo play
and D-series coop are unaffected.

---

## R-Series Phase Map

| Phase | Goal | Status |
|-------|------|--------|
| **R0.1** | Audit sim randomness — all sim-affecting `Math.random` → `simRng.next()` | ✅ Done |
| **R0.2** | Remaining 3 sim `Math.random` in `script.js` migrated | ✅ Done |
| **R0.3** | Define `SimState` shape (`src/sim/simState.js`) | ✅ Done |
| **R0.4** | Carve `hostSimStep` out of `update()` — pure deterministic step | ✅ Done (v1.20.104) |
| **R0.5** | Audit Map/Set iteration order in sim | ✅ Done |
| **R0.6** | 10k-tick determinism canary (`scripts/test-determinism-canary-10k.mjs`) | ✅ Done |
| **R1** | Wire `coordinatorStep` into game loop (`skipSimStepOnForward`) | ✅ Done (v1.20.105) |
| **R2** | Bullet + enemy kinematic resim in `hostSimStep` | ✅ Done (v1.20.106) |
| **R3** | Hit detection + combat during resim; delete D-series | ⏳ **NEXT** |
| **R4** | Polish: pause/intro/boon-select safety; disconnect; buffer tuning | ⬜ Pending |
| **R5** | Beta, stress, ship | ⬜ Pending |

---

## Architecture — How the System Works Today

### The Game Loop (script.js ~line 4950)

```
while (simAccumulatorMs >= SIM_STEP_MS) {
  simNowMs += SIM_STEP_MS;
  simTick++;
  update(SIM_STEP_SEC, simNowMs);        // full live game tick
  hostRemoteInputProcessor.tick(...)      // D-series: ack remote input
  if (ROLLBACK_ENABLED) {
    coordinatorStep({ joy:{dx,dy,active,mag} }, SIM_STEP_SEC);  // R1
  }
  coopSnapshotBroadcaster.tick(...)       // D-series: emit snapshot
  simAccumulatorMs -= SIM_STEP_MS;
}
```

`coordinatorStep` → `rollbackCoordinator.step(localInput, dt)`:

1. Stores local input in `localInputHistory[tick]`.
2. Predicts remote input (repeat-last or neutral).
3. **Does NOT call simStep** (`skipSimStepOnForward: true`) — `update()` already advanced state.
4. Snapshots current state into the ring buffer (16 ticks deep).
5. Sends local input frame to peer via transport.
6. On remote input arrival (via `_onRemoteInputArrived`): if predicted ≠ actual → `_rollbackAndResim`.

### Rollback + Resim (`_rollbackAndResim`)

1. `restoreState(simState, snapshot[divergenceTick - 1])` — in-place field restore.
2. For each tick from divergence to currentTick:  
   - calls `hostSimStep(state, s0Input, s1Input, dt)` with the real inputs.
3. `hostSimStep` runs (in order):
   - Player movement (slots 0 + 1): `applyJoystickVelocity` + `tickBodyPosition`
   - Post-movement timers: `tickPostMovementTimers`
   - **R2: Bullet kinematics**: `tickBulletsKinematic` (advance + wall bounce + expiry)
   - **R2: Enemy kinematics**: `tickEnemiesKinematic` (move toward nearest player)
   - Clock advance: `state.tick++`, `state.timeMs += dt * 1000`

### simState Bridging (CRITICAL)

`simState` fields are **not independent** — they are aliases for live game variables:

| `simState` field | Live variable | How bridged |
|---|---|---|
| `simState.slots[0].body` | `player` object | getter/setter |
| `simState.bullets` | `bullets[]` array | direct assignment (`simState.bullets = bullets`) |
| `simState.enemies` | `enemies[]` array | direct assignment |
| `simState.run.score` | `score` | getter/setter |
| `simState.run.kills` | `kills` | getter/setter |
| `simState.slots[0].upg` | `UPG` object | getter/setter |

**Consequence:** `restoreState(simState, snapshot)` restores live game state in-place.
`tickBulletsKinematic` writing to `simState.bullets` IS writing to the live `bullets` array.
This is intentional and correct — rollback must correct live state.

### Input Format

Coordinator uses **analog joy format**, NOT digital buttons:

```js
{
  joy: {
    dx: float,      // normalised [-1..1], 2dp quantized
    dy: float,      // normalised [-1..1], 2dp quantized
    active: bool,   // joystick is being used
    mag: float,     // raw magnitude (pixels), 1dp quantized
  }
}
```

Quantization (`_quantizeJoy`) prevents float drift from causing spurious rollbacks.

---

## File Map — R-Series Files

### Core Rollback

| File | Purpose |
|------|---------|
| `src/net/rollbackCoordinator.js` | `RollbackCoordinator` class — ring buffer, input history, predict/rollback logic |
| `src/net/rollbackIntegration.js` | Bridge: `setupRollback()`, `coordinatorStep()`, `teardownRollback()` |
| `src/sim/rollbackBuffer.js` | Ring buffer (16-tick snapshot store) |
| `src/sim/simStateSerialize.js` | `snapshotState()`, `restoreState()` — deep clone + in-place restore |

### Sim Step

| File | Purpose |
|------|---------|
| `src/sim/hostSimStep.js` | Pure deterministic sim: player movement → bullet kinematics → enemy kinematics → clock |
| `src/sim/playerMovement.js` | `applyJoystickVelocity`, `tickBodyPosition` |
| `src/sim/postMovementTick.js` | `tickPostMovementTimers` — shield sync, slot timers, orb cooldowns |
| `src/sim/bulletKinematic.js` | `tickBulletsKinematic` — advance + wall bounce + expiry (R2) |
| `src/sim/enemyKinematic.js` | `tickEnemiesKinematic` — move toward nearest player (R2) |

### Dispatch Modules (R0.4 carve-outs, pure)

| File | Purpose |
|------|---------|
| `src/sim/bulletBounceDispatch.js` | Bounce effects: split, triangle burst, elite stage |
| `src/sim/greyAbsorbDispatch.js` | Grey bullet absorption (slot 0, slot 1, orbs) |
| `src/sim/volatileOrbDispatch.js` | Volatile orb hit detection |
| `src/sim/shieldHitDispatch.js` | Shield hit: mirror, tempered, burst, barrier pulse, aegis titan |

### State

| File | Purpose |
|------|---------|
| `src/sim/simState.js` | `createSimState()` — canonical state shape |
| `src/sim/effectQueue.js` | Effect queue for deferred side-effects during resim |

### Tests

| File | What it covers |
|------|---------------|
| `scripts/test-rollback-coordinator.mjs` | 11 tests — coordinator step, predict, rollback, joy format, `skipSimStepOnForward` |
| `scripts/test-rollback-coordinator-r4.mjs` | 9 tests — telemetry, stall detection, dispose, buffer pruning |
| `scripts/test-rollback-integration.mjs` | 5 tests — setupRollback, coordinatorStep, options-object signature |
| `scripts/test-shield-hit-dispatch.mjs` | 28 tests — all shield boon paths |
| `scripts/test-bullet-kinematic.mjs` | 9 tests — advance, wall bounce, expiry, null cleanup |
| `scripts/test-enemy-kinematic.mjs` | 8 tests — movement toward target, dead skip, bounds clamp |
| `scripts/test-determinism-canary-10k.mjs` | 10k-tick byte-identical hash gate (MUST stay green on every change) |

Run all tests with:
```
node scripts/test-rollback-coordinator.mjs
node scripts/test-rollback-coordinator-r4.mjs
node scripts/test-rollback-integration.mjs
node scripts/test-shield-hit-dispatch.mjs
node scripts/test-bullet-kinematic.mjs
node scripts/test-enemy-kinematic.mjs
node scripts/test-determinism-canary-10k.mjs
```

---

## What R2 Left Out (Known Gaps → R3)

### Gap 1: No hit detection during resim
`hostSimStep` moves things but does not detect collisions. Specifically:
- Danger bullets hitting the player → HP not decremented during resim
- Enemy contact damage → not applied during resim
- Player output bullets hitting enemies → enemies not killed during resim
- Orb contact damage → not applied during resim

**Impact:** Combat events in the 8-tick rollback window (~133ms) may be slightly replayed
differently on each peer. Score/HP corrections arrive via the next confirmed snapshot.

**Acceptable for now** under `?rollback=1` experimental flag. The positional rollback is
visually smooth; combat divergence over 133ms is within typical network uncertainty anyway.

### Gap 2: `simState.bullets` / `simState.enemies` are shared references
When `snapshotState(simState)` calls `structuredClone`, it deep-clones the bullet and enemy
arrays. When `restoreState` runs, it splices the live arrays in-place. This is correct and
intentional. BUT: bullet and enemy objects must remain JSON-serializable (no function refs,
no circular refs). If a future bullet or enemy property is added that breaks `structuredClone`,
rollback will silently fail (or throw). Add a serialization sanity test if in doubt.

### Gap 3: slotCount is 1 in solo simState
`script.js` creates `simState` with `slotCount: 1`. `hostSimStep` handles missing `slots[1]`
gracefully (null check). Coop sessions need `slotCount: 2` — this is wired at session init
but not yet tested end-to-end with rollback.

### Gap 4: Enemy AI state not resimmed
`tickEnemiesKinematic` only moves enemies in a straight line toward the player. It does NOT
tick fire timers, windup state, or siphon behaviour. After a rollback, enemies may fire at
slightly wrong moments. Acceptable for R2; R3 will add `stepEnemyCombatState` to resim.

---

## R3 — What to Implement Next

R3 closes the hit-detection gap. After R3, rollback is fully correct for all combat events
within the 8-tick window.

### R3.1 — Player–Danger Collision During Resim

Extract the danger-bullet-hits-player logic into a pure function
`src/sim/dangerHitDispatch.js` (following the same pattern as `shieldHitDispatch.js`).
Call it from `hostSimStep` after bullet kinematics.

The dispatcher should return a descriptor: `{kind:'hit', hpDelta, invincibleSeconds, ...}`
and the caller (hostSimStep) applies the delta to `state.slots[i].metrics.hp` etc.

Key guard: only fire effects (particles, audio) on **committed** ticks (not resim ticks).
The `state.effectQueue` is the right channel — push effects there; renderer drains only on
non-rollback ticks. `src/sim/effectQueue.js` is already wired for this.

### R3.2 — Output Bullet–Enemy Collision During Resim

Extract `resolveOutputBulletVsEnemy` into `src/sim/outputHitDispatch.js`.
Returns: `{kind:'hit', enemyIdx, hpDelta, killed, scoreGain, ...}`.
Call from `hostSimStep` after `tickEnemiesKinematic`.

Enemy death during resim must update `e.alive = false` (or `e.dead = true`) so subsequent
resim ticks skip the dead enemy. Score and kills delta should be accumulated on
`state.run.score` / `state.run.kills` (bridged back to live vars via setter).

### R3.3 — Delete D-Series Stack

Once R3.1 + R3.2 are validated with at least one real two-peer session:
- Remove: `snapshotBroadcaster`, `snapshotApplier`, `predictionReconciler`,
  `hostRemoteInputProcessor`, `greyLagComp`, `bulletSpawnDetector`, `bulletLocalAdvance`,
  partner cosmetic mirroring, dead-reckoning helpers.
- Remove: D-series path in `script.js` game loop (coopSnapshotBroadcaster, guestSnapshotApplier).
- The `?rollback=1` flag becomes the default; flag is removed.

---

## Hard Invariants — Never Break These

1. **Canary must stay green.** `scripts/test-determinism-canary-10k.mjs` must produce identical
   hashes across runs and not change unexpectedly. If you change sim math, re-pin the canary.
   If the canary changes for a non-math reason, something is wrong.

2. **`hostSimStep` must be side-effect free.** No DOM writes, no audio, no `Math.random()`,
   no `performance.now()`. All randomness must use `state.rngState` (via `simRng`).
   Side effects belong in `state.effectQueue` — drained only on committed ticks.

3. **`restoreState` never replaces live objects — only mutates fields.** The live `simState`
   object, `simState.slots[0]`, `simState.bullets` (the array), etc. must maintain stable
   identity across rollbacks. Script.js holds direct references to these.

4. **Version must be bumped in all 5 places per push:**
   - `src/data/version.js`
   - `version.json`
   - `index.html`: `window.__APP_BUILD__`
   - `index.html`: `styles.css?v=`
   - `index.html`: `script.js?v=`
   - Plus `src/data/patchNotes.js` entry (at the top of `PATCH_NOTES_RECENT`)

5. **Push target is always `experimental-origin coop`** (remote: `Whynchu/Phantom-Rebound-Experimental`, branch: `coop`).
   Never push rollback work to `origin` (the production repo).

6. **Co-author trailer on every commit:**
   ```
   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
   ```

---

## Key Constants (from script.js)

```js
const ROLLBACK_ENABLED = new URLSearchParams(location.search).has('rollback');
const SIM_STEP_MS  = 1000 / 60;   // ~16.67ms
const SIM_STEP_SEC = 1 / 60;      // dt passed to hostSimStep / coordinatorStep
const BASE_SPD     = 200;          // player base speed (px/s)
const JOY_DEADZONE = 0.15;
const W = /* canvas width */;      // WORLD_W
const H = /* canvas height */;     // WORLD_H
const M = 16;                      // world margin
```

`setupRollback` is called from `script.js` at coop session init, passing:
```js
setupRollback(simState, localSlotIndex, sendFn, registerFn, {
  simStep: hostSimStep,
  simStepOpts: {
    worldW: W, worldH: H,
    baseSpeed: BASE_SPD,
    deadzone: JOY_DEADZONE,
    joyMax,
    gate: roomPhase !== 'intro',
    phaseWalk: UPG.phaseWalk,
    resolveCollisions: resolveEntityObstacleCollisions,
    isOverlapping: isEntityOverlappingObstacle,
    eject: ejectEntityFromObstacles,
  },
  logging: true,
});
```

---

## Commit History (R-series)

```
a4cf519  v1.20.106 — R2: bullet + enemy kinematic resim in hostSimStep
20e8876  v1.20.105 — R1: coordinatorStep wired into game loop (skipSimStepOnForward)
30c711d  v1.20.104 — R0.4 step 11: Region E (shield collision) carved into pure module
```
(Full history: `git log --oneline experimental-origin/coop`)
