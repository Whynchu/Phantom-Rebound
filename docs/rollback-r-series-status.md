# Rollback Netcode — R-Series Status & Handoff

**Current version:** v1.20.106  
**Branch:** `coop` on `experimental-origin` (`Whynchu/Phantom-Rebound-Experimental`)  
**Gate:** `?rollback=1` URL flag (off by default — zero cost in solo)  
**Last updated:** 2026-04-26

---

## Architectural Decision

The D-series host-authoritative + client-prediction + snapshot-reconciliation stack was **abandoned** in favour of **GGPO-style rollback netcode**. Reason: rubber-banding and input lag are unfixable in a twitch coop game with the D-series model.

**Retained:** Lobby / signalling / DataChannel transport code.  
**To be deleted at R3.3:** snapshotBroadcaster, snapshotApplier, predictionReconciler, hostRemoteInputProcessor, greyLagComp, bulletSpawnDetector, bulletLocalAdvance, partner cosmetic mirroring, deadReckoning (~2000 lines).

**Non-negotiable constraint:** Solo gameplay must stay byte-identical throughout all R-series work. The 10k-tick determinism canary (`scripts/test-determinism-canary-10k.mjs`) gates every change.

---

## R-Series Phase Status

| Phase | Status | Version | Description |
|-------|--------|---------|-------------|
| R0.1 | ✅ Done | v1.20.71 | Seeded RNG audit — 9 sim modules migrated |
| R0.2 | ✅ Done | v1.20.71 | 3 remaining `Math.random` calls → `simRng.next()` |
| R0.3 | ✅ Done | v1.20.82 | SimState shape defined (`src/sim/simState.js`) |
| R0.4 | ✅ Done | v1.20.104 | All 5 carve-out regions shipped (see below) |
| R0.5 | ✅ Done | earlier | Map/Set iteration order audit |
| R0.6 | ✅ Done | v1.20.97 | 10k-tick long determinism canary |
| **R1** | ✅ **Done** | v1.20.105 | coordinatorStep wired into game loop |
| **R2** | ✅ **Done** | v1.20.106 | Bullet + enemy kinematic resim in hostSimStep |
| R3 | 🔲 Next | — | Full hit detection during resim |
| R4 | 🔲 Future | — | Polish: pause/intro/boon/death/disconnect |
| R5 | 🔲 Future | — | Beta stress test + ship |

---

## R0.4 Carve-Out Regions (all done)

R0.4 carved `simStep` regions out of `script.js`'s inline `update()` into pure modules. All 5 regions complete:

| Region | Module | Version |
|--------|--------|---------|
| Player movement (chunks 1+2) | `src/sim/playerMovement.js` | v1.20.88 |
| Post-movement timers (step 3) | `src/sim/postMovementTick.js` | v1.20.91 |
| Clock seam (step 5) | `src/sim/hostSimStep.js` | v1.20.98 |
| Region B — bullet bounce dispatch | `src/sim/bulletBounceDispatch.js` | v1.20.99 |
| Region D — volatile orb dispatch | `src/sim/volatileOrbDispatch.js` | v1.20.100 |
| Region C — grey absorb dispatch | `src/sim/greyAbsorbDispatch.js` | v1.20.103 |
| Region E — shield hit dispatch | `src/sim/shieldHitDispatch.js` | v1.20.104 |
| GAP 1+2 — body death fields | `simState.js` slot.body fields | v1.20.101 |
| GAP 3 — run-scope counters | `simState.run.*` fields | v1.20.102 |
| GAP 4 — hostGreyLagComp | `ctx.lagComp` injection | v1.20.103 |

---

## Current Architecture (v1.20.106)

### Game Loop (script.js, inside `while (simAccumulatorMs >= SIM_STEP_MS)`)

```
update(SIM_STEP_SEC, simNowMs)           ← live game: moves players, bullets, enemies, collision
hostRemoteInputProcessor.tick(simTick)   ← D-series ack (still active, pre-R3.3 cleanup)
coordinatorStep(joyInput, SIM_STEP_SEC)  ← R1: captures input + triggers rollback if diverged
coopSnapshotBroadcaster.tick(simTick)    ← D-series broadcast (still active)
```

### Rollback Flow (when `?rollback=1` and remote input diverges)

```
coordinator receives late remote input
→ detects mismatch vs stored prediction
→ restoreState(liveState, snapshot[tick-N])   ← in-place: drains+refills bullets[], enemies[]
→ for each resim tick:
    hostSimStep(state, s0Input, s1Input, dt)
      applyJoystickVelocity + tickBodyPosition  (player movement)
      tickPostMovementTimers                    (shields, timers)
      tickBulletsKinematic                      (position advance + wall bounce + expiry)
      tickEnemiesKinematic                      (move toward nearest player)
      state.tick++, state.timeMs += dt*1000
→ state now at corrected present-tick position
```

### skipSimStepOnForward Pattern

