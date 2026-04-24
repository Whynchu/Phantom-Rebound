import { PATCH_NOTES_ARCHIVE } from './patchNotesArchive.js';

const PATCH_NOTES_RECENT = [
  {
      version: '1.20.25',
      label: 'COOP PHASE D4B: BULLET IDS',
      summary: ['Every bullet now gets a stable unique id at spawn time. Sets up snapshot correlation in D4 and prediction reconciliation in D6. Determinism canary byte-identical.'],
      highlights: [
        'New src/entities/bulletIds.js: nextHostBulletId() (positive uint32, 1-based), nextGuestBulletId() (negative int32), resetBulletIds() called on run init + restore. Sign bit distinguishes authoritative (positive) from guest-predicted (negative) bullets.',
        'Wired id allocation into all 4 spawn helper sites: projectiles.js (spawnEnemyBullet, spawnEliteBullet) and playerProjectiles.js (createOutputBullet/pushOutputBullet, pushGreyBullet). Every bullet push gets `id: nextHostBulletId()` as the first property.',
        'resetBulletIds() called from init() (line ~2401) and restoreRun() (after bullets.length=0) so both fresh runs and continues start IDs at 1 — critical for determinism canary byte-identity.',
        'scripts/test-bullet-ids.mjs: 12 assertions covering monotonic allocation, host/guest counter independence, reset behavior, ID classification helpers, all 4 spawn-site wiring, mixed-enemy+player uniqueness, spawn-order preservation, and post-reset byte-identical reproducibility.',
        'Wraparound guard: if hostCounter overflows back to 0, skip to 1 (uint32 reserves 0 as "unassigned"). Belt-and-braces — at 10 bullets/s this would take ~13 years to hit.',
        '20 test suites green. Determinism 11/11 byte-identical (IDs mirror spawn order; fresh run always produces same id sequence).',
        'Next up (Phase D4): host broadcasts snapshots at 10-15 Hz using the D4a schema + D4b IDs. Guests receive them and begin applying (render-only in D4; prediction + reconciliation land in D5/D6).',
      ]
    },
  {
      version: '1.20.24',
      label: 'COOP PHASE D4A: SNAPSHOT SCHEMA',
      summary: ['Defined the wire format host will use to broadcast authoritative state. Pure data module with encode/decode/validation — no script.js wiring yet; that lands in D4.'],
      highlights: [
        'New src/net/coopSnapshot.js: createSnapshotSequencer (monotonic uint32 with wraparound), encodeSnapshot / decodeSnapshot (strict field validation), isNewerSnapshot (32-bit-safe ordering with half-range ambiguity rule).',
        'Wire shape: {kind:\'snapshot\', snapshotSeq, snapshotSimTick, lastProcessedInputSeq:{0,1}, slots[pos/vel/hp/charge/aim/invuln/shield/alive], bullets[id/pos/vel/type/owner/bounces/spawnTick], enemies[id/pos/hp/type/fireT/windup], room{index/phase/clearTimer/spawnQueueLen}, score, elapsedMs}. FULL snapshots only for first cut — delta compression deferred past D9.',
        'lastProcessedInputSeq is the reconciliation anchor (rubber-duck #3): tells the guest which input tick the host had consumed when the snapshot was sampled, so D6 can replay only inputs AFTER that tick.',
        'Strict validation: throws on NaN/Infinity positions, negative u32 fields, missing required fields, wrong kind. Lenient on missing optional scalars (defaults to 0/false). All throws include descriptive field paths like "slots[0].x" or "bullets[1].ownerSlot".',
        'scripts/test-coop-snapshot.mjs: 18 assertions covering sequencer, wraparound (0x00 follows 0xFFFFFFFF), half-range boundary, JSON round-trip, default-fill, fractional floor, all validation error paths, and sequencer-driven newest-wins ordering.',
        '19 test suites green. Determinism 11/11 byte-identical (pure module not imported by script.js yet).',
        'Next up (Phase D4b): monotonic bullet IDs. Every bullet gets a stable id (per-owner spawn seq) so snapshots can correlate predicted vs authoritative bullets during reconciliation.',
      ]
    },
  {
      version: '1.20.23',
      label: 'COOP PHASE D3: GUEST INPUT UPLINK',
      summary: ['Guest browsers now stream their local input frames to the host over the coop gameplay channel. Host ingests into a ring buffer, ready for slot-1 sim to drain in D4. Solo and ?coopdebug=1 untouched.'],
      highlights: [
        'Wired createCoopInputSync into script.js. On init(), after slot 0 installs, installCoopInputUplink(armedCoop) spins up an instance bound to the active session. Teardown in gameOver / endCoopDemoRun disposes the sync and unsubscribes from onGameplay.',
        'Guest path in update() now calls coopInputSync.sampleFrame(simTick) after the guest-gate clock advance. Frames are quantized (int8 dx/dy, uint8 t, still bit) and batched in groups of 4 → ~15 msg/s at 60 Hz, well under Supabase\'s 20 msg/s hard cap.',
        'New module-level simTick counter increments once per fixed-step update() call. Acts as the authoritative clientTick tag on guest input frames and (later in D4) the host\'s snapshot sim-tick.',
        'Host side: session.onGameplay listener forwards {kind:\'input\'} payloads into inputSync.ingest(), which lands them in a sorted ring buffer. Out-of-order frames sort, duplicate ticks drop first-write-wins, non-input kinds ignored.',
        'scripts/test-coop-input-uplink.mjs: 12 new assertions covering batch flush, explicit flush, quantization, host ingest, out-of-order sort, duplicate drop, teardown cleanup, sendGameplay throw isolation, and end-to-end loopback.',
        '18 test suites green. Determinism 11/11 byte-identical (the uplink only installs when role === host/guest; solo and COOP_DEBUG never touch it).',
        'Next up (Phase D4a): snapshot schema + sequencing. Host starts broadcasting authoritative state (slots, bullets, enemies, room phase) so guests can render again and D5 prediction has a baseline to reconcile against.',
      ]
    },
  {
      version: '1.20.22',
      label: 'COOP PHASE D2: HOST-AUTHORITATIVE SIM',
      summary: ['Guest browsers now skip the local simulation entirely; the host peer is the authority for enemies/bullets/scoring/room progression. Solo and ?coopdebug=1 keep the full sim, byte-identical.'],
      highlights: [
        'New src/net/coopRunConfig.js helpers: isCoopHost() / isCoopGuest() — strict role === \'host\' / \'guest\' checks. Never negate (!isCoopGuest()) — solo and COOP_DEBUG (role:\'local\') must always fall through the host-like path.',
        'update(dt,ts) in script.js: right after the dying early-return, added a guest gate. role===\'guest\' → advance runElapsedMs + simNowMs, clear prevStill, return. No enemy/bullet/scoring work runs on guest browsers.',
        'Guest draw() continues to run so the UI stays responsive; until D4 snapshots land, guests see an effectively frozen arena (expected intermediate state).',
        'scripts/test-coop-run-config.mjs +12 assertions: isCoopHost/Guest state matrix across solo/host/guest/local; explicit "critical invariant: solo/local/host NEVER get guest gate" checks.',
        'Determinism 11/11 byte-identical (guest gate is gated by role which is null in solo). 17 test suites green. Browser smoke (solo + ?coopdebug=1) clean.',
        'Rubber-duck-flagged anti-pattern enforced in code comments: exact role checks only — no negation.',
        'Next up (Phase D3): guest → host input uplink on the gameplay channel so the host can drive slot 1 inside its authoritative sim.',
      ]
    },
  {
      version: '1.20.21',
      label: 'COOP PHASE D0B: PER-SLOT FIRE',
      summary: ['firePlayer now reads/writes through the passed-in slot instead of module globals. Host and guest share the same full-featured fire path (boons, shockwave, echo, overload, volleys). Solo byte-identical via slot 0 getter/setter bridges.'],
      highlights: [
        'firePlayer(slot, tx, ty) fully slot-driven: every `charge`/`player`/`UPG`/`_echoCounter`/`playerAimAngle` access replaced with slot.metrics/body/upg/timers/aim. Slot 0 is still wired to the legacy globals through Object.freeze getter/setter bridges installed in C2a, so solo play is byte-identical (determinism 11/11).',
        'Removed the simplified `fireGuestSlot` shim (Phase C2d-2). updateGuestFire now calls firePlayer directly, so guest slots get the full boon stack once their UPG state is networked in (D4+).',
        'echoCounter migrated from module-level `_echoCounter` to per-slot `slot.timers.echoCounter`. Slot 0 bridge keeps the legacy var in sync; guest slots now get independent echo state.',
        'Unblocks Phase D5 (guest prediction) and D6 (reconciliation): replaying inputs for slot N will no longer corrupt slot 0\'s charge/aim/echo.',
        'Rewrote scripts/test-guest-fire.mjs to drop the deleted fireGuestSlot port-tests and keep the updateGuestFire charge-gate tests (still distinct from host mobile-charge path).',
        '17 test suites green. Determinism byte-identical. Browser smoke (solo + ?coopdebug=1) clean, no console errors. Experimental repo only; live repo unchanged.',
        'Next up (Phase D2): host-authoritative sim flag → guest skips sim, applies snapshots instead.',
      ]
    },
  {
      version: '1.20.20',
      label: 'COOP PHASE D0A: WORLD-SPACE DECOUPLED',
      summary: ['Simulation now runs in a dedicated WORLD coordinate space, independent from each device\'s canvas pixels. Foundation for host+guest sharing an identical arena regardless of screen size. Solo and ?coopdebug=1 paths byte-identical.'],
      highlights: [
        'New src/core/worldSpace.js pure module: createWorldSpace() owns width/height + getRenderScale(canvasW, canvasH). 15 unit tests (scripts/test-world-space.mjs).',
        'script.js: WORLD_W/WORLD_H module vars now drive the sim. 14 sim call sites migrated from cv.width/cv.height → WORLD_W/WORLD_H (player init, body.x clamp, createRoomObstacles, spawnEnemy ctx, update W/H, createInitialPlayerState x2, room intro centers, telemetry bridge).',
        'Renderer: draw() now wraps the scene in ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0) using worldSpace.getRenderScale(). Identity (1,1) in solo since WORLD is mirrored from canvas. Transform reset to identity before joystick UI draw (joystick stays in canvas-pixel space).',
        'resize() calls syncWorldFromCanvas() — keeps WORLD === canvas in solo/?coopdebug=1 so today\'s behavior is untouched. In Phase D2+ online coop, host will pin WORLD to a fixed size (likely 400×472) and guests render scaled regardless of their device size.',
        'Rubber-duck critique blocker #1 resolved: before this change, host and guest on different-sized devices would have run different-sized arenas. Now the sim is authoritative over world dims.',
        'Determinism 11/11 byte-identical. 17 test suites green (was 16 + new world-space suite). Experimental repo only; live repo unchanged.',
        'Next up (Phase D0b): extract pure per-slot player step function (firePlayer currently reads globals — blocker for prediction/reconciliation).',
      ]
    },
  {
      version: '1.20.19',
      label: 'COOP ARCHITECTURE PIVOT: LOCKSTEP → AUTHORITATIVE-HOST',
      summary: ['Lockstep scheduler removed. Pivoting online co-op to authoritative-host + client prediction + reconciliation (Valve model) for latency-tolerant twitch play. Solo and ?coopdebug=1 paths unchanged.'],
      highlights: [
        'Rationale: lockstep gates every shot on round-trip latency — unacceptable for bullet-heaven pacing. Authoritative-host (one peer = server, other = client predicting locally) gives zero-latency feel on own input while keeping sim deterministic.',
        'DELETED src/net/coopLockstep.js and scripts/test-coop-lockstep.mjs. The two-counter gate and 42 lockstep tests are gone. Test count drops from 321 → 279 across 15 suites.',
        'KEPT (still useful under host-authority model): coopRunConfig (seed + roles + isOnlineCoopRun), onlineSlotRuntime, coopSession gameplay channel (sendGameplay/onGameplay), coopInputSync (input quantization + batching), remoteInputBuffer (host\'s guest-input queue), C3a-min-1 single-room termination gate.',
        'script.js unchanged — lockstep was never wired into the main loop (would have shipped in c3a-ship-1, now scrapped).',
        'inputSync.sampleFrame retains its return value for the upcoming guest-side prediction path (guest echoes its own quantized frame into a prediction buffer for reconciliation).',
        'Next up (Phase D): host-authoritative sim flag → guest input uplink → 20 Hz host snapshot broadcast → guest prediction + interpolation → reconciliation → host-side lag comp for guest hit-reg → two-peer integration test → first playable online run.',
        'Determinism byte-identical (11/11). Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.18',
      label: 'COOP PHASE C3A-MIN-1: SINGLE-ROOM TERMINATION',
      summary: ['Online coop runs now terminate cleanly after Room 1 clears, skipping the boon picker. Foundation for one deterministic online single-room run. Solo and ?coopdebug=1 paths unchanged.'],
      highlights: [
        'New isOnlineCoopRun() in src/net/coopRunConfig.js: true only when role===\'host\'||\'guest\'. solo (no run) and COOP_DEBUG (role:\'local\') return false — both behave identically to today.',
        'script.js: shouldShowUpgrades gate now routes online coop peers to endCoopDemoRun() instead of showUpgrades(). Solo and COOP_DEBUG still call showUpgrades() unchanged.',
        'endCoopDemoRun(): freezes sim (gstate=\'gameover\', cancelAnimationFrame), reuses the gameOver overlay with note "COOP DEMO COMPLETE · Room 1 cleared · Boon selection coming in C3b", calls clearCoopRun(). Does NOT push leaderboard entry.',
        'COOP_DEBUG parity: ?coopdebug=1 has role:\'local\' → isOnlineCoopRun()=false → still shows boon picker as before.',
        'Determinism: endCoopDemoRun is a no-op in the pure-sim harness (no coop run armed) — byte-identical 11/11.',
        'New scripts/test-coop-single-room.mjs: 26 contract tests (isOnlineCoopRun helper, all-four-states matrix, shouldEndAfterRoomClear pure logic). 321 tests across 16 suites.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.17',
      label: 'COOP PHASE C3A-CORE-3: LOCKSTEP GATE',
      summary: ['Internal scaffolding: two-counter lockstep gate (sendTick / executeTick) prevents sim divergence when network latency is non-zero. ?coopdebug=1 only.'],
      highlights: [
        'New src/net/coopLockstep.js: sampleLocalThrough/canExecuteTick/consumeTick. Sim only advances when BOTH slots\' quantized frames for that tick are buffered locally.',
        'Owns a local ring buffer mirrored from inputSync.sampleFrame — both peers read their own input through the same quantize→dequantize pipe so sim floats stay byte-identical across machines.',
        'stallReason diagnostics (localMissing / remoteMissing / nonMonotonic / null) give the future lockstep driver a clean signal for "pause sim" vs "catch up".',
        'Solo/COOP_DEBUG path: expectRemote=false gate depends only on local availability → no regression to existing single-device play.',
        'Invariants enforced by tests: executeTick ≤ sendTick always, consumeTick monotonically +1, non-monotonic consume throws, sampleLocalThrough idempotent past sendTick.',
        'Minor: inputSync.sampleFrame now returns the quantized frame (back-compat — previous callers ignore the return value).',
        'New scripts/test-coop-lockstep.mjs: 42 contract tests. 295 tests across 16 suites. Determinism byte-identical.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.16',
      label: 'COOP PHASE C3A-CORE-2: INPUT SYNC',
      summary: ['Internal scaffolding: new coopInputSync batches local input at 15 msg/s (4 frames/batch, 60 Hz sim) and fans out remote frames via a ring buffer. Foundation for lockstep tick gate (C3a-core-3). ?coopdebug=1 only.'],
      highlights: [
        'New src/net/remoteInputBuffer.js: sorted ring buffer (capacity 120) for remote quantized frames. push/peekAt/consumeUpTo/hasFrameFor/stats — reverse-linear scan, O(1) amortised for in-order arrivals. Duplicate ticks: first wins. Capacity overflow: oldest dropped.',
        'New src/net/coopInputSync.js: createCoopInputSync({sendGameplay, localAdapter, localSlotIndex, batchSize=4}). sampleFrame(tick) quantizes dx/dy to int8, t to uint8; flushes via sendGameplay when batch full. flush() for manual/shutdown drain. ingest(payload) validates+fans out to onRemoteFrame listeners and populates ring buffer. getStats()/getRemoteRingBuffer()/dispose().',
        'Quantization: dx/dy=Math.round(v*127) int8; t=Math.round(v*255) uint8. Round-trip error ≤1/127≈0.79% per axis. Supabase 20 events/s cap: batchSize=4 yields ~15 msg/s.',
        'Extended src/core/inputAdapters.js: new createRemoteInputAdapter(ringBuffer, {getCurrentTick}). Dequantizes frames; stall default (dx=0,dy=0,active=false) when no frame present for tick.',
        'New scripts/test-coop-input-sync.mjs: 24 tests (7 ring buffer, 8 batching, 5 ingest/dispatch, 4 remote adapter). No wiring into script.js — C3a-core-3 (lockstep) owns that.',
        '253 tests across 15 suites. Determinism byte-identical (11/11). Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.15',
      label: 'COOP PHASE C3A-CORE-1: LOCAL SLOT RUNTIME',
      summary: ['Internal scaffolding: new onlineSlotRuntime resolves "which slot is the person at this browser?" Foundation for input sync + HUD routing. ?coopdebug=1 only.'],
      highlights: [
        'New src/net/onlineSlotRuntime.js: resolveLocalSlotIndex/getLocalSlotIndex/getLocalSlot/isLocalSlot — derives local slot from coopRunConfig role (host/local→0, guest→1).',
        'Pure utility module with explicit-override support; no globals read outside of getActiveCoopRun(). Enables Node integration tests for online slot logic without touching the DOM.',
        'Wired the auto-fire call site in script.js to route through getLocalSlot(). Solo/host/COOP_DEBUG paths resolve to slot 0 → byte-identical. Only a real online guest (role=guest) flips to slot 1, and that path is not yet playable.',
        'New scripts/test-online-slot-runtime.mjs: 28 contract tests (role mapping, override, sparse arrays, solo invariant, isLocalSlot identity).',
        '229 tests across 14 suites. Determinism byte-identical (11/11). Playwright smoke clean for solo and ?coopdebug=1.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.14',
      label: 'COOP PHASE C3A-PRE-2: GAMEPLAY CHANNEL',
      summary: ['Internal scaffolding: coopSession gains sendGameplay/onGameplay multiplexed with handshake. Foundation for C3a input sync. ?coopdebug=1 only.'],
      highlights: [
        'Envelope wrapper: every outbound message is now {kind:\'handshake\'|\'gameplay\', payload, from, protocol, ts}. Handshake payload fields unchanged.',
        'Backward-compat: legacy unwrapped messages (no kind field, type at top level) are still accepted and treated as handshake with a one-time logger warning.',
        'New sendGameplay(payload): async; throws if not ready phase or if payload is null/undefined/non-object.',
        'New onGameplay(fn): returns unsubscribe; fires {payload, from, ts} for each inbound gameplay message. Listener isolation: gameplay traffic never reaches handshake handlers and vice versa.',
        'Pre-ready gameplay messages are silently dropped (debug log only) — no buffering, no error.',
        'Internal refactor: sendHandshake(payload) helper wraps all handshake send sites; handleMessageAsHost/Guest unchanged in shape.',
        'New scripts/test-coop-gameplay-channel.mjs: 12 contract tests. 201 tests across 13 suites. Determinism byte-identical.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      label: 'COOP PHASE C3A-PRE-1: ISCOOPRUN FLAG',
      summary: ['Internal scaffolding: real coop-run lifecycle flag + seed bootstrap. Foundation for online lockstep. ?coopdebug=1 only.'],
      highlights: [
        'New src/net/coopRunConfig.js: armPendingCoopRun/consumePendingCoopRun/isCoopRun/clearCoopRun — one-shot armed config consumed exactly once at init().',
        'init() seed precedence rewritten: armed-coop seed > URL ?seed= > time. COOP_DEBUG auto-arms a local-role config (URL ?seed= still wins for local replays).',
        'C2f gates re-keyed from raw COOP_DEBUG check to isCoopRun() — future online runs will gate identically without flag-sprawl.',
        'gameOver() now calls clearCoopRun() after pushLeaderboardEntry so a fresh solo run after a coop session is fully clean.',
        'Continue Run button guard widened: hidden under any of ?coopdebug=1 / ?coop=1 / ?room=<code>.',
        'New scripts/test-coop-run-config.mjs: 22 contract tests (arm/peek/consume/clear, one-shot, seed coercion, validation). 189 tests across 12 suites.',
        'Determinism byte-identical. Playwright smoke clean; new "[seed] coop run seed <n> role local" console log confirms the wire.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.12',
      label: 'COOP PHASE C2F: COOP GATING',
      summary: ['Internal scaffolding: save/continue/leaderboard are now solo-only. Coop (?coopdebug=1) runs don\'t persist and don\'t submit scores. ?coopdebug=1 only.'],
      highlights: [
        'saveRunState() early-returns under COOP_DEBUG — no stale saves left behind after a coop session. Solo saves unchanged.',
        'pushLeaderboardEntry() early-returns under COOP_DEBUG (still clears legacy recovery). Coop scores don\'t belong on the solo board — one player per device, different scoring model.',
        '"Continue Run" button is hidden under COOP_DEBUG (you can\'t resume a coop session solo).',
        'New scripts/test-coop-gating.mjs: 10 contract tests (save/leaderboard/continue gates, determinism).',
        '167 tests total across 11 suites. Determinism byte-identical. Playwright smoke clean for solo and ?coopdebug=1.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.11',
      label: 'COOP PHASE C2E: PER-SLOT BOONS',
      summary: ['Internal scaffolding: guest slot 1 now gets its own boon picker between rooms. Each player picks independently before play resumes. ?coopdebug=1 only.'],
      highlights: [
        'New pendingBoonSlotQueue + advanceCoopBoonQueue(): host picks first (full legendary path unchanged), then each alive guest slot picks from its own UPG clone.',
        'New showUpgradesForGuestSlot(slot): calls the existing showBoonSelection UI with slot.upg as the pool, applying picks to slot.upg and slot.metrics.hp/maxHp. No rerolls, no legendaries for guest slot in this phase.',
        'Resume path consolidated into resumePlayAfterBoons() and called once the queue drains. Solo path has an empty queue → bit-identical to previous flow.',
        'Guest boon picks persist across rooms via slot.upg and surface in the renderer (charge ring, aim) on the next combat tick.',
        'New scripts/test-coop-boon-queue.mjs: 10 contract tests (solo no-op, FIFO order, dead-slot skip, multi-guest drain). 157 tests total across 10 suites.',
        'Determinism preserved: solo path unchanged; compound replay still byte-identical. Playwright smoke clean for both solo and ?coopdebug=1 (two pickers open serially, play resumes after second).',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.10',
      label: 'COOP PHASE C2D-2: GUEST FIRE',
      summary: ['Internal scaffolding: guest slot 1 now auto-aims at the nearest enemy and fires. ?coopdebug=1 is now end-to-end playable same-device 2P (dev harness).'],
      highlights: [
        'New fireGuestSlot(slot, tx, ty): fresh-default UPG means no spread/crit/pierce/bounce/homing — a simple single bullet per charge unit. Stamps ownerId=slot.id and expireAt=simNowMs+PLAYER_SHOT_LIFE_MS so it obeys the normal bullet lifecycle.',
        'New updateGuestFire(dt, combatActive): charge builds at 1/s while still (matches default UPG), fire interval = 1/(sps*2)=0.625s. Uses pickPlayerAutoTarget(body.x, body.y) so the target-selection is shared with host.',
        'slot.aim.angle/hasTarget now reflect live targeting — renderer + future facing indicators can read them directly.',
        'Ghost sprite charge ring now animates for guest slot (previously fireProgress was hardcoded 0).',
        'New scripts/test-guest-fire.mjs: 15 contract tests (charge consume, ownerId stamp, fire gating, still-required, interval math). 147 tests total across 9 suites.',
        'Determinism preserved: solo path has no guest slots → updateGuestFire is skipped entirely. 50-room compound replay still byte-identical. Playwright smoke clean for both solo and ?coopdebug=1.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.9',
      label: 'COOP PHASE C2D-1B: PER-SLOT DAMAGE',
      summary: ['Internal scaffolding: guest slot 1 now takes real damage from enemies in ?coopdebug=1. Invisible to solo players.'],
      highlights: [
        'Guest slot 1 drops the permanent invincibility it had in C2c — now spawns with 1.5s of invuln, then is damageable.',
        'New tickGuestSlotTimers(dt) decays invincible/distort on guest slot bodies each frame (host is covered by the existing player.invincible decay).',
        'New applyContactDamageToGuestSlot / applyDangerDamageToGuestSlot / respawnGuestSlot helpers: drop hp on slot.metrics, flash invuln + distort, spawn damage number, on lethal hit respawn at spawnX/spawnY with full HP + 2s invuln (dev-harness only; coopdebug is not a product feature).',
        'Rusher contact damage now routes through the target slot: host retains the full UPG aftermath (lifeline/colossus/blood-pact), guests use the simplified helper. Siphon charge-drain now drains whichever slot is being targeted (bridge-backed for slot 0, own metric for guests).',
        'New processGuestDangerBulletHits(ts) runs after the main danger-bullet loop: any danger bullet that survived the host pass and now overlaps a guest slot is consumed and deals direct projectile damage. Output bullets are correctly ignored.',
        'New scripts/test-slot-damage.mjs: 11 contract tests (contact/danger hp drop, invuln flag, distort flag, lethal-triggers-respawn, invincible-blocks-hit, nearest-slot-only, output-ignored). 132 tests total across 8 suites.',
        'Determinism preserved: solo path has no guest slots → processGuestDangerBulletHits is skipped, all helpers unreachable. 50-room compound replay test still byte-identical. Playwright smoke clean for both solo and ?coopdebug=1.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.8',
      label: 'COOP PHASE C2D-1A: ENEMY TARGETING',
      summary: ['Internal scaffolding: enemies now pick the nearest living player slot each tick instead of hard-coding slot 0. Invisible to solo players.'],
      highlights: [
        'New getEnemyTargetSlot(enemy) selector: iterates getActiveSlots(), skips dead slots (hp<=0), returns nearest by distance-squared with a stable id-ASC tie-break so networking peers will agree.',
        'Enemy step loop (stepEnemyCombatState + fireEnemyBurst) now receives the chosen slot body as player, once per enemy per frame.',
        'spawnEB / spawnDBB / spawnTB / spawnEliteTriangleBullet accept an optional target param (defaults to host player singleton) so enemy projectiles aim at the same slot their parent enemy targeted.',
        'Damage and charge-drain paths are still host-only — gated by targetIsHost. Slot-aware damage plumbing comes in C2d-1b; slot 1 shooting comes in C2d-2. Slot 1 in ?coopdebug=1 stays invincible for now but will now have enemies aiming at it whenever it\'s the nearest slot.',
        'New scripts/test-enemy-targeting.mjs: 8 contract tests (solo, nearer-wins, tie-break, dead-slot skip, sparse array, null body). 121 tests total across 7 suites.',
        'Determinism preserved: solo path returns slot 0 → bit-identical to pre-C2d behavior. 50-room compound replay test still byte-identical.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.7',
      label: 'COOP PHASE C2C: SECOND PLAYER (DEV)',
      summary: ['Internal scaffolding: a second player slot can now render and move behind a dev-only URL flag. Invisible to solo players; never exposed in the UI.'],
      highlights: [
        'New src/core/inputAdapters.js: createHostInputAdapter(joy) + createArrowKeysInputAdapter(keyState) + createNullInputAdapter(). Each exposes a uniform moveVector() / isStill() contract so the update loop can drive any slot identically regardless of input source.',
        'Slot 0 now ships with createHostInputAdapter(joy) wired in at installPlayerSlot0() — no behavior change, just removing the temporary null input.',
        'Dev-only ?coopdebug=1 URL flag spawns playerSlots[1]: its own body/UPG/metrics/timers/aim (not bridged), spawn-offset to the right, invincible, controlled by arrow keys. A thin updateGuestSlotMovement(dt, W, H) helper runs after the slot-0 movement block so slot 0 determinism is bit-identical.',
        'drawGuestSlots(ts) renders each guest ghost after the host with a blue marker ring for visual distinction. Dev-only scaffolding — deleted when real online co-op ships.',
        'New scripts/test-input-adapters.mjs: 8 contract tests for host / arrow-keys / null adapters (deadzone, saturation, diagonal normalization, opposing-key cancel). 113 tests total across 6 suites.',
        'This is online-only co-op\'s testing harness — it lets multi-slot rendering, movement, and (soon) enemy targeting be validated without spinning up the Supabase transport. NOT a couch-co-op product feature.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.6',
      label: 'COOP PHASE C2B: OWNERID + SLOT FIRE',
      summary: ['Internal refactor: player output bullets now carry an ownerId attribution field, and firePlayer / boon hooks accept an explicit slot. Invisible to solo players.'],
      highlights: [
        'createOutputBullet, pushOutputBullet, spawnRadialOutputBurst, and spawnSplitOutputBullets now plumb ownerId (default 0) as a first-class field. Split bullets inherit their source bullet\'s owner.',
        'buildPlayerVolleySpecs accepts an ownerId param so every shot in a volley is stamped with the shooter\'s slot id. Echo-fire replays reuse the same ownerId as the parent volley.',
        'firePlayer signature changed from firePlayer(tx, ty) to firePlayer(slot, tx, ty). Main-loop call site now passes playerSlots[0]. Attribution-only for now — player bullets still never collide with players.',
        'Boon hooks (onRoomStart / onRoomClear / onTick) now receive the shooter slot in their context object. Existing hook implementations ignore it; future per-slot hooks can route off it.',
        'New scripts/test-player-ownership.mjs: 8 contract tests covering createOutputBullet, pushOutputBullet, buildPlayerVolleySpecs, spawnRadialOutputBurst, spawnSplitOutputBullets ownerId propagation. 105 tests total across 5 suites.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.5',
      label: 'COOP PHASE C2A: PLAYER SLOTS',
      summary: ['Internal refactor: new player-slot bundle abstraction lays the groundwork for a second in-world player. Invisible to solo players.'],
      highlights: [
        'New src/core/playerSlot.js: createPlayerSlot() returns a frozen {id, body, upg, metrics, timers, aim, input} bundle. body/upg expose live getters so slot 0 stays valid across the player = createInitialPlayerState() reassignment that happens on every new run.',
        'Slot 0 (host) is installed in script.js at init() and at restoreRun(). metrics/timers/aim are bridge objects backed by the existing module-scope let bindings (score, kills, charge, hp, slipCooldown, echoCounter, colossusShockwaveCd, aim angle, etc.) — zero behavior change, but future slot-aware code can now route through slot.metrics.score instead of the globals.',
        'New scripts/test-player-slot.mjs adds 8 contract tests (reassignment-safety, bridge round-trip, registry helpers). 97 tests total across 4 suites.',
        'No new user-visible gameplay; this is scaffolding for Phase C2b-C2f (slot-aware loop, debug second player, enemy targeting, per-player boons).',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.4',
      label: 'COOP PHASE C1B: FIXED STEP',
      summary: ['Internal refactor: simulation now runs at a deterministic 60 Hz fixed timestep, independent of display refresh rate. Invisible to solo players; required groundwork for lockstep co-op.'],
      highlights: [
        'Main loop converted from variable-dt to a fixed-step accumulator (SIM_STEP_MS = 1000/60). Display refresh drives the render rate; sim always advances in exact 16.667ms chunks.',
        'Spiral-of-death guard: max 5 sim steps per rAF frame, max 250ms accumulated frame time. Background-throttled tabs drop their backlog on return instead of locking up.',
        'Accumulator is zeroed on every loop re-entry point (room start, boss intro, upgrade return, restart) so paused/stale fragments never leak into the next run.',
        'All update() callsites now receive the same dt every tick, which makes physics/AI reproducible across machines — a prerequisite for lockstep determinism in Phase C3.',
        'Render continues once per rAF with the latest simNowMs (no interpolation yet; step is small enough that jitter is imperceptible on 60+ Hz displays).',
        'Determinism replay + lobby + systems suites (89 tests) all green. Browser smoke test clean.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.3',
      label: 'COOP PHASE C1A: SIM CLOCK',
      summary: ['Internal refactor: simulation now runs on its own clock, decoupled from the browser wall clock. Invisible to solo players; required groundwork for lockstep co-op.'],
      highlights: [
        'New simNowMs module-scope sim clock in script.js — advances by accumulated dt inside the main loop, freezes during pause naturally.',
        'All sim-critical timers (projectile expireAt/decayStart, death animation, volley cadence, shield burst / mirror tide / reflection / shockwave / volatile burst spawn times, sustained-fire streak, void-zone window, orbit/shield rotation visuals) now read simNowMs — not performance.now().',
        'Pause controller no longer shifts bullet expireAt / decayStart on resume. With the sim clock frozen during pause, timestamps are already correct on resume (no more timer-offset drift bugs).',
        'Render-only timers (menu ghost preview pulse, damage-number jitter, HUD reads, leaderboard timestamps) stay on wall-clock as intended.',
        'Determinism replay + lobby + systems suites (89 tests) all green.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.2',
      label: 'COOP LOBBY: MOBILE SHARE',
      summary: ['Mobile UX fix: sharing a co-op room no longer drops the host when they leave the tab to message a friend.'],
      highlights: [
        'Share button now uses the native share sheet (navigator.share) when available — keeps the browser foregrounded instead of fully context-switching.',
        'Supabase transport no longer treats CLOSED / TIMED_OUT as fatal post-subscribe. Those are recoverable disconnects and supabase-js auto-reconnects. Only CHANNEL_ERROR tears down the room now.',
        'Desktop clipboard fallback unchanged.',
      ]
    },
  {
      version: '1.20.1',
      label: 'COOP PHASE B: LOBBY (WIP)',
      summary: ['Experimental co-op lobby: host/join a 6-character room code, shareable URL, matches to shared seed. Gameplay launch lands in the next build.'],
      highlights: [
        'Enable with ?coop=1 or visit a ?room=XXXXXX share URL — a Co-op button appears on the start screen.',
        'Supabase Realtime broadcast adapter (lazy-loaded from pinned CDN) — no DB schema changes needed.',
        'Host creates room, guest joins, handshake exchanges identities and locks in a simulation seed (32-bit crypto-random).',
        'Room-full rejection, hello-ack timeout, subscribe timeout, protocol version gating — all covered by 11 lobby tests.',
        'Lobby only; actual two-player gameplay arrives in Phase C (lockstep simulation wiring).',
        'Shipping to Experimental repo only; zero gameplay change for live players.',
      ]
    },
  {
      version: '1.20.0',
      label: 'COOP PHASE A: SEEDED SIM',
      summary: ['Foundation for online co-op: simulation now runs on a seeded PRNG so two clients with the same seed walk identical sim paths.'],
      highlights: [
        'New src/systems/seededRng.js — mulberry32 PRNG with reseed/fork/pick helpers, singleton simRng used across all sim modules.',
        'Migrated 28 Math.random call sites to simRng: enemy spawns, projectile jitter, boon rolls, kill-reward drops, spawn weighting, legendary picks, shuffles.',
        'Runs accept ?seed=N (int or string) URL param — same seed replays the same enemy waves, boon choices, and spawn layouts.',
        'Cosmetic randomness (particles, damage-number jitter) intentionally stays on Math.random.',
        'New determinism replay harness (scripts/test-determinism.mjs) with 11 tests including a compound 50-room replay byte-identical across runs.',
        'Shipping to Experimental repo only; no gameplay change vs v1.19.32 for live players.',
      ]
    },
  {
      version: '1.19.32',
      label: 'PATCH NOTES HOTFIX',
      summary: ['Hotfix: re-declare module-level pausePanel/pauseBoonsPanel refs in script.js.'],
      highlights: [
        'The panelManager patchNotes beforeOpen/beforeClose callbacks referenced these refs, but p4-pause extraction moved them into pauseController\'s closure, so clicking the Patch Notes button threw ReferenceError and the panel never opened.',
      ]
    },
  {
      version: '1.19.31',
      label: 'PAUSE BTN HOTFIX',
      summary: ['Hotfix: re-declare module-level btnPause/btnPatchNotes refs in script.js.'],
      highlights: [
        'p4-pause extraction removed them from script.js scope but legacy game-state paths (boon apply, legendary, init) still referenced them directly, crashing the run start with ReferenceError.',
      ]
    },
  {
      version: '1.19.30',
      label: 'EXTRACT TELEMETRY',
      summary: ['Decomposition: run telemetry + per-room recorders now live in src/systems/runTelemetryController.js.'],
      highlights: [
        'script.js trimmed another 115 lines (3755 to 3640).',
      ]
    },
  {
      version: '1.19.29',
      label: 'EXTRACT PAUSE',
      summary: ['Decomposition: pause overlay + Escape toggle + confirm dialog now live in src/ui/pauseController.js.'],
      highlights: [
        'script.js trimmed another 113 lines (3868 → 3755).',
      ]
    },
  {
      version: '1.19.28',
      label: 'EXTRACT OBSTACLES',
      summary: ['Refactor — no gameplay changes.'],
      highlights: [
        'Extracted 8 obstacle/collision functions (createRoomObstacles, getCircleRectContactNormal, resolveEntityObstacleCollisions, isEntityOverlappingObstacle, ejectEntityFromObstacles, resolveBulletObstacleCollision, segmentIntersectsRect, hasObstacleLineBlock) from script.js into src/systems/obstacles.js.',
        'script.js is now 98 lines smaller (3705 → 3607). The obstacle module takes the obstacles array as an argument so it has no hidden globals — easy to test and reason about.',
      ]
    },
  {
      version: '1.19.27',
      label: 'AGENT FRIENDLINESS',
      summary: ['Internal / docs only — no gameplay changes.'],
      highlights: [
        'Rewrote agents.md into a real onboarding doc (file map, symbol cheatsheet, boon hook reference, release checklist).',
        'Added scripts/bump-version.mjs: one command now updates all five version-sync points (was 5 manual edits).',
        'Split src/data/patchNotes.js: recent entries stay in patchNotes.js, older entries moved to patchNotesArchive.js so agents can view/edit release notes without hitting the view-tool truncation limit.',
        'Added a TOC header to script.js so agents can jump around the 4500-line file by grepping section dividers.',
      ]
    },
  {
      version: '1.19.26',
      label: 'ROOM CLEAR DEDUPE + JANITOR',
      summary: ['Internal refactor — no gameplay changes.'],
      highlights: [
        'Collapsed the two duplicated room-clear transition blocks into a single finalizeRoomClearState() helper so any future addition to the room-clear sequence happens in exactly one spot.',
        'Janitor pass: removed five stale .gitkeep placeholder files from directories that now hold real source (assets/, example.assets/, src/core/, src/entities/, src/input/).',
      ]
    },
    {
      version: '1.19.25',
      label: 'BOON HOOKS: ROOM START',
      summary: ['Internal refactor — boon registry phase wraps up.'],
      highlights: [
        'Migrated room-start boon inits (predator kill streak reset, mirror tide + phase dash seeding) onto a new onRoomStart hook.',
        'That closes the clean batch of boon-hook migrations: room-start/room-clear/per-frame tick/pause-adjust are now pluggable. Remaining UPG.* references live inside the fire, hit, and damage paths where the local context makes hook indirection higher cost than reward.',
      ]
    },
    {
      version: '1.19.24',
      label: 'BOON HOOKS: TICK + PAUSE',
      summary: ['Internal refactor — no gameplay changes.'],
      highlights: [
        'Migrated per-frame cooldown ticks (shockwave, refraction, mirror tide, overload, phase dash, void walker, predator instinct, blood rush) onto the onTick boon hook. Main loop now fires a single runBoonHook(\'onTick\') instead of eight inline UPG.* gates.',
        'Migrated pause-time timer adjustments (predator/blood rush/void zone/sustained fire/aegis) onto a new onPauseAdjust hook, so when pause shifts absolute timestamps forward, each boon owns its own set of timers.',
      ]
    },
    {
      version: '1.19.23',
      label: 'BOON HOOK REGISTRY',
      summary: ['Internal refactor — no gameplay changes.'],
      highlights: [
        'Introduced a lightweight boon hook registry in src/systems/boonHooks.js so boon effects can register tick/room-clear/kill/fire/damage callbacks instead of being hand-gated inside script.js.',
        'Migrated the regen-on-clear, escalation reset, and EMP-burst reset effects onto the onRoomClear hook as the pilot pattern. Behavior is identical; the two duplicated room-clear blocks collapse into a single hook fire.',
      ]
    },
    {
      version: '1.19.22',
      label: 'LEADERBOARD TIME DISPLAY',
      summary: ['Remote leaderboard rows now show run time.'],
      highlights: [
        'Once 1.19.20\'s duration_seconds column is flowing, leaderboard rows will display each run\'s duration alongside the score — even if the row has no telemetry attached.',
      ]
    },
    {
      version: '1.19.21',
      label: 'SCORE BREAKDOWN ENCAPSULATION',
      summary: ['Internal refactor — no gameplay changes.'],
      highlights: [
        'Moved the score breakdown object (kills, pace, flawless, clutch, and friends) into src/core/gameState.js alongside the entity arrays. One more chunk of global state now lives in a dedicated module.',
      ]
    },
    {
      version: '1.19.20',
      label: 'LEADERBOARD DURATION',
      summary: ['Run length is now recorded alongside scores.'],
      highlights: [
        'Remote leaderboard submissions now include duration_seconds so future views/analytics can sort by time-to-finish, show pace, or split fast vs. slow runs.',
        'Schema migration: added duration_seconds column to leaderboard_scores and a new p_duration_seconds parameter on the submit_score RPC (both optional/nullable, fully backwards-compatible).',
      ]
    },
    {
      version: '1.19.19',
      label: 'STATE ENCAPSULATION',
      summary: ['Under-the-hood refactor — no gameplay changes.'],
      highlights: [
        'Moved the live entity arrays (bullets, enemies, shockwaves, spawn queue) into a dedicated src/core/gameState.js module so future systems can import them directly instead of reaching into script.js.',
        'Room/wave reset paths now clear arrays in place instead of reassigning, keeping every module\'s reference stable.',
      ]
    },
    {
      version: '1.19.18',
      label: 'GAME OVER POLISH',
      summary: ['Tighter Game Over screen — the full breakdown fits without fighting you.'],
      highlights: [
        'Final score heading is smaller so the breakdown (now 11 categories) fits on phone screens without dominating the view.',
        'Removed the redundant "Room X · N enemies eliminated" caption; that info already appears once below the breakdown alongside run time.',
        'Tightened spacing between breakdown rows.',
      ]
    },
    {
      version: '1.19.17',
      label: 'DYNAMIC SCORING',
      summary: ['Score now reacts to every second and every playstyle.'],
      highlights: [
        'Continuous pace curve: every second shaved off a room now adds score (no more 30s all-or-nothing cutoff). Deep rooms multiply all bonuses via a per-room depth scale.',
        'HP efficiency: partial damage is now rewarded based on % HP kept — flawless still pays the most, but chip damage no longer zeroes you out.',
        'Clutch: finishing a room at ≤25% HP after taking a hit awards a sizeable bonus for risky comebacks.',
        'Combat density: kills-per-second rewards AOE / sweep builds; overkill damage (damage dealt past an enemy\'s HP) awards a small per-kill bonus for burst builds.',
        'Accuracy: kills / shots fired rewards precise builds. Dodge bonus: counts near-misses from enemy projectiles for evasion-focused runs.',
        'End-of-run breakdown now lists all categories so you can see exactly where your score came from.',
      ]
    },
    {
      version: '1.19.16',
      label: 'SCORING REWORK',
      summary: ['Score now rewards how you played, not just what you crit.'],
      highlights: [
        'Crits no longer double your score. Critical hits still do bonus damage — they just stop inflating the leaderboard.',
        'New score sources awarded every cleared room: Room clears (scales with depth), Pace bonus (faster than 30s), Flawless rooms (no damage taken), Boss takedowns.',
        'Existing 5-room streak checkpoint is now labeled "Streak bonus" on the Game Over screen for clarity.',
        'Leaderboard context: scores from 1.19.16+ include these new bonuses, so expect per-run totals to read a bit higher than pre-patch runs.',
      ]
    },
    {
      version: '1.19.15',
      label: 'RUN SCORE BREAKDOWN',
      summary: ['End-of-run screen now shows where your score came from.'],
      highlights: [
        'Game Over: the final score panel now lists a breakdown — kill points, critical bonus, orbit strikes, room bonuses — plus a quick stats line with kills, rooms cleared, run time, and clean rooms.',
        'Scoring is tracked per-category at the source, so the breakdown is exact, not estimated.',
        'No balance changes.',
      ]
    },
    {
      version: '1.19.14',
      label: 'LEADERBOARD BUTTON FIX',
      summary: ['Desktop main menu now expands to fit content — no more clipped Leaderboard button, no scrollbar.'],
      highlights: [
        'Desktop: on the main menu, the start panel now sizes to its own content instead of being trapped inside a fixed-height wrap. The Leaderboard button is always visible, and there is no scrollbar either. Hides the unused background canvas on the main menu so the layout can breathe.',
        'No changes to gameplay, mobile, or iPhone.',
      ]
    },
    {
      version: '1.19.13',
      label: 'ANDROID WEBAPK FIX',
      summary: ['Fix Android "Unsafe app blocked" warning for installed web app users.'],
      highlights: [
        'Android install fix: updated the web app manifest (id, scope, orientation, maskable icons, categories) so Chrome re-mints the WebAPK against a current Android SDK. This clears the "Unsafe app blocked — built for an older version of Android" popup.',
        'If you still see the warning: reopen the game in Chrome once and give it ~24h, or uninstall + reinstall from the home screen for an immediate refresh.',
        'Bonus: maskable icon support means Android now draws the app icon edge-to-edge instead of inside a white rounded box.',
        'iPhone, desktop, and in-browser play are unchanged.',
      ]
    },
    {
      version: '1.19.12',
      label: 'REFACTOR + SCROLLBAR TAKE 3',
      summary: ['More code tidy-up, patch notes now load on demand, another shot at the desktop scrollbar.'],
      highlights: [
        'Desktop scrollbar: targeted fix — hide the main-menu start panel scrollbar on ≥1024px viewports (it was the #s-start panel overflowing, not the page). If it still shows up, it is a browser extension or genuine content overflow, not layout.',
        'Perf: patch notes (73KB) now load only when the panel is opened instead of at startup. Faster first paint, same content.',
        'Refactor (invisible): canvas drawing for the ghost and bullets moved to dedicated renderer modules (src/ui/drawing/). Boon tunables split out to src/data/boonConstants.js. Fixed a stale unit test.',
        'New: docs/ARCHITECTURE.md added for contributors.',
      ]
    },
];

const PATCH_NOTES = [...PATCH_NOTES_RECENT, ...PATCH_NOTES_ARCHIVE];

const PATCH_NOTES_ARCHIVE_MESSAGE = 'In-client notes currently begin at v1.16.1. Older builds were not archived in this panel.';

export { PATCH_NOTES, PATCH_NOTES_ARCHIVE_MESSAGE };