`RollbackCoordinator` is created with `skipSimStepOnForward: true`. This means:
- **Forward path** (`coordinator.step()`): records input + takes snapshot. Does NOT call hostSimStep (game loop's `update()` already advanced state — no double-advance).
- **Resim path** (`_rollbackAndResim()`): calls `hostSimStep` for each replayed tick.

---

## Critical Wiring Details

### simState ↔ live state bridging (script.js)

`simState` is NOT a standalone copy — it shares references with live game state:
- `simState.slots[0].body` → getter returns live `player` object  
- `simState.bullets = bullets` (same array reference)  
- `simState.enemies = enemies` (same array reference)  
- `simState.run.score/kills` → getter/setter to live `score`/`kills` vars  

**Consequence:** `restoreState(simState, snapshot)` restores bullets/enemies IN-PLACE (`.length = 0; .push(...snapshot.bullets)`), which correctly updates the live `bullets`/`enemies` arrays.

### Input Format (joy format, as of R1)

Coordinator uses analog joy format throughout:
```js
{ joy: { dx: number, dy: number, active: boolean, mag: number } }
```
- `dx`/`dy` quantized to 2dp, `mag` to 1dp to prevent float-drift rollbacks
- `_inputsEqual()`: when both inactive → always equal (direction irrelevant)
- Remote input events use flat fields `{dx, dy, active, mag}` which `_onRemoteInputArrived` reconstructs into joy format

### setupRollback Signature (options object, as of R1)

```js
setupRollback(simState, localSlotIndex, sendFn, registerFn, options = {})
// options: { simStep, simStepOpts, logging }
```
Old positional form `(…, simStep, enableLogging)` was removed. Test files all updated.

### Version Bump Checklist (5 locations)

Every push must update ALL five:
1. `src/data/version.js` — `VERSION.num` + `VERSION.label`
2. `version.json` — `version` + `label`
3. `index.html` — `window.__APP_BUILD__ = '...'`
4. `index.html` — `<link rel="stylesheet" href="styles.css?v=..."`
5. `index.html` — `<script type="module" src="script.js?v=..."`
Plus add a `src/data/patchNotes.js` entry at the top of `PATCH_NOTES_RECENT`.

---

## R2 Limitations (Known, Acceptable)

R2 closes bullet/enemy position correctness during resim but intentionally skips:

| What's missing | Impact | Planned fix |
|---|---|---|
| Hit detection during resim | Damage/kills in the rollback window may replay slightly differently | R3 |
| Bullet homing corrections | Minor positional drift over 8 ticks (~133ms) | R3 |
| Enemy firing during resim | No bullets spawned for enemy shots during rollback replay | R3 |
| Bounce dispatch effects (sparks/splits) | Cosmetic only, no gameplay impact | R4/effect-queue |
| Slot 1 resim | `simState` has `slotCount:1` in script.js — slot 1 resim is a no-op | R3 |

---

## R3 Plan (Next Phase)

**Goal:** Full hit detection during resim — damage application, kill logic, bullet spawning, boon triggers. After R3, a rollback+resim produces byte-identical outcomes to what the non-rolled-back run would have produced.

**Key tasks:**
1. Move `dangerHit` (enemy-bullet-vs-player) into hostSimStep / a pure dispatcher
2. Move `outputHit` (player-bullet-vs-enemy) into hostSimStep / a pure dispatcher  
3. Move enemy bullet firing into hostSimStep (pure, using simRng)
4. Ensure all hit detection uses `state.timeMs` not `performance.now()`
5. Slot 1 resim: create `simState` with `slotCount: 2` and wire guest body
6. Begin cleanup: remove D-series snapshot stack (snapshotBroadcaster, snapshotApplier, etc.)

**Pattern to follow:** Each region follows the dispatcher pattern established in R0.4 — pure function returning a discriminated union, caller applies side effects only on committed (non-resim) ticks.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/sim/hostSimStep.js` | The deterministic sim step. Currently: player movement + timers + bullet/enemy kinematics |
| `src/sim/bulletKinematic.js` | R2: pure bullet position advance + wall bounce + expiry |
| `src/sim/enemyKinematic.js` | R2: pure enemy position advance toward nearest player |
| `src/net/rollbackCoordinator.js` | Core rollback logic: input capture, prediction, divergence detection, rewind+resim |
| `src/net/rollbackIntegration.js` | Bridge: `setupRollback()`, `coordinatorStep()`, `teardownRollback()` |
| `src/sim/simState.js` | SimState shape definition and `createSimState()` factory |
| `src/sim/simStateSerialize.js` | `snapshotState()` + `restoreState()` — in-place rollback restore |
| `src/sim/rollbackBuffer.js` | Ring buffer for state snapshots (capacity 16 ticks) |
| `script.js` | Live game. Lines ~4950-4992: the sim tick loop where coordinatorStep is called |
| `src/data/patchNotes.js` | Version history — add entry here on every push |

---

## Test Suite

Run all of these before pushing:
```bash
node scripts/test-rollback-coordinator.mjs       # 11 tests
node scripts/test-rollback-coordinator-r4.mjs    # 9 tests
node scripts/test-rollback-integration.mjs       # 5 tests
node scripts/test-shield-hit-dispatch.mjs        # 28 tests
node scripts/test-bullet-kinematic.mjs           # 9 tests
node scripts/test-enemy-kinematic.mjs            # 8 tests
node scripts/test-determinism-canary-10k.mjs     # canary (MUST stay green, hash unchanged)
```

Push target: `experimental-origin coop`  
Co-authored trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
