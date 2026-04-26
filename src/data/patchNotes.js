// Older notes archived in patchNotesArchive.js. Only the 50 most recent entries are loaded in-client.

const PATCH_NOTES_RECENT = [
  {
      version: '1.20.115',
      label: 'R4 PAUSE-INTRO SAFETY',
      summary: ['Rollback coordinator now only runs during active combat phases (spawning/fighting). Coordinator is skipped during room intro transitions, preventing intro-phase snapshots from polluting the rollback buffer with pre-combat state. coordinatorStep() now returns the stall status from the coordinator so callers can detect when the remote input age exceeds the max rollback window.'],
      highlights: [
        'R4: coordinatorStep() gated on roomPhase === "spawning" || "fighting" — no snapshots during intro phase.',
        'Effect drain runs every tick (keeps queue clean) but only dispatches visuals during combat phases.',
        'coordinatorStep() now returns { stalled } from rollbackCoordinator.step() — game loop logs a warning when stalled.',
        'boon-select / pause safety already handled: gstate !== "playing" short-circuits RAF loop before coordinator can step.',
      ]
    },
  {
      version: '1.20.114',
      label: 'R4 EFFECTQUEUE DRAIN',
      summary: ['Rollback corrective effects (damage numbers, sparks) now fire correctly after a resim. Effect descriptors queued by hostSimStep during rollback are drained and dispatched to visual/audio handlers each tick before the coordinator snapshots state.'],
      highlights: [
        'R4 drain: drainSimEffectQueue() + dispatchSimEffects() wired in the game loop before coordinatorStep() snapshots state.',
        'danger.directHit / contact.rusherHit → damage number + sparks; output.enemyHit → damage number + sparks; output.enemyKilled → death sparks; lifeline/shockwave/EMP/volatile effects all route to matching handlers.',
        'Snapshots now always have an empty effectQueue so rollback buffer entries are not inflated with stale descriptors.',
      ]
    },
  {
      version: '1.20.113',
      label: 'GHOST TRANSPARENCY FIX',
      summary: ['Fixed ghost transparency on iOS Safari — spectator/dead-partner ghosts now correctly render at 30% opacity on iPhone. Also wired queueEffects in the rollback simStepOpts so combat resim can queue visual/audio descriptors for future R4 drain wiring.'],
      highlights: [
        'Fixed: iOS Safari resets ctx.globalAlpha when shadowBlur is set — ghosts were rendering fully opaque on iPhone. Now uses offscreen compositing canvas (draw at full opacity, blit at bodyAlpha) so no shadowBlur call can interfere.',
        'queueEffects: true added to rollback simStepOpts — combat resim ticks now push effect descriptors to state.effectQueue (drained in R4).',
      ]
    },
  {
      version: '1.20.112',
      label: 'PATCH NOTES FIX',
      summary: ['Fixed a JS syntax error in patch notes (unescaped quote in a string literal) that caused the panel to show "Failed to load". Also limited in-client notes to the 50 most recent updates to keep the panel fast.'],
      highlights: [
        'Fixed: unescaped single quote in a highlights string was silently breaking the patch notes module parse.',
        'Patch notes panel now loads the 50 most recent entries only; older notes archived in patchNotesArchive.js.',
      ]
    },
  {
      version: '1.20.111',
      label: 'R3.4 RUSHER CONTACT RESIM',
      summary: ['Rusher contact damage is now fully deterministic during rollback resim. Contact invuln is applied before bullet kinematics each tick so a rusher hit blocks same-tick projectile hits, exactly matching the live loop.'],
      highlights: [
        'resolveRusherContactHits added to dangerHitDispatch — targets only the nearest alive slot per rusher, matching live-loop semantics.',
        'hostSimStep now runs rusher contact BEFORE tickBulletsKinematic so contact invuln gates danger-bullet hits correctly.',
        '6 new tests covering overlap, invincible-skip, non-rusher skip, game-over, nearest-slot selection, and the order/integration invariant.',
      ]
    },
  {
      version: '1.20.110',
      label: 'COOP GUEST POSITION PRIORITY',
      summary: ['Guest input frames now include the guest\'s locally displayed body position, and the host prioritizes that fresh position for slot-1 movement so pickups match what the guest sees.'],
      highlights: [
        'Continued R3 rollback work with deterministic enemy combat resim: enemy fire timers, windups, projectile spawns, and siphon charge drain now replay through hostSimStep.',
      ]
    },
  {
      version: '1.20.109',
      label: 'R3 ENEMY COMBAT RESIM',
      summary: ['Added rollback-owned enemy combat stepping so resim now covers enemy fire timers, windups, projectile spawns, rusher/siphon movement, and siphon charge drain.'],
      highlights: [
        'Added focused enemy combat resim tests and wired hostSimStep to use the deterministic enemy combat path instead of the old nearest-player kinematic approximation.',
      ]
    },
  {
      version: '1.20.108',
      label: 'ROLLBACK INPUT DRIFT FIX',
      summary: ['Wired rollback input frames through the gameplay channel with kind:\'rollback-input\' so peers stop predicting remote movement indefinitely.'],
      highlights: [
        'Bridged online coop slot 1 into simState before rollback setup and disabled the legacy guest reconciler while rollback is active to avoid dueling corrections.',
      ]
    },
  {
      version: '1.20.107',
      label: 'R3 COMBAT RESIM SLICE',
      summary: ['Rollback R3 now resimulates core combat outcomes: danger bullets can damage player slots and output bullets can damage or kill enemies during rollback replay.'],
      highlights: [
        'Fixed the main-menu settings button to use the real 1-bit gear icon and cache-busted lazy patch-notes loading so stale module caches do not show the failure fallback.',
        'Updated the rollback two-peer harness and coordinator wire format so joy inputs are sent as flat quantized frames and replay parity is test-covered.',
      ]
    },
  {
    version: '1.20.106',
    label: 'R2 — BULLET + ENEMY KINEMATIC RESIM IN HOSTSIMSTEP',
    summary: ['R2 milestone: after a rollback+resim, bullets and enemies are now at their correct predicted positions. tickBulletsKinematic(state, dt) advances bullet positions via advanceBulletWithSubsteps (wall bounce + substeps) and removes expired bullets silently — no hit detection, no audio, no sparks. tickEnemiesKinematic(state, dt) moves each live enemy toward the nearest slot body by e.spd*dt — no firing, no contact damage, no AI state transitions. Both functions are called from hostSimStep after player movement, before the clock advance. The solo game path is unaffected — these functions only run during rollback resim. All 9+8 new test cases green; canary UNCHANGED.'],
    highlights: [
      'src/sim/bulletKinematic.js (new): tickBulletsKinematic(state, dt) — iterates state.bullets in reverse, splices null/expired entries, advances position via advanceBulletWithSubsteps. Pure: no side effects, no spawning, no hit detection.',
      'src/sim/enemyKinematic.js (new): tickEnemiesKinematic(state, dt) — skips dead enemies, finds nearest slot body, moves enemy toward it by e.spd*dt, clamps to world bounds. Pure: no firing, no damage.',
      'hostSimStep.js: imports and calls tickBulletsKinematic + tickEnemiesKinematic after slot movement blocks, before clock advance. Closes R2 gap: resim ticks now correctly advance bullet and enemy positions.',
      'scripts/test-bullet-kinematic.mjs (new): 9 test cases covering advance, wall bounce X/Y, expiry, non-expiry, null cleanup, no-side-effects, multiple bullets, empty array.',
      'scripts/test-enemy-kinematic.mjs (new): 8 test cases covering basic movement, diagonal, on-target no-NaN, dead skip, no-slots no-crash, nearest-slot selection, world clamp, speed-zero.',
    ],
  },
  {
      version: '1.20.105',
      label: 'R1 — COORDINATORSTEP WIRED INTO GAME LOOP (SKIPSIMSTEPONFORWARD)',
      summary: ['R1 milestone: the RollbackCoordinator is now called every sim tick from the game loop via coordinatorStep(). The skipSimStepOnForward=true option ensures hostSimStep is NOT called on the forward path (game loop already ran update()), preventing double-advance of live position. On remote-input divergence the coordinator still calls hostSimStep during _rollbackAndResim() to correctly replay movement. Input format migrated from digital {left,right,up,down,shoot} to analog joy format {joy:{dx,dy,active,mag}} with 2dp/1dp quantization to prevent float-drift rollbacks. All 3 test files updated; 11+9+5 tests green; 10k canary UNCHANGED.'],
      highlights: [
        'script.js: coordinatorStep({joy:{dx,dy,active,mag}}, SIM_STEP_SEC) added inside while(simAccumulatorMs) loop after update() — gated by ROLLBACK_ENABLED flag for zero solo cost.',
        'rollbackCoordinator.js: skipSimStepOnForward option (default false) — when true, step() skips simStep on forward path; _rollbackAndResim() always calls it. _neutralInput()/_inputsEqual() updated for joy format. _quantizeJoy() helper added (dx/dy→2dp, mag→1dp). _onRemoteInputArrived() extracts {joy:{dx,dy,active,mag}} from flat event fields.',
        'rollbackIntegration.js: setupRollback() signature changed from positional (…,simStep,enableLogging) to options object {simStep,simStepOpts,logging}. Wraps simStep with simStepOpts for obstacle-callback binding. Passes skipSimStepOnForward:true to coordinator.',
        'scripts/test-rollback-coordinator.mjs: tests 5, 7, 8 updated for joy format. New test 11 asserts skipSimStepOnForward suppresses simStep on forward path but invokes it on resim.',
        'scripts/test-rollback-coordinator-r4.mjs: test 5 remote-input callback updated to joy format for correct divergence detection.',
        'scripts/test-rollback-integration.mjs: all setupRollback calls updated to options-object form; coordinatorStep calls updated to joy format.',
      ]
    },
  {
      version: '1.20.104',
      label: 'R0.4 STEP 11 — REGION E (SHIELD COLLISION) CARVED INTO PURE MODULE',
      summary: ['Carves Region E (danger-bullet vs player-shield collision) out of the script.js bullet loop into a new pure module src/sim/shieldHitDispatch.js. The dispatcher handles all shield boon interactions: Mirror Shield reflection, Tempered Shield two-stage absorption, Shield Burst radial output, Barrier Pulse charge grant, and Aegis Titan cross-shield cooldown sharing. Critical ordering detail preserved: mirror fires before tempered check so a hardened tempered shield can also emit a reflection on its first hit. Telemetry (shieldBlocks++) returned as a data signal so the dispatcher stays pure — caller only applies it on the live commit tick, not during rollback resim. Canary hash UNCHANGED — refactor is observably equivalent.'],
      highlights: [
        'src/sim/shieldHitDispatch.js (new) — exports detectShieldHit(bullet, ctx). Pure: returns null on miss; discriminated union {kind:\'temperedAbsorb\'|\'pop\', effects, hitShieldIdx, shieldBlockOccurred, mirrorCooldown?, mirrorReflectionSpec?, shieldBurstSpec?, barrierPulseGain?, shieldCooldown?, aegisTitanCdShare?} on hit.',
        'getShieldCooldown() and getAegisBatteryDamageMult() close over UPG globals — pre-computed as shieldCooldown and aegisBatteryDamageMult scalars in ctx per dispatcher pattern established at Region C.',
        'circleIntersectsShieldPlate() logic inlined into _circleIntersectsShieldPlate() inside the dispatcher using SHIELD_HALF_W/SHIELD_HALF_H imported from constants.js. Avoids any circular dependency.',
        'script.js: 83-line inline Region E block replaced with dispatcher call + translator (~40 lines). Telemetry shieldBlocks++ lives only in translator (commit-phase guard).',
        'scripts/test-shield-hit-dispatch.mjs (new) — 28 assertions covering: miss (far/cooldown/geometry), pop path (basic, mirror, mirror+tempered ordering, mirror cooldown, burst, burst+aegis, barrier pulse, aegis titan), temperedAbsorb (hardened/unhardened, no-cooldown fields), multi-shield priority, purity (bullet/shield/player not mutated), telemetry-as-data, geometry edge cases, shieldCooldown passthrough, mirror damage factor, aegis titan damage doubling.',
        'Full 50-suite sweep green. Canary hash UNCHANGED — sim math identical.',
      ]
    },
  {
      label: 'R0.4 STEP 10 — GAP 4 CLOSED, REGION C (GREY ABSORB) CARVED INTO PURE MODULE',
      summary: ['Closes the final parity gap from the R0.4 step-5 audit (GAP 4 — hostGreyLagComp out-of-sim) and carves Region C (grey bullet absorption) out of the script.js bullet loop into a new pure module src/sim/greyAbsorbDispatch.js. Resolution strategy: hostGreyLagComp injected as ctx.lagComp (null in solo/resim). During rollback resim the caller passes lagComp:null so all historic-overlap checks return false (conservative). Acceptable for Phantom Rebound\'s snapshot-reconciliation model. All 4 parity gaps from the R0.4 audit are now closed. Canary hash UNCHANGED — refactor is observably equivalent.'],
      highlights: [
        'src/sim/greyAbsorbDispatch.js (new) — exports detectGreyAbsorb(bullet, ctx). Pure module: handles all three grey absorption sub-paths: slot-0 (with GhostFlow speed-scaling, ResonantAbsorb combo streak, Refraction homing shot, ChainMagnet duration), slot-1+ coop guest absorb (overlapNow || overlapHistoric via lagComp oracle), and AbsorbOrbs (grey near alive orbit sphere). Returns null on miss; discriminated union {kind,effects,slot0?/guest?/orb?} on hit.',
        'GAP 4 resolution: hostGreyLagComp injected as ctx.lagComp rather than being called directly in sim. Dispatcher is pure given ctx — no module-level globals. Per rubber-duck critique, getOrbitRadius()/getOrbVisualRadius() pre-computed as scalar ctx fields (orbitRadius/orbVisualRadius) so the dispatcher does not close over UPG globals.',
        'Refraction edge case hardened: refractionCount clamped to [0,3] at entry in dispatcher so bad persisted state cannot deadlock the refraction boon.',
        'script.js: 100-line inline grey block replaced with dispatcher call + 30-line translator. hostGreyLagComp.record() remains before the bullet loop (pre-sim snapshot, unchanged). orbitRadius/orbVisualRadius pre-computed scalars passed into ctx. lagComp: hostGreyLagComp (null in solo).',
        'src/sim/simState.js audit comment: GAP 4 marked [CLOSED 2026-04-26 v1.20.103 — R0.4 step 10] with rationale. All 4 parity gaps are now closed.',
        'scripts/test-grey-absorb-dispatch.mjs (new) — 28 assertions covering: miss, slot0 basic, GhostFlow (full/zero speed), ResonantAbsorb (no-bonus/bonus/surgeHarvest), Refraction (fire/reset/suppressed/bad-count-clamp), ChainMagnet (tier 1/3), guest (overlapNow/charge-cap/dead-skip/lagComp-historic/lagComp-null), orb (absorb/cooldown-skip), priority order (slot0>guest>orb), spark positions, determinism, purity (bullet/slot0Timers/UPG not mutated).',
        'Full 47-suite sweep green (now 48 suites). Canary unchanged — sim math is identical, only code structure changed.',
      ]
    },
  {
      version: '1.20.102',
      label: 'R0.4 STEP 9 — GAP 3 CLOSED (RUN-SCOPE COUNTERS ON state.run)',
      summary: ['Closes the third parity gap from the R0.4 step-5 audit: seven run-scoped counters that lived as closure variables in script.js are now canonical fields on state.run. This unblocks any future carve-out that reads these values during simStep (stall spawn timer, damageless room streak, boss clear count, etc.). Canary baselines re-pinned because serialized state now contains 7 additional fields in state.run — sim math UNCHANGED. Parallel run-A == run-B continues to pass.'],
      highlights: [
        'state.run gains 7 new fields: runElapsedMs:0, gameOverShown:false, boonRerolls:1, damagelessRooms:0, tookDamageThisRoom:false, lastStallSpawnAt:-99999, bossClears:0. Defaults match legacy script.js closure variable initialization.',
        'resetSimState() updated to zero/reset all 7 fields to their defaults, so between-run reset mirrors the legacy createInitialPlayerState path.',
        'restoreState() in simStateSerialize.js gains 7 explicit copy lines in the run.* block, using the same "if defined" guard pattern as all other run fields — rollback ring-buffer restores will round-trip these counters correctly.',
        'src/sim/simState.js audit comment updated: GAP 3 marked [CLOSED 2026-04-26 v1.20.102 — R0.4 step 9]. Remaining open: GAP 4 (hostGreyLagComp out-of-sim, gates Region C grey absorb).',
        'scripts/test-sim-state-serialize.mjs — 3 new tests: "createSimState populates run-scope counters with defaults (R0.4 GAP 3)", "restoreState round-trips run-scope counters (R0.4 GAP 3)", "resetSimState clears run-scope counters to defaults (R0.4 GAP 3)". Suite: 20/20.',
        'scripts/test-determinism-canary-10k.mjs — three SHA-256 baselines re-pinned. Before: tick100=640835a4…, tick5000=621ba92c…, tick10000=f0b7c83f…. After: tick100=e0d34ae4…, tick5000=7e9051a6…, tick10000=6be36f76…. Parallel run-A == run-B test still passes.',
        'Full 47-suite sweep green.',
      ]
    },
  {
      version: '1.20.101',
      label: 'R0.4 STEP 8 — SLOT-0 PARITY GAPS 1 + 2 CLOSED (DEATH VISUALS ON BODY, getSlotShields ADAPTER)',
      summary: ['Closes the first two of four parity gaps documented in src/sim/simState.js bottom comment block during R0.4 step 5. These gaps blocked the remaining bullet region carve-outs (Region E shield collision in particular) because legacy player and sim slot shapes diverged in ways that would silently desync on rollback resim. Step 8 is pure schema additions + a small adapter helper — sim math UNCHANGED. Canary baselines re-pinned because serialized state now contains 4 additional zero-valued fields per slot (default initialization). Parallel run-A == run-B continues to pass: refactor is observably equivalent.'],
      highlights: [
        'GAP 1 closed — slot.body now carries deadAt, popAt, deadPop (bool), deadPulse (matching runState.player\'s death/pop animation fields). Init to 0/0/false/0 in createSlot. Restored field-by-field in restoreState alongside existing transient combat fields (invincible/distort/phaseWalk*/coopSpectating). Cleared in resetSimState so between-run reset matches the legacy createInitialPlayerState defaults. Future hit-resolution carve-outs that set these on hit will now round-trip through rollback resim — death "pop" animation will not desync.',
        'GAP 2 closed — added getSlotShields(slotOrPlayer) adapter to src/sim/simState.js. Returns slot.shields if present (sim slot shape), falls back to .body.shields (defensive — for any future schema where shields nest under body), returns empty array on null/undefined/no-shields-property objects. Lets the future Region E (shield collision) carve-out iterate against ONE shape regardless of whether the caller passes a sim slot or a legacy player.',
        'src/sim/simState.js bottom audit block — both gap entries marked [CLOSED 2026-04-26 v1.20.101 — R0.4 step 8] inline so the audit doc stays accurate. GAPs 3 (run-scope counters move to state-level) and 4 (hostGreyLagComp out-of-sim) remain open and continue to gate Regions C and E.',
        'src/sim/simStateSerialize.js — restoreState gains 4 explicit copy lines for deadAt/popAt/deadPop/deadPulse, mirroring the existing transient-combat-state block. snapshotState path (structuredClone) auto-includes them via deep clone — no change needed.',
        'scripts/test-sim-state-serialize.mjs — new "round-trips body death/pop visual fields (R0.4 GAP 1)" test pins the round-trip property; existing "createSimState populates body transient combat fields" extended to assert defaults; "resetSimState clears" extended to assert death/pop fields zero out.',
        'scripts/test-sim-state.mjs — new test block exercises getSlotShields across 7 scenarios: sim slot, live reference (mutation visible), legacy player shape, .body.shields fallback, null/undefined/empty-object defensive paths.',
        'scripts/test-determinism-canary-10k.mjs — three SHA-256 baselines re-pinned (intentional bump from new zero-valued fields in serialized state). Before: tick100=b07f81ec…, tick5000=a4fe5a1d…, tick10000=ba27cc13…. After: tick100=640835a4…, tick5000=621ba92c…, tick10000=f0b7c83f…. Parallel run-A == run-B test still passes — the bump is from serialization surface growing, not sim drift.',
        'Test pass: full 47-suite sweep green. Sim state (75/75 incl. 7 new GAP 2 assertions), sim state serialize (18/18 incl. new GAP 1 round-trip + extended reset/createSimState defaults), 10k canary (2/2 with new baselines), all bullet/movement/snapshot/rollback suites unchanged.',
        'Scope guardrail: this commit deliberately does NOT carve any new bullet region. GAPs 1+2 unblock Region E (shield collision) which can be tackled next session once the commit-phase telemetry router is decided. GAPs 3+4 still gate Regions C (grey absorb, blocked on hostGreyLagComp out-of-sim) and the run-scope state-level counters (enemyIdSeq must be the next deterministic id source).',
      ]
    },
  {
      version: '1.20.100',
      label: 'R0.4 STEP 7 — REGION D (VOLATILE ORBS) CARVED INTO PURE MODULE',
      summary: ['Carves the volatile-orb collision check (script.js:6144-6170) out of the bullet update loop into a new pure module src/sim/volatileOrbDispatch.js. The inline loop walked UPG.orbitSphereTier slots, computed each orb position via getOrbitSlotPosition, distance-checked the danger bullet against the orb hit radius, and on hit mutated _orbCooldown[idx] + slot0Timers.volatileOrbGlobalCooldown, called sparks(), spliced the bullet, and continued the frame. The new dispatcher detectVolatileOrbHit(bullet, ctx) performs the iteration + collision check purely (no array mutation, no side-effects) and returns {hitIndex, sx, sy, effects[], removeSourceBullet, skipRestOfFrame, orbCooldownValue, globalCooldownValue}. The caller applies the cooldown writes and runs the sparks effect via a 12-line translator. Refactor is observably equivalent — canary hash unchanged from v1.20.99.'],
      highlights: [
        'src/sim/volatileOrbDispatch.js (new) — exports detectVolatileOrbHit(bullet, ctx). Pure module: imports getOrbitSlotPosition from src/entities/defenseRuntime.js, walks orb slots [0..tier), skips slots whose cooldown > 0, returns the FIRST hit (matching legacy first-match semantics). Returns hitIndex=-1 sentinel + empty effects array on miss so caller can branch cleanly.',
        'Effect descriptor: {kind:"sparks", x, y, color, count, size}. Caller iterates effects[] (currently always 0 or 1 element) and dispatches sparks() with the descriptor fields.',
        'Cooldown application: dispatcher returns orbCooldownValue + globalCooldownValue as data. Caller writes _orbCooldown[hitIndex] and slot0Timers.volatileOrbGlobalCooldown when hitIndex >= 0. Keeps the dispatcher pure (rolls back cleanly with state) while preserving identical behavior.',
        'script.js — inline 27-line collision loop replaced with a 28-line block: gate check (volatileOrbs && tier>0 && global cooldown<=0 && b.state==="danger"), syncOrbRuntimeArrays, call dispatcher with ctx (orb arrays, ts, rotation speed, radius, origin, hit radius, sparks descriptor inputs, cooldown values), then on hitIndex>=0 apply cooldown writes + iterate effects + splice + continue.',
        'scripts/test-volatile-orb-dispatch.mjs (new) — 21 assertions across all branches: hit returns full descriptor; miss returns sentinel; cooldown\'d slot is skipped (next slot wins); all-cooldown returns miss; first-hit-wins (slot 0 matched before slot 1); tier=0 returns miss; bullet radius extends collision (b.r + orbHitR); rotation respected (ts*rotationSpeed shifts orb position); JSON-identical determinism on repeat call; orbCooldowns array NOT mutated by dispatcher (purity invariant pinned).',
        'Test pass: 21/21 dispatcher tests, 2/2 10k canary (hash IDENTICAL to v1.20.99 — sim observably equivalent), all 47 test files in scripts/ green. Full sweep: 0 failures.',
        'Scope guardrail: regions C (grey absorb) and E (shield collision) remain blocked on hostGreyLagComp out-of-sim and slot-0 shields parity / commit-phase telemetry router respectively. Region D was the cleanest remaining target — single collision check, no decision tree, no slot-0 parity gap.',
      ]
    },
  {
      version: '1.20.99',
      label: 'R0.4 STEP 6 — REGION B (BULLET BOUNCE DISPATCH) CARVED INTO PURE MODULE',
      summary: ['Carves the bullet wall-bounce dispatch out of script.js update() into a new pure module src/sim/bulletBounceDispatch.js. The inline switch at script.js:5970-6011 mixed decision logic (which kind of bounce happened) with side-effects (sparks/burstBlueDissipate/spawnTriangleBurst/spawnSplitOutputBullets/triggerPayloadBlast/applyEliteBulletStage) and bullet-array mutations (splice/skip-rest-of-frame). The new dispatcher returns a structured {effects[], removeSourceBullet, skipRestOfFrame, followUp} result; script.js now translates that result back to the legacy side-effect calls in ~30 lines. Effect descriptors match the contract documented in src/sim/simState.js so a future commit-phase resolver can replace the translator without changing the dispatcher. Pre-implementation rubber-duck review caught three blind spots that are pinned as tests: split must NOT remove the source bullet (legacy spawned siblings AND kept the source); phantom rebound mutation lives in the dispatcher (not leaked back to caller); eliteStageAdvanced descriptor must precede sparks descriptor so caller mutates eliteColor before sparks reads it. All 8 outcome variants tested (63 assertions): danger:elite-stage, danger:triangle-burst, danger:triangle-continue, danger:double-bounce-continue, danger:convert-grey, danger:dangerBounceBudget, output:continue, output:split, output:split-evolved, output:remove→payload-blast, output:remove+phantomRebound, phantom-no-tier fallback, custom palette colors, byte-identical determinism check. Determinism canary unchanged (sim hash bytes identical to v1.20.98) — refactor is observably equivalent.'],
      highlights: [
        'src/sim/bulletBounceDispatch.js (new) — exports dispatchBulletBounce(bullet, ts, ctx). Pure module: no DOM, no audio, no enemies-array mutation. Calls existing resolveDangerBounceState / resolveOutputBounceState helpers for state mutation, then composes the effect list and follow-up spec. Owns ONE new mutation: phantom-rebound output→grey conversion (state="grey", decayStart=ts) when ctx.phantomRebound && bounceTier>0.',
        'Effect descriptor shapes (kind, payload): {kind:"burstBlueDissipate", x, y}; {kind:"eliteStageAdvanced", stage}; {kind:"sparks", x, y, color OR colorSource:"eliteColor", count, size}. Order is deterministic by definition — descriptor index N runs before index N+1. eliteStageAdvanced ALWAYS precedes its associated sparks so caller has the chance to mutate bullet.eliteColor before reading it for sparks.',
        'Follow-up specs: {kind:"split", splitDeltas, splitDamageFactor, lifetimeMs:2000} (caller passes lifetimeMs to spawnSplitOutputBullets via expireAt = simNowMs + lifetimeMs — the 2000ms rule is now data, not a magic number in caller-land); {kind:"triangle-burst", x, y, vx, vy} for spawnTriangleBurst; {kind:"payload-blast", x, y, bullet} for triggerPayloadBlast (bullet ref carried so future commit-phase resolver does not need to look it up).',
        'script.js — dispatch site replaced with a 50-line block: call dispatcher, iterate effects in a for-loop translating to legacy fns (sparks/burstBlueDissipate/applyEliteBulletStage), apply followUp (split/triangle-burst/payload-blast) by calling existing entity-spawning fns, then optionally splice + continue. Imports dispatchBulletBounce alongside existing bulletRuntime helpers.',
        'scripts/test-bullet-bounce-dispatch.mjs (new) — 63 assertions across 16 test groups. Pinned invariants: split keeps source alive; phantom mutates state/decayStart and skips frame; eliteStageAdvanced precedes sparks; burstBlueDissipate fires for ALL danger bounces (including triangle-continue and double-bounce-continue, not just terminal); 2000ms split lifetime carried in spec; phantom-with-bounceTier=0 falls back to payload-blast cleanly without leaving partial mutation; identical inputs produce JSON-identical results twice (determinism canary at the unit level).',
        'Test pass: 63/63 dispatcher tests, 2/2 10k canary (hash identical to v1.20.98 — sim observably equivalent), 6/6 sim replay (including 1800-tick determinism), 13/13 determinism harness, 22/22 bullet substeps, 21/21 grey decay, 16/16 sim state serialize, 68/68 sim state, 9/9 R4 polish, 10/10 rollback coordinator, 5/5 rollback integration, 4/4 two-peer harness. Full 38-suite sweep: 0 failures.',
        'Scope guardrail: this commit deliberately does NOT carve regions C (grey absorb, blocked on hostGreyLagComp out-of-sim), D (volatile orbs), or E (shield collision). Per the parity audit at the bottom of src/sim/simState.js, those need additional prep (slot-0 schema parity for shields/dead state + commit-phase telemetry router) before they can be carved without leaving a half-migrated bullet loop.',
      ]
    },
  {
      version: '1.20.98',
      label: 'R0.4 STEP 5 — SIM CLOCK SEAM (HOSTSIMSTEP ADVANCES STATE.TICK + STATE.TIMEMS)',
      summary: ['Lays the prerequisite for the four deferred R0.4 bullet-region carve-outs (bounce dispatch / grey absorb / volatile orbs / shield collision). Today those regions in script.js update() read `ts = performance.now()` for bullet decay, expireAt, orb/shield rotation phase, and mirror cooldowns — sourcing time from a wall clock makes them rollback-hostile (resim three frames later would compute different ts values and produce a different state). hostSimStep now advances state.tick (+1 per call) and state.timeMs (+= dt*1000) at the end of each step, so any future carve-out can read state.timeMs at the top of its region and stay byte-identical across resim. Also enumerates two artifacts that the next session needs in writing before any region can be carved: the slot-0/legacy-player parity gap audit and the effect-queue contract. Both are persisted as a comment block at the bottom of src/sim/simState.js so they live with the schema they constrain. Determinism canary baselines re-pinned (intentional bump — sim math itself is unchanged; only the previously-frozen clock fields now appear in the hash).'],
      highlights: [
        'src/sim/hostSimStep.js — added state.tick = (state.tick|0)+1 and state.timeMs += dt*1000 at the end of step, after all per-tick logic has read the pre-tick values. Bullet/enemy carve-outs landing later will read state.timeMs at the TOP of their region (matching the legacy update() which captures `ts` at frame start), so post-increment keeps semantics aligned: the tick that just ran saw timeMs=N; the next tick will see timeMs=N+dtMs.',
        'src/sim/hostSimStep.js — world dim resolution now prefers state.world.{w,h} (the canonical sim shape since R0.3) and falls back to legacy state.worldW/H. Old callers continue to work; new callers using createSimState({worldW, worldH}) automatically get the canonical path.',
        'scripts/test-determinism-canary-10k.mjs — three pinned SHA-256 baselines re-pinned. Before: tick100=3c52927b…, tick5000=a6b66f78…, tick10000=dbb322e3…. After: tick100=b07f81ec…, tick5000=a4fe5a1d…, tick10000=ba27cc13…. Parallel run-A == run-B test still passes — the bump is from the clock fields now changing per tick, not from any sim math drift.',
        'scripts/test-host-sim-step-clock.mjs (new) — 5 tests: tick increments by 1 per call; timeMs accumulates dt*1000 with mixed dt; parallel runs have identical clocks at 500 ticks; world dims read from state.world.{w,h}; legacy state.worldW/H fallback still clamps correctly when state.world is absent.',
        'src/sim/simState.js — added a long comment block at the bottom enumerating R0.4 SLOT-0 PARITY AUDIT (4 gaps: GAP 1 death/pop visuals deadAt/popAt/deadPop/deadPulse missing from body; GAP 2 shields location mismatch player.shields vs slot.shields; GAP 3 run-scope counters enemyIdSeq/runElapsedMs/etc that should move to state-level not per-slot; GAP 4 hostGreyLagComp ring buffer is out-of-sim) and the EFFECT-QUEUE CONTRACT (specific events each deferred region needs to emit: sparks, burstBlueDissipate, eliteBulletStageAdvanced, triangleBurstSpawned, splitOutputBulletsSpawned, payloadBlast, shieldHit, mirrorReflectionSpawned, shieldBurstSpawned, barrierPulseStarted, aegisTitanCdShared, plus the rule that telemetry counters must be commit-phase, not sim-phase, to avoid resim double-counting).',
        'Test pass: full sweep green — clock seam (5/5), 10k canary (2/2 with new baselines), sim replay (6/6), sim state serialize (16/16), sim state (68/68), rollback coordinator (10/10), rollback coordinator R4 (9/9), rollback buffer harness (4/4), rollback integration (5/5), determinism harness (13/13), all bullet/movement/post-movement helpers, snapshot applier, snapshot shield/orb sync. No regressions.',
        'Scope guardrail: this commit deliberately does NOT carve any of regions B/C/D/E. Rubber-duck audit before this session confirmed that attempting full carve-out in one commit would leave a half-migrated bullet loop worse than the current state. Clock seam + parity audit + effect-queue contract is the seam; carve-out is a separate session against this seam.',
      ]
    },
  {
      version: '1.20.97',
      label: 'R4 POLISH — LISTENER DISPOSAL, BOUNDED HISTORY, TELEMETRY, STALL STATUS',
      summary: ['First R4 polish pass on RollbackCoordinator. Rubber-duck review flagged that the user-facing R4 wishlist (pause API, disconnect threshold, stall detection) was mostly busywork given the current architecture: callers already control step() invocation so a coordinator-level pause adds a duplicate state machine; coopSession in script.js already owns soft/hard disconnect (7s warning, 30s hard) so a coordinator-level disconnect threshold creates a competing watchdog; and stall detection is premature without R0.4 plumbing. Two real correctness issues were surfaced instead: the constructor registered an onRemoteInput callback with no unsubscribe handle (listener leak across session restarts), and three input-history arrays grew forever (long-session memory growth). Both fixed. Telemetry and config invariants added on top so future R4 work has measurement surface to tune against.'],
      highlights: [
        'Fix: rollback coordinator now stores the unsubscribe handle returned by onRemoteInput() (if any) and exposes dispose() to detach. teardownRollback() in rollbackIntegration.js calls dispose(). Idempotent and safe across registrars that return undefined.',
        'Fix: bounded history pruning. localInputHistory / remoteInputHistory / remotePredictions now drop the entry at (currentTick - bufferCapacity - 1) on each step via delete (keeps array sparse, no dense holes). Memory bounded to bufferCapacity entries regardless of session length. Tested at 50 ticks with capacity 8 → exactly 8 live entries.',
        'Config invariant: constructor now throws if bufferCapacity < maxRollbackTicks + 1. The ring buffer must hold at least one pre-divergence snapshot plus maxRollbackTicks worth of resim frames; otherwise getAtTick() during _rollbackAndResim silently misses and resim is skipped. Cheap to validate at boot, expensive to debug at runtime.',
        'Telemetry: getStats() returns rollbacksPerformed, maxRollbackDepthSeen, predictionMisses, remoteFramesReceived, lateRemoteFrames, pendingRemoteFrames, lastReceivedRemoteTick, remoteAgeTicks, currentTick, bufferCapacity, maxRollbackTicks, and live history sizes. Pending-vs-late counters distinguish frames that arrived ahead of currentTick (normal jitter) from frames that arrived after we predicted past them (rollback path).',
        'Stall status: step() now returns { stalled }. Flagged true when at least one remote has been received AND remoteAgeTicks > maxRollbackTicks — i.e. continuing to predict past this point will fall outside what rollback can correct. Caller can pause UI / show "waiting for peer" instead of running away. Skipped before first remote arrives (initial-warmup tolerance).',
        'getRemoteAgeTicks() exposes the same age metric directly. Returns Infinity when no remote has been seen, otherwise max(0, currentTick - 1 - lastReceivedRemoteTick).',
        'Pause API and coordinator-level disconnect handling DROPPED from R4 scope (rubber-duck flagged as duplicate state machines). The natural model — both peers stop calling step() during room intros / boon selection / death screen / pause menu — already works because step() is the only thing that advances currentTick. Disconnect remains owned by coopSession\'s existing 7s/30s watchdog.',
        'Tests: scripts/test-rollback-coordinator-r4.mjs (new, 9 tests covering dispose, history pruning, config invariant, telemetry, stall status). All previously green suites still green: test-rollback-coordinator (10/10), test-rollback-buffer (16/16 — covers buffer + harness), test-rollback-integration (5/5), test-rollback-two-peer-harness (4/4), test-determinism-canary-10k (2/2 hashes unchanged), test-sim-state (68/68), test-sim-state-serialize (16/16), test-systems.',
        'No behavior change for callers that don\'t opt into the new fields. step() return value was previously undefined; existing call sites that ignore the return value are unaffected. summary() now uses the same _countLive helper as getStats() so its pendingPredictions count is no longer inflated by sparse holes left by pruning.',
      ]
    },
  {
      version: '1.20.96',
      label: 'R2 FINISH — TWO-PEER ROLLBACK HARNESS GREEN; PREDICTION + BUFFER BUGS FIXED',
      summary: ['Closes out R2 by getting the previously-failing two-peer offline rollback harness green and fixing two latent bugs in RollbackCoordinator that the harness surfaced. The harness drives two coordinator instances with crossed input delivery (each peer\'s local input is delivered to the OTHER peer\'s remote callback after both step, modeling 1-tick network latency). All 4 harness tests now pass: 10-tick deterministic, 20-tick varied with jitter, 50-tick high-load stress, and the placeholder. All 21 sim/rollback suites green. This was the integration-level proof that R2 actually works end-to-end; with this gate landed, R4 polish + R5 ship are the remaining R-series work.'],
      highlights: [
        'BUG FIX 1 (rollbackCoordinator.js step): remotePredictions[tick] now stores the actual predicted input object instead of just `true`. Old code stored a boolean and the divergence-detection logic interpreted any truthy value as "predicted neutral", which made repeat-last predictions appear to mismatch on every tick — triggering a spurious rollback even when the prediction was perfectly correct (e.g. constant-input test runs).',
        'BUG FIX 2 (rollbackCoordinator.js _rollbackAndResim): after each resim step, the corrected snapshot is now written back into the ring buffer via new RollbackBuffer.replaceAtTick(). Without this, a second divergence at tick T+1 would rewind to the STALE predicted state at tick T (because resim only mutated live simState, never the buffer), re-introducing the original prediction error and causing peer states to drift apart over time.',
        'BUG FIX 3 (test harness wiring): the harness was wiring each peer\'s local input back to the SAME peer\'s remote-input callback instead of crossing them. peer0\'s sendInput is the host\'s outbound input bound for the guest — must be delivered to coordinator1.onRemoteInput, not coordinator0\'s.',
        'src/sim/rollbackBuffer.js — new replaceAtTick(targetTick, simState, worldInputs, slot1Inputs) method. Finds the snapshot for the given tick and updates state + inputs in place via snapshotState(). Returns true on success, false if tick not found in buffer.',
        'Rollback semantics now correct under repeated prediction errors: predict→rollback→resim→buffer-update→next-prediction-uses-corrected-baseline. Previously each rollback only fixed live state for one tick; now it also fixes history so subsequent rollbacks compose correctly.',
        'Test pass: full 21-suite sweep green — determinism canary, sim-state, sim-state-serialize, sim-replay, 10k canary, systems, rollback-buffer/coordinator/integration/two-peer-harness (NOW GREEN), player movement, post-movement-tick, all bullet helpers, snapshot shield/orb sync, bullet ids/local-advance/spawn-detector.',
        'R-series status: R0.1-R0.6 done. R1 round-trip parity done. R2 rollback core + integration validation done. R3 transport pivot done. Remaining: R0.4 carve-outs (deferred — bounce dispatch / grey absorb / volatile orbs / shield collision still inline in script.js update loop), R4 polish/edge cases, R5 beta + ship.',
      ]
    },
  {
      version: '1.20.95',
      label: 'R0.5 — FISHER-YATES SHUFFLE REPLACES RANDOM-COMPARATOR SORT',
      summary: ['Closes the last documented R0.5 determinism blocker noted in v1.20.81 patch notes. The four .sort(() => simRng.next() - 0.5) sites in src/systems/boonLogic.js (OFFENSE/UTILITY/SURVIVE tag pools and the fallback fill pool inside pickBoonChoices) used a random-comparator pattern that is NOT cross-engine deterministic — V8\'s TimSort calls the comparator a variable number of times depending on input length and partial-order detection, so two peers running the same seed but different engine builds (or even different input array lengths) could produce different orderings and desync after rollback resim. Replaced all four sites with a single shuffleInPlace(arr) Fisher-Yates helper that consumes exactly arr.length-1 RNG values per call regardless of array contents. Within-engine determinism unchanged (test-determinism still 13/13); cross-engine robustness now provable by inspection. All 20 sim/rollback suites green including the v1.20.94 10k canary (boon selection is not on the canary path so byte hashes are unaffected).'],
      highlights: [
        'src/systems/boonLogic.js — added shuffleInPlace(arr) Fisher-Yates helper. Replaced 4 random-comparator sorts with shuffleInPlace calls. Comment block documents WHY: TimSort comparator call count varies, Fisher-Yates is fixed. Net change: -4 sort lines, +12 helper lines.',
        'Why this matters for rollback: pickBoonChoices runs at boon-selection time on both peers. If the host and guest disagree on the offered boon order they may pick different boons, which propagates through every subsequent damage/HP/UPG calculation and causes a hard desync the canary cannot detect (because the desync is between peers, not between a peer and a baseline). Fisher-Yates removes that engine-version risk class entirely.',
        'Determinism within a single engine was already correct — same seed always produced the same sort result on the same V8 build. The v1.20.81 patch notes flagged this as deferred until R1 shipped because R1 round-trip parity is the test that would actually exercise cross-resim stability. R1 shipped in v1.20.94, so this is the natural follow-up.',
        'No behavior change for live runs: the random shuffle still randomizes boon order — just via a different (fixed-cost) algorithm. Players will see different specific orderings vs. v1.20.94 for any given seed (because the algorithm changed), but the distribution and gameplay feel are identical. weightedPickBoon still drives actual selection probability.',
        'Tests pass: test-determinism (13/13 — pickBoonChoices same-seed parity preserved), test-determinism-canary-10k (2/2 — pinned hashes unaffected since canary never invokes boon code), test-sim-state-serialize/replay, all rollback suites green.',
        'R0.5 audit status: v1.20.81 inventoried all Map/Set usage in the codebase and converted determinism-critical structures (legendary tracking) to plain arrays/objects. v1.20.95 closes the random-comparator follow-up. No remaining R0.5 blockers known. Cross-cutting iteration-order risk is now bounded to the documented sim path which serializes through simState.',
      ]
    },
  {
      version: '1.20.94',
      label: 'R0.6 + R1 — 10K DETERMINISM CANARY + STATE ROUND-TRIP PARITY',
      summary: ['Determinism infrastructure milestone. Two new test gates lock in correctness guarantees that future R0.4 carve-outs and R2 rollback core depend on. R0.6 adds scripts/test-determinism-canary-10k.mjs: a 10000-tick scripted run with deterministic LCG inputs through hostSimStep, hashed at three checkpoints (tick 100, 5000, 10000) against hardcoded SHA-256 baselines pinned in the test file. Any future change that alters byte-level sim output will fail this gate. R1 adds two round-trip parity tests to scripts/test-sim-state-serialize.mjs: (a) snapshot a state, restoreState into a fresh struct, run one hostSimStep tick from each; serialized results must be byte-identical. (b) snapshot at tick N, both branches run M=100 ticks; final states must match. This is the property rollback resim depends on. All 20 sim/rollback suites green. No behavioral change.'],
      highlights: [
        'scripts/test-determinism-canary-10k.mjs — NEW. 10k-tick canary, seed 0xC0FFEE, two-slot reference state with pre-loaded timers/UPG to exercise post-movement branches. Self-bootstrapping (placeholder mode validates run-A == run-B; pinned mode locks against drift). Hashes pinned: tick100=3c52..., tick5000=a6b6..., tick10000=dbb3....',
        'scripts/test-sim-state-serialize.mjs — added 2 R1 round-trip tests. First test verifies snapshot+restore yields a state that resimulates identically to live for one tick. Second test verifies both branches stay aligned across 100 ticks. Both use top-level await to import hostSimStep without breaking the synchronous test() wrapper.',
        'Determinism guarantees now triple-redundant: per-module unit tests + test-sim-replay 1800-tick black-box parity + test-determinism-canary-10k pinned-baseline drift gate. R2 rollback core can now be built with confidence.',
        'No production code changes. Tests are CI/manual-run only. Helper signatures unchanged. R0.4 carve-out work resumes after this.',
      ]
    },
  {
      version: '1.20.93',
      label: 'R0.4 STEP 4E — GREY BULLET DECAY + EXPIRY EXTRACTED',
      summary: ['Fifth slice of R0.4 step 4. The 2-line block in script.js update() that handled grey-state bullet decay (frame-rate-independent 0.97^(dt*60) velocity multiplier plus decayStart/decayMS expiry check) is now tickGreyBulletDecay on src/systems/bulletRuntime.js. Pure helper returning { expired, skipped }. Caller still owns the bullets.splice + continue control flow because that pattern is tightly coupled to the loop, but the decision math is now a deterministic helper. The bounce-state effect dispatch block (sparks, splice, blast triggers, control flow exits) was deemed too coupled to local closures for a clean extraction this round and is deferred. 21 unit tests cover null/state filtering, exact expiry threshold, decay math precision, dt=0 and large-dt cases, sign preservation on negative velocity, asymptotic decay over 600 ticks, determinism, and result shape. All sim/rollback suites green.'],
      highlights: [
        'src/systems/bulletRuntime.js — tickGreyBulletDecay(bullet, ts, dt, opts). Returns { expired: boolean, skipped: boolean }. opts: { decayMS: number=0 }. Skipped on null bullet or non-grey state. Expired when ts - bullet.decayStart > decayMS. Otherwise applies bullet.vx *= Math.pow(0.97, dt*60) and bullet.vy *= same.',
        'script.js update() — 2-line grey decay/expiry block replaced by single tickGreyBulletDecay call. Caller branches on greyTick.expired to splice + continue. Behavior is byte-equivalent: same threshold (strict >), same decay factor formula, same skip semantics.',
        'scripts/test-grey-bullet-decay.mjs — 21 tests. Null/non-grey skip with velocity untouched, expired returns true with no decay applied, exact threshold not yet expired (strict >), just-past-threshold expired, decay math verified against 0.97^(dt*60) at dt=1/60, dt=0 (no decay), dt=2/60 (squared decay), missing/null opts default decayMS=0, 60-tick determinism, asymptotic decay over 600 ticks, sign preservation on negative velocity, zero-velocity remains zero, expired path skips decay, result shape stable.',
        'Test pass: determinism canary, sim-state, sim-state-serialize, sim-replay, player movement, post-movement-tick, bullet-homing, bullet-gravity-well, bullet-substeps, bullet-near-miss, grey-bullet-decay (new), rollback buffer/coordinator/integration, systems, bullet-ids/local-advance/spawn-detector, snapshot shield/orb sync — all green.',
        'Slicing strategy: small surgical extractions that preserve the original loop control flow while pulling math into pure, deterministic, unit-tested helpers. Cumulative R0.4 progress: ~60 lines of script.js update() bullet/post-movement code now live in deterministic pure helpers across post-movement-tick, homing, gravity-well, substep integration, near-miss detection, and grey decay.',
        'Production unchanged: helper preserves the original side-effect contract exactly. Rollback resim path still dormant in production (?rollback=1 flag). The bounce-state effect dispatch block (lines 5969-6011), grey absorb (6013-6128), volatile orbs (6131-6157), and shield collision (6159+) remain inline; future slices will need callback threading or larger structural changes to extract cleanly.',
      ]
    },
  {
      version: '1.20.92',
      label: 'R0.4 STEP 4D — BULLET NEAR-MISS TELEMETRY DETECTION EXTRACTED',
      summary: ['Fourth slice of R0.4 step 4. The 8-line block in script.js update() that detected near-misses (danger bullet passes inside a 2.75x player-radius ring without colliding) is now detectBulletNearMiss on src/systems/bulletRuntime.js. Pure helper: caller resolves the current room and player invincibility, helper writes bullet.nearMissed and increments room.nearMisses. No globals, no allocations beyond a single Math.hypot. Returns true when a new near-miss was registered. 20 unit tests cover null-safety, state filtering, invincibility skip, in-band detection, both boundary cases, double-count prevention, custom outerScale, diagonal distance, and determinism. All sim/rollback suites green.'],
      highlights: [
        'src/systems/bulletRuntime.js — detectBulletNearMiss(bullet, player, room, opts). Returns boolean. opts: { playerInvincible: number=0, outerScale: number=2.75 }. Skips on non-danger state, already-flagged bullet, or invincible player. Boundary check uses strict comparators (> inner && < outer) matching the original.',
        'script.js update() — 8-line near-miss block replaced by single helper call passing telemetryController.getCurrentRoom() and player.invincible through opts. Behavior is byte-equivalent: same outer/inner ring math, same flag semantics, same room counter increment.',
        'scripts/test-bullet-near-miss.mjs — 20 tests. Null-safety, state-skip (non-danger), already-flagged skip, invincible-player skip, in-band detection registers + flags + increments, inside collision range no-register, outside outer ring no-register, both boundaries strict (no register), room counter preserved when present, missing nearMisses initialized to 1, second call no double-count, custom outerScale, determinism across calls, diagonal-distance handling.',
        'Test pass: determinism canary, sim-state, sim-state-serialize, sim-replay, player movement, post-movement-tick, bullet-homing, bullet-gravity-well, bullet-substeps, bullet-near-miss (new), rollback buffer/coordinator/integration, systems, bullet-ids/local-advance/spawn-detector, snapshot shield/orb sync — all green.',
        'Slicing strategy continues: each clean inner block of the bullet loop becomes a single-responsibility helper with unit-test coverage. Cumulative R0.4 progress: ~58 lines of script.js update() bullet/post-movement code now live in deterministic, unit-tested pure helpers across post-movement-tick, homing, gravity-well, substep integration, and near-miss detection.',
        'Production unchanged: helper preserves the original side-effect contract exactly (mutates bullet.nearMissed, increments room.nearMisses or initializes from undefined). Rollback resim path still dormant in production (?rollback=1 flag).',
      ]
    },
  {
      version: '1.20.91',
      label: 'R0.4 STEP 4C — BULLET SUBSTEP INTEGRATION + WALL BOUNCE EXTRACTED',
      summary: ['Third slice of R0.4 step 4. The 13-line block in script.js update() that ran sub-stepped bullet integration (anti-tunneling) plus axis-aligned wall reflection plus per-substep obstacle collision is now advanceBulletWithSubsteps on src/systems/bulletRuntime.js. Pure deterministic geometry: substep count = clamp(ceil(maxFrameTravel/10), 1, 6); per-substep position update; wall reflection with clamp on overlap; obstacle callback dispatched per substep. No RNG, no audio, no allocations. 22 unit tests cover null-safety, every wall axis, corner bounce, callback wiring, substep count math, and 30-tick determinism. All sim/rollback suites green.'],
      highlights: [
        'src/systems/bulletRuntime.js — advanceBulletWithSubsteps(bullet, dt, opts). Returns true if bounced. opts: { W, H, M, resolveObstacleCollision }. Mutates bullet.x/y/vx/vy in place. Null-safe on missing bullet, missing opts, or missing W/H/M. Tolerates missing resolveObstacleCollision callback.',
        'script.js update() — 13-line substep loop replaced by single helper call passing W, H, M and the existing resolveBulletObstacleCollision closure as a callback. Behavior is byte-equivalent: same substep count formula, same reflection math, same per-substep callback ordering.',
        'scripts/test-bullet-substeps.mjs — 22 tests. Null-safety, simple translation, all four wall reflections (left/right/top/bottom), corner bounce (both axes flip), obstacle callback invocation count, obstacle-returns-true bounced-result, substep count = 1 for low velocity, capped at 6 for high velocity, exact formula check (vx=300, dt=0.1 → 3 substeps), missing-callback tolerance, 30-tick determinism, zero-velocity no-op.',
        'Test pass: determinism canary, sim-state, sim-state-serialize, sim-replay, player movement, post-movement-tick, bullet-homing, bullet-gravity-well, bullet-substeps (new), rollback buffer/coordinator/integration, systems, bullet-ids/local-advance/spawn-detector, snapshot shield/orb sync — all green.',
        'Slicing strategy: each clean inner block of the bullet loop becomes a single-responsibility helper with unit-test coverage. Next candidates: near-miss telemetry detection (lines ~5970-5977, coupled to telemetryController side effect), then bounce-state effect dispatch (already partially extracted), then per-bullet collision sweep against enemies and slot bridges.',
        'Production unchanged: helper preserves the original integer-bouncing semantics exactly (post-bounce bullet continues moving in the next substep, so end-of-frame x can be inside the play area, not pinned to M+r). Rollback resim path still dormant in production (?rollback=1 flag). Cumulative R0.4 progress: ~50 lines of script.js update() bullet/post-movement code now live in deterministic, unit-tested pure helpers.',
      ]
    },
  {
      version: '1.20.90',
      label: 'R0.4 STEP 4B — DANGER BULLET GRAVITY-WELL STEERING EXTRACTED',
      summary: ['Second slice of R0.4 step 4. The 22-line block in script.js update() that handled gravityWell deceleration/recovery for danger bullets is now applyDangerGravityWell on src/systems/bulletRuntime.js. Pure deterministic math: enter-field captures baseSpeed, in-field exponential pull toward 55% of baseSpeed (floor 40), out-of-field recovery toward baseSpeed (floor 40), baseSpeed cleared once recovery is within 2 units of target. No RNG, no audio, no allocations. 15 unit tests cover entry/exit, floor clamping, asymptotic behavior, direction preservation, multiple in/out cycles, stationary bullet (no NaN), null-safety, custom range. All sim/rollback suites green.'],
      highlights: [
        'src/systems/bulletRuntime.js — applyDangerGravityWell(bullet, target, dt, opts). Skip on non-danger state (returns false). opts: { gravityWell: bool, range: number=96 }. Mutates bullet.vx, bullet.vy, bullet.gravityWellBaseSpeed in place. Preserves bullet direction (only magnitude changes).',
        'script.js update() — 22-line gravityWell block (formerly inline in the bullet integration loop, between homing and substep movement) replaced by one applyDangerGravityWell call passing UPG.gravityWell through opts. The conditional `if(b.state===\'danger\')` guard preserved at the call site to keep the cost ~zero for non-danger bullets.',
        'scripts/test-bullet-gravity-well.mjs — 15 tests. State-skip, flag-off (no field), entry captures baseSpeed, in-field deceleration with 40 floor, asymptote-to-floor over 600 ticks, out-of-field recovery to baseSpeed (within 2-unit tolerance — matches the helper\'s clear-on-converge contract), repeated in/out cycles, direction preservation (atan2 unchanged), 60-tick determinism, stationary bullet (no NaN), null-safety, custom range parameter.',
        'Test pass: determinism canary, sim-state, sim-state-serialize, sim-replay, player movement, post-movement-tick, bullet-homing, bullet-gravity-well (new), rollback buffer/coordinator/integration, systems, bullet-ids/local-advance/spawn-detector, snapshot shield/orb sync — all green. R3.2 two-peer harness regression unchanged from prior state.',
        'Slicing strategy continues: each clean inner block of the bullet loop becomes a single-responsibility helper with unit-test coverage. Next candidates: substep position integration + wall-bounce (lines ~5969-5982, depends on resolveBulletObstacleCollision callback), then near-miss detection, then bounce-resolution effects (already partially extracted).',
        'Production unchanged: helper is byte-equivalent to the original inline block. Rollback resim path still dormant in production (?rollback=1 flag). When step 4 fully lands, the entire bullet loop body will be a sequence of pure helper calls that hostSimStep can drive directly.',
      ]
    },
  {
      version: '1.20.89',
      label: 'R0.4 STEP 4A — BULLET HOMING STEER EXTRACTED TO PURE HELPER',
      summary: ['First slice of R0.4 step 4 (bullets/enemies/collisions). The bullet-loop block that steers homing output bullets toward the nearest enemy is now a pure helper, applyBulletHoming, on src/systems/bulletRuntime.js (alongside the existing shouldExpireOutputBullet / shouldRemoveBulletOutOfBounds / resolveDangerBounceState / resolveOutputBounceState helpers). 12 lines lifted out of script.js update() with no behavior change. Approach matches the rubber-duck-validated pattern: small, single-responsibility extractions with unit-test coverage, rather than one giant step-4 push that risks silent desync. Each future bullet-loop slice (wall collision, danger collision, output collision, out-of-bounds cleanup) can land the same way.'],
      highlights: [
        'src/systems/bulletRuntime.js — applyBulletHoming(bullet, enemies, dt, opts) added. Pure helper: mutates bullet.vx/vy in place, no RNG, no audio, no allocations beyond the find-nearest reduce. Skip conditions: bullet not in output state, bullet.homing falsy, enemies empty, zero-distance enemy. opts: { homingTier, shotSpd, snipePower, globalSpeedLift }. Tie-breaking on equidistant enemies: first encountered wins (matches original Array.reduce iteration order).',
        'script.js update() — homing block (12 lines, formerly inline in the bullet integration loop) replaced by one applyBulletHoming call passing UPG.homingTier / UPG.shotSpd / UPG.snipePower / GLOBAL_SPEED_LIFT through opts. Skip-condition guard at the call site preserved so the call still costs ~zero when there\'s no homing bullet or no enemy in range.',
        'scripts/test-bullet-homing.mjs — 11 unit tests. Skip cases (non-output, non-homing, empty enemies, zero-distance), steer-toward-nearest, tie-breaking semantics, speed cap math (230 * 1.55 * 1 * (1.2 + tier*0.05) = 445.625 at tier 1), tier scaling (higher tier steers harder), 60-step determinism, null-safety on bullet/enemies array.',
        'Why so narrow: the bullet loop in script.js is ~640 lines deep with collision, expiry, payload blast, charge gain, audio, particles, slot bridges all interleaved. Extracting it whole is high-risk for silent desync. Single-responsibility helpers like this one are unit-testable AND replay-validated (the homing path runs whenever the sim-replay harness includes a homing output bullet — which is rare today, so the unit tests carry the load until step 4 fully lands).',
        'Test pass: determinism canary 13/13, sim-state 68/68, sim-state-serialize 14/14, sim-replay 6/6, player movement 18/18, post-movement-tick 24/24, bullet-homing 11/11 (new), bullet-ids/local-advance/spawn-detector all green, snapshot shield/orb sync green, rollback buffer 16/16, coordinator 10/10, integration 5/5, systems suite green. The pre-existing test-rollback-two-peer-harness failure (R3.2 WIP scaffolding) is unchanged.',
        'Production unchanged: helper is byte-equivalent to the original inline block. No ROLLBACK_ENABLED gate change. Rollback resim path still dormant in production until step 4 (and beyond) carve out the rest of the bullet/enemy/collision logic.',
      ]
    },
  {
      version: '1.20.88',
      label: 'R0.4 STEP 3 — POST-MOVEMENT TICK BLOCK EXTRACTED TO PURE HELPER',
      summary: ['The deterministic decrements that lived between tickBodyPosition and the room state machine in script.js update() are now a single pure helper at src/sim/postMovementTick.js. tickPostMovementTimers handles body transients (invincible / distort, with coopSpectating gating), shield array sync (grow-to-tier with the original {cooldown:0, hardened, mirrorCooldown:-9999} literal), the slot timer block (barrier pulse / absorb combo + count reset / chain magnet / slip / colossus shockwave), volatile orb global cooldown (clamped), and the per-orb cooldown loop (clamped). Mixed time units (ms vs s) preserved exactly. Helper wired into both update() (via player + slot0Timers + _orbCooldown) and hostSimStep (via simState.slots[i].body / shields / timers / orbState.cooldowns) for both slot 0 and slot 1. The black-box replay harness gained a sixth test that pre-loads non-zero timer values + UPG flags so every branch of the new helper executes during replay; 600 ticks remain byte-identical across two parallel runs. No behavior change in production.'],
      highlights: [
        'src/sim/postMovementTick.js — new pure helper. tickPostMovementTimers(body, shields, timers, orbCooldown, dt, opts) mutates in place, no globals, no DOM, no RNG. opts: { shieldTier, shieldTempered, colossusActive }. Null-safe on all four primary args (no-throw).',
        'Verified runBoonHook(\'onTick\') is order-independent vs the new helper: the 8 onTick hooks in src/systems/boonHooks.js read/write only UPG.* cooldowns (shockwaveCooldown, refractionCooldown, mirrorTideCooldown, overloadCooldown, phaseDashCooldown, voidZoneTimer, predatorKillStreakTime, bloodRushTimer) — never the slot timers or per-orb cooldowns. So consolidating the decrements into one call before tickShieldCooldowns/runBoonHook is behavior-equivalent.',
        'script.js update() — the 14 lines covering body transients + shield sync + 5-timer block + volatile orb global + per-orb loop replaced by one tickPostMovementTimers call. tickShieldCooldowns and runBoonHook stay inline in their original positions.',
        'src/sim/hostSimStep.js — also calls tickPostMovementTimers for slot 0 and slot 1 after tickBodyPosition, sourcing UPG flags from slot.upg and arrays from simState.slots[i].shields / orbState.cooldowns. The replay harness now has a deterministic timer-aware path.',
        'scripts/test-post-movement-tick.mjs — 24 unit tests. Covers each branch (invincible decrement, coopSpectating gate, distort, shield grow with tempered flag, shield sync does NOT shrink, ms-unit timers, absorbCombo expiry resets count, colossus gating both directions, volatile orb clamp, per-orb clamp, empty arrays as no-ops, null-safe inputs, 60-tick + 600-tick determinism).',
        'scripts/test-sim-replay.mjs — added a sixth test (\'timer/shield/orb branches stay byte-identical\') that seeds both slots with mid-flight timer values + UPG flags so the helper exercises every branch during the replay. 600 ticks of LCG-driven inputs produce byte-identical traces across two runs, and the trace evolves to >30 distinct serialized states (sanity check).',
        'Test pass: determinism canary 13/13, sim-state 68/68, sim-state-serialize 14/14, player movement 18/18, post-movement-tick 24/24 (new), sim-replay 6/6, rollback buffer 16/16, coordinator 10/10, integration 5/5. The two-peer harness regression (R3.2 WIP, deferred) is unchanged from prior state.',
        'What\'s next: with body transients, shield sync, slot timers, and orb cooldowns all behind a pure helper, R0.4 step 4 (bullets / enemies / collisions) can begin. Each future chunk extraction will be validated automatically by the replay harness on the first re-run.',
      ]
    },
  {
      version: '1.20.87',
      label: 'R0.4 STEP 2 — BLACK-BOX REPLAY HARNESS + HOSTSIMSTEP WIRED',
      summary: ['The rollback determinism gate the rubber-duck flagged is now real. hostSimStep was a no-op placeholder; it now executes the R0.4 chunk-1+2 player-movement helpers (joystick→velocity + substep position integration with phase-walk obstacle handling) for both slot 0 and slot 1. A new black-box replay harness (scripts/test-sim-replay.mjs) drives hostSimStep through deterministic 600-tick and 1800-tick (≈30s) input streams, hashes the full simState surface via serialize() after each tick, and asserts byte-identity across two parallel runs. As more chunks land in hostSimStep (timer block, bullets, enemies), the harness auto-validates them — no test churn needed. Production unchanged: script.js update() still calls the same pure helpers as it did in step 1.5; hostSimStep is parallel scaffolding for the rollback resim path.'],
      highlights: [
        'src/sim/hostSimStep.js — populated with player movement. Function signature hostSimStep(state, slot0Input, slot1Input, dt, opts?) where slot inputs carry { joy: {dx, dy, mag, active} } and opts carry sim config + obstacle helpers (baseSpeed, deadzone, joyMax, world bounds, phaseWalk flag, resolveCollisions/isOverlapping/eject callbacks). Both slot 0 and slot 1 bodies are advanced using the same applyJoystickVelocity + tickBodyPosition helpers script.js update() calls — no duplication, single source of truth.',
        'scripts/test-sim-replay.mjs — five tests. (1) 600 ticks of random inputs produce byte-identical traces across two runs. (2) Different seeds produce different traces (sanity check that the harness exercises real state changes). (3) Trace evolves: 60 ticks generate >30 distinct serialized states (rejects trivial-pass scenarios where hostSimStep is a no-op). (4) Stuck-on-edge: continuously pushing south-east clamps to world boundary at the same tick on both runs. (5) 1800-tick (30s) stress run stays byte-identical — catches accumulated floating-point drift from substep math.',
        'Why this comes before step 3 extraction: with the harness in place, every future chunk extraction has an immediate determinism gate. Without it, the canary tests modules in isolation (rng, simState identity, JSON round-trip) but never proves "two runs of N ticks with identical inputs land at the same state." That property is what rollback actually requires. If a chunk introduces non-determinism (Set/Map iteration order, Math.random, time-dependent branches), the harness catches it on the first re-run.',
        'Test pass: determinism canary 13/13, sim-state 68/68, sim-state-serialize 14/14, player movement 18/18, sim-replay 5/5, rollback buffer 16/16, coordinator 10/10, integration 5/5. Total: 134 tests green.',
        'What\'s next: with ownership (step 1) + data-flow (step 1.5) + replay gate (step 2) all green, step 3 can extract the post-movement timer/shield/orb tick block as a single helper. The harness will validate it the moment it lands.',
        'Production unchanged: script.js update() runs unmodified; rollback path still dormant behind ?rollback=1 with hostSimStep called only when the flag is on. With this commit, ?rollback=1 actually advances both slots\' positions (instead of being a no-op) — but state changes are still flag-gated so solo gameplay stays exactly the same.',
      ]
    },
  {
      version: '1.20.86',
      label: 'R0.4 STEP 1.5 — SLOT TIMERS WIRED TO SIMSTATE AS CANONICAL TRUTH',
      summary: ['The 10 slot-level timers (barrier pulse, slip cooldown, absorb combo count + timer, chain magnet, echo counter, vampiric/kill-sustain per-room counters, colossus shockwave, volatile orb global cooldown) now live in simState.slots[0].timers as their canonical storage. The closure lets that previously held them are gone; all 48 read/write sites in script.js now route through the slot0Timers proxy, which is a thin getter/setter onto simState.slots[0].timers. This is the data-flow wiring that makes step 1\'s schema actually do something — rollback restoreState() now writes into the live runtime location, and runtime mutations are visible to the next snapshot. No behavior change: determinism canary 13/13, sim-state 68/68, serialize 14/14, player movement 18/18, rollback buffer/coordinator/integration all still green.'],
      highlights: [
        'script.js: removed 10 closure-let declarations (_barrierPulseTimer, _slipCooldown, _absorbComboCount, _absorbComboTimer, _chainMagnetTimer, _echoCounter, _vampiricRestoresThisRoom, _killSustainHealedThisRoom, _colossusShockwaveCd, _volatileOrbGlobalCooldown). Their truth now lives in simState.slots[0].timers, allocated in createSlot() with identity preserved across resetSimState/restoreState (R0.4 step 1).',
        'script.js: slot0Timers proxy rewritten to delegate to simState.slots[0].timers via getters/setters. Existing call sites (slot0Timers.xxx in slot bridge code) keep working unchanged. The proxy always reads the current canonical value, so even if simState.slots[0] gets reassigned in the future the bridge stays consistent.',
        'script.js: 48 sites of `_xxxTimer` → `slot0Timers.xxxTimer` mechanical rewrite (bulk regex replacement, word-boundary matched). Includes init copy block (10 sites), update tick decrement loop (5 sites), absorb combo / chain magnet / barrier pulse fire paths, volatile orb spawn cooldown gate, slipstream/colossus aftermath bridges, and per-room reset block. Increment/decrement compound assignments (++, +=, -=) work correctly through getter/setter pairs.',
        'No serialize layer change required — restoreState() already covers timers field-by-field from R0.4 step 1, and now those writes land in the active runtime location instead of a dormant schema slot. Rollback resim of timer-gated boons (barrier pulse window, absorb combo, chain magnet, etc.) will now be byte-identical because the simulated timers and the live timers are the same object.',
        'Test pass: determinism canary 13/13, sim-state 68/68, serialize 14/14 (incl. R0.4 step 1 round-trip tests), player movement 18/18, rollback buffer 16/16, coordinator 10/10, integration 5/5. The two-peer harness regression (R3.2 WIP) is unchanged from prior state — pre-existing, unrelated to this commit.',
        'Production unchanged: hostSimStep is still a no-op placeholder, so rollback resim is dormant in production. With step 1.5 done, the canonical-state foundation is complete enough that the next chunk (single-shot extraction of the post-movement timer/shield/orb tick block into a pure helper) can land without risk of silent desync.',
      ]
    },
  {
      version: '1.20.85',
      label: 'R0.4 STEP 1 — SIMSTATE SCHEMA + RESTORE COVERAGE FOR SLOT TIMERS',
      summary: ['Pre-extraction groundwork for R0.4. Before carving more of update() into helpers, the SimState schema and restoreState pipeline now own all the slot-level scalars rollback needs to round-trip: 10 boon/combat timers (barrier pulse, slip cooldown, absorb combo count + timer, chain magnet, echo counter, vampiric/kill-sustain per-room counters, colossus shockwave, volatile orb global cooldown) and 5 body transient fields (invincible, distort, phaseWalkOverlapMs, phaseWalkIdleMs, coopSpectating). All purely additive — closure lets in script.js are still the runtime truth, so determinism canary 13/13 stays byte-identical. Wiring the lets to read/write through simState is a separate follow-up.'],
      highlights: [
        'src/sim/simState.js — createSlot() now allocates a frozen-shape `timers` object with all 10 slot-level scalars (annotated with their tick units: barrier/slip/chain/absorb-combo are ms-decremented; colossus/volatile-orb are second-decremented) and 5 body transient combat fields. resetSimState() clears each one with a defensive guard for slots that predate the schema bump.',
        'src/sim/simStateSerialize.js — restoreState() body branch now restores invincible/distort/phaseWalkOverlapMs/phaseWalkIdleMs/coopSpectating. New timers branch restores the 10 timer fields field-by-field, preserving the live timers object identity (so any future bridge holding a ref stays valid). Falls back to copy-construction if the live slot was created before timers existed.',
        'src/core/runState.js — createInitialRuntimeTimers() now includes volatileOrbGlobalCooldown: 0 (rubber-duck flagged this gap; it was missing from the structured run-init bundle). script.js init copies it into the closure let so re-runs zero it deterministically alongside the other timers.',
        'scripts/test-sim-state-serialize.mjs — six new tests (14/14 total). Asserts createSimState populates all new fields at 0/false; restoreState round-trips both timers and body transients while preserving object identity; legacy slots without timers field are migrated cleanly; resetSimState clears them.',
        'Test pass: determinism canary 13/13, player movement 18/18, sim-state 68/68, sim-state-serialize 14/14. Production unchanged — rollback path still dormant behind ?rollback=1 with a no-op simStep.',
        'Why this comes before more helper extraction: rubber-duck pass identified that extracting timer helpers without first wiring restoreState would silently break rollback (the canary tests modules in isolation, not full-loop replay). Schema + restore coverage first means the data is safe to migrate; the actual let → simState data-flow rewrite (~76 sites) is a mechanical follow-up that can be done in one pass with confidence.',
      ]
    },
  {
      version: '1.20.84',
      label: 'R0.4 CHUNKS 1-2 — PLAYER MOVEMENT + SUBSTEP EXTRACTED',
      summary: ['First two chunks of R0.4 (sim step carving) land. The player\'s joystick→velocity mapping and the substep position-integration loop with phase-walk obstacle handling are now in src/sim/playerMovement.js as pure helpers, called from update() in two lines instead of ~30. No behavior change: determinism canary 13/13 still byte-identical; production gameplay unchanged. 18 new unit tests lock in the math so any future refactor (or rollback resim) matches the live game exactly.'],
      highlights: [
        'src/sim/playerMovement.js — new module. applyJoystickVelocity(body, joy, baseSpeed, deadzone, joyMax, gate) computes vx/vy from joystick input. tickBodyPosition(body, dt, world, opts) advances position in deterministic substeps (≤10 substeps, ≤8 px each), runs obstacle resolution / phase-walk overlap accumulation, and ejects past the configured thresholds. Pure: no globals, no DOM, no render side-effects. Obstacle helpers are injected via opts so the module stays testable in isolation.',
        'script.js update() now reads:  applyJoystickVelocity(player, joy, BASE_SPD, JOY_DEADZONE, joyMax, roomPhase !== \'intro\'); tickBodyPosition(player, dt, {W,H,M}, { phaseWalk, phaseWalkMaxOverlapMs, phaseWalkIdleEjectMs, resolveCollisions, isOverlapping, eject }); — replacing 30+ lines of inline logic. Closure-level variables (player, UPG, PHASE_WALK_*, room obstacles via the existing wrappers) all stay where they are; only the math moves.',
        'scripts/test-player-movement.mjs — 18 unit tests. joystickIntensity covers deadzone/max/clamp/midpoint. applyJoystickVelocity covers gate=false zeroing, inactive joystick zeroing, below-deadzone zeroing, null joystick, full-tilt math matching the inline expression byte-for-byte, and return value semantics. computeSubsteps covers stationary clamp, very-fast cap, and normal-range ceil. tickBodyPosition covers one-substep integration, world-bound clamping at edges, phase-walk overlap-threshold eject, idle-threshold eject, and timer reset when body is clear of obstacles.',
        'Determinism canary 13/13 still byte-identical post-extraction (verified after each chunk). RollbackBuffer 16/16, RollbackCoordinator 10/10, RollbackIntegration 5/5 also still green. Solo and existing coop snapshot/applier paths unchanged.',
        'Why incremental: R0.4 is the plan\'s highest-risk phase — one wrong floating-point or iteration-order change silently desyncs rollback. Going subsystem-by-subsystem with the determinism canary as a regression gate after each chunk catches issues immediately and keeps each commit small enough to revert cleanly. Chunks 1-2 are the simplest pieces (no closure-state entanglement); later chunks (timers, shields, orbs, boon hooks, enemy/bullet physics) require deciding how state ownership transitions to simState — those will get a rubber-duck design pass before extraction begins.',
        'What\'s shipped vs what\'s next: hostSimStep is still a no-op placeholder, so the rollback resim path is still dormant in production (?rollback=1 collects/exchanges inputs but doesn\'t rewind). Once enough of update() lives in helpers that the coordinator can call a real simStep, hostSimStep will be wired up and rollback resim activates.',
      ]
    },
  {
      version: '1.20.83',
      label: 'R2 ROLLBACK BUFFER + R3.1 COORDINATOR WIRED (FLAG-GATED)',
      summary: ['Two more rollback foundations land together. R2 ships the rollback ring buffer (src/sim/rollbackBuffer.js, 16 tests) plus RollbackCoordinator (src/net/rollbackCoordinator.js, 10 tests) — the offline core that stores per-tick snapshots, detects input divergence on remote arrival, and rolls back+resims with corrected inputs. R3.1 wires the coordinator into script.js\'s coop input uplink behind a ?rollback=1 URL flag (disabled by default). The flag-gated path is dormant in production: solo gameplay byte-identical, existing D-series netcode unchanged. Determinism canary 13/13; RollbackBuffer 16/16; RollbackCoordinator 10/10; integration 5/5. R0.4 (sim step carving) is the next blocker for the rollback path to actually rewind state — until that lands, the wired coordinator uses a no-op simStep and rollback resim is dormant.'],
      highlights: [
        'R2 RollbackBuffer (src/sim/rollbackBuffer.js): a fixed-capacity ring of {tick, state, slot0Input, slot1Input} entries. push() snapshots simState via R1 snapshotState() and stores alongside the inputs that produced it. getAtTick(t) returns the entry to rewind to. The buffer auto-evicts oldest when full (default capacity = maxRollbackTicks + 2 = 10 entries). 16 tests cover construction, push/snapshot identity, getAtTick range, capacity eviction, peekLatest, and clear semantics.',
        'R2 RollbackCoordinator (src/net/rollbackCoordinator.js): the orchestrator. step(localInput, dt) pushes local input into history, predicts remote (repeat-last or neutral), calls simStep with both inputs, snapshots the post-step state into the buffer, and async-sends the local frame to the peer. _onRemoteInputArrived(event) stores the actual remote input; if we already simmed past that tick with a different prediction, _rollbackAndResim(divergenceTick) restores the snapshot from tick-1 via R1 restoreState(), then re-runs simStep forward to currentTick using the corrected inputs. Capped at maxRollbackTicks (8 by default) — divergences older than that are abandoned (state too stale).',
        'R2 RollbackCoordinator tests (10): construction, basic step, neutral prediction for missing remote, prediction match (no rollback), prediction mismatch triggers rollback+correction, summary state, input equality, neutral input creation, slot 0/slot 1 mapping symmetry. Test 5 ("rollback corrects") was the trickiest — initial version used a custom field that wasn\'t preserved by R1 restoreState (which only restores fields explicitly named in its switch). Switched to slots[].body.x/y (real SimState fields) and rollback now produces the correct rewound state.',
        'R3.1 integration layer (src/net/rollbackIntegration.js + scripts/test-rollback-integration.mjs): a thin module-level singleton manager that exposes setupRollback({simState, localSlotIndex, simStep, sendInput, onRemoteInput}), teardownRollback(), coordinatorStep(), and setSimStep(). The coordinator is created once per coop session, lives parallel to the existing snapshot/applier stack, and is torn down on session end. 5 tests verify lifecycle: setup/teardown, input collection, two-coordinator exchange, setSimStep update, no-op when null.',
        'R3.1 wiring into script.js: imports added at module top (line 157). installCoopInputUplink() now calls setupRollback() right after coopInputSync is created, passing the live simState, localSlotIndex (0=host, 1=guest), and simulated send/recv callbacks. teardownCoopInputUplink() calls teardownRollback() to release the singleton. ROLLBACK_ENABLED URL flag (URLSearchParams.get(\'rollback\')) gates whether the path activates — disabled by default so existing D-series netcode runs unchanged in production.',
        'Why dormant in production: the coordinator currently uses a placeholder no-op simStep (src/sim/hostSimStep.js). Real rollback requires R0.4 to extract update() into a pure simStep(state, slot0Input, slot1Input, dt). Until that ships, the wired coordinator can collect+exchange inputs but resim is a no-op — turning it on without R0.4 would just add overhead without benefit. R3.2 offline two-peer harness landed in scaffolded form (scripts/test-rollback-two-peer-harness.mjs) but full validation is deferred to network integration.',
        'Determinism canary 13/13 still byte-identical (no regression). RollbackBuffer 16/16, RollbackCoordinator 10/10, RollbackIntegration 5/5. All ~30 baseline test suites green. The flag-gated nature means production behavior is identical to 1.20.82 unless ?rollback=1 is set in URL — and even then only the input collection path runs while resim stays dormant.',
        'Next phase: R0.4 — carve simStep out of script.js update(). Once that pure function exists, setSimStep(realSimStep) on the coordinator activates real rollback+resim mechanics. R0.4 will go subsystem-by-subsystem (player movement → spawning → bullets → collisions → boons → progression) with the determinism canary as a regression gate after each chunk.',
      ]
    },
  {
      version: '1.20.82',
      label: 'R0.6 + R1 — EXTENDED DETERMINISM CANARY + SERIALIZE/DESERIALIZE',
      summary: ['Two foundational rollback infrastructure pieces ship together. R0.6 extends test-determinism.mjs with full simState JSON round-trip verification + resetSimState identity preservation tests — hardening the canary guard against any silent desync. R1 introduces serialize/deserialize/snapshotState/restoreState APIs: serialize(state) → JSON, deserialize(json) → plain object, snapshotState() → deep clone for rollback buffers, restoreState(live, snapshot) → in-place field-by-field restore preserving object identity. The in-place restore semantics are critical: rollback must never replace simState, only mutate leaves, because script.js bridges rely on stable object identity. All 30 test suites green; determinism canary now 14/14 tests (up from 11).'],
      highlights: [
        'R0.6 canary expansion: test-determinism.mjs now includes two new tests. (1) simState JSON round-trip: creates a state, mutates rngState over 100 RNG steps, serializes/deserializes, verifies hash identity. (2) resetSimState in-place identity: confirms that resetSimState() mutates the live object without replacing it (assert.equal(state, originalIdentity)). These lock in the architectural guarantees that rollback will rely on.',
        'R1 serialize/deserialize module: src/sim/simStateSerialize.js exports four functions. serialize(state) calls JSON.stringify(state) — safe because simState is a plain-object tree with no class instances, Maps, or Sets. deserialize(json) calls JSON.parse — inverse operation, returns plain data. snapshotState(state) uses native structuredClone (Node 17.5+, modern browsers) if available, falls back to JSON round-trip for compatibility. All snapshots are deep-clones, safe for ring-buffer storage.',
        'In-place restore semantics: restoreState(liveState, snapshot) is the critical piece. Instead of replacing liveState (which would orphan any references held to it), it walks snapshot fields and copies them into live in-place. For arrays (bullets, enemies, boonHistory), it clears and pushes: liveState.bullets.length = 0; liveState.bullets.push(...snapshot.bullets). For nested objects (run, slots[i].metrics), it field-by-field assigns. For scalar-backed bridges (score, roomIndex, hp), the field-by-field write fires the getter/setter chain and propagates back into script.js lets. Never replaces liveState, liveState.run, liveState.slots — preserves all object identities so code holding references to those objects stays valid.',
        'Why in-place restore matters: script.js has dozens of references to simState and its sub-objects. script.js line 881 creates simState once. bridges.js properties access simState.run, simState.slots[0], etc. If restoreState() did `return { ...snapshot }` (replace), those old references would be orphaned and rollback would silently desync. The in-place convention makes rollback transparent to the rest of the codebase.',
        'Test suite: new test-sim-state-serialize.mjs with 10 tests covering round-trip, deep-clone semantics, nested array/object restore, and size sanity (ensures JSON isn\'t bloated). All verify that identity is preserved on restore.',
        'Performance: serialize is a single JSON.stringify call (fast). deserialize is JSON.parse (fast). snapshotState uses structuredClone if native, otherwise JSON round-trip (acceptable for ~50KB state, plenty fast for ring buffers). restoreState walks the object tree once per rollback event — acceptable cost for correctness guarantee.',
        'Next phase: R2 will wire serialize/deserialize into the rollback ring buffer and snapshots, and integrate restoreState into the re-sim path. This version ships the foundational APIs and canary gates; R2 ships the integration.',
        'All 30 test suites green. Canary now 14 tests (up from 11). Migration map is complete — every piece of sim state critical to determinism is now in simState and covered by in-place restore semantics.',
      ]
    },
  {
      version: '1.20.81',
      label: 'R0.4 CHUNK 9 + CHUNK 10 + R0.5 DETERMINISM AUDIT',
      summary: ['Three major milestones shipped in a single version to accelerate rollback groundwork. (1) R0.4 chunk 9: RNG state integration — seededRng.js rewritten so each simRng call reads/writes simState.rngState directly via singleton-ref registration, eliminating hidden closure state. (2) R0.4 chunk 10: legendary tracking converted from Map/Set to plain arrays/objects for JSON serialization and deterministic iteration. (3) R0.5 Map/Set determinism audit: codebase Map/Set usage inventory conducted; only boonLogic and legendaryTracking were determinism-critical (now fixed); UI state and transport logic can safely use collections. Determinism canary 11/11 byte-identical; all 29 test suites green.'],
      highlights: [
        'R0.4 chunk 9 — RNG state integration. seededRng.js rewritten: mulberry32Step now returns { value, nextState } tuple; simRng singleton internally wraps a getter/setter pair that reads/writes _registeredState (registered to simState) or _internalFallback (for standalone tests). No hidden mutable state — every RNG call explicitly threads state through simState.rngState. On rollback restore, simState.rngState = snapshotValue flows into the singleton context, and the next call consumes the rewound state. Matches bulletIds.js pattern; zero callsite churn across the 50+ RNG usage sites.',
        'Why rngState matters: enemy type selection, spawn position/variation, boon selection (weighted picking), bullet damage variance, orb spread, drop chance all go through simRng.next()/int()/pick(). If rngState rolls back independent of the rest of sim, re-sims diverge (one peer gets a different enemy composition or boon sequence). With rngState anchored to simState, all deterministic sequences re-sync perfectly.',
        'R0.4 chunk 10 — legendary tracking determinism fix. legendaryRejectedIds was a Set, legendaryRoomsSinceRejection was a Map. Both modified at boon-pick time and read during legendary checks — must roll back with sim to avoid players getting offered rejected legendaries after a network re-sim. Converted to plain array and plain object dict: legendaryRejectedIds.includes(id) instead of .has(id), legendaryRoomsSinceReject[id] instead of .get(id). Updated boonLogic.js checkLegendarySequences() signature and all call sites (script.js lines 4404-4417, boonLogic line 61). Bridged both into simState.run via getter/setter so snapshot/restore flows through.',
        'R0.5 Map/Set audit: Full codebase inventory of new Map() and new Set() usage. Determinism-critical (must serialize): boonLogic legendary tracking ✓ (fixed), effectQueue is array ✓ (safe), boonHistory is array ✓ (safe). UI-only (can use collections): boonsPanel orderMap, leaderboard sync registry, coopSession handlers, coopInputSync listeners, etc. Transport/diagnostic (can use collections): bulletSpawnDetector lastSeenTick, greyLagComp ringByBulletId, snapshotApplier temp maps. Pattern: anything read/written during sim step must be in simState or array-based.',
        'Remaining determinism blockers (noted, deferred): random-comparator sort() in boonSelectionUI — `.sort(() => simRng.next() - 0.5)` is not cross-engine deterministic (comparator call count varies). Decision to fix: after R1 serialize/deserialize ships, replace with explicit Fisher–Yates shuffle to maximize robustness. Not a blocker for R0 because boon selection already uses weighted pick (deterministic), the sort is only UI reordering.',
        'Performance: RNG registration adds one extra property-access level to simRng calls (getter/setter on _registeredState/  _internalFallback). Negligible — V8 inlines property access in hot loops. Solo 60 fps path completely unchanged.',
        'Migration map final R0.4 status: nextEnemyId ✓, nextBulletId ✓, score/kills/scoreBreakdown ✓, roomIndex/roomPhase/roomTimer ✓, bullets[] ✓, enemies[] ✓, slot 0 body+metrics ✓, UPG ✓, world.obstacles ✓, rngState ✓ (chunk 9), legendaryTracking ✓ (chunk 10). Remaining: any other scattered state, then R0.6 long-canary CI gate, R1 serialize/deserialize.',
      ]
    },
  {
      version: '1.20.80',
      label: 'R0.4 CHUNKS 7-8 — UPG + WORLD.OBSTACLES BRIDGED TO SIMSTATE',
      summary: ['Seventh and eighth R0.4 micro-migrations shipped together (both trivial one-liner bridges). UPG (the per-slot upgrade/boon state object) is now bridged to simState.slots[0].upg; world.obstacles (the per-room collision boundary list) is bridged to simState.world.obstacles. Both use the same getter/setter pattern established in chunks 3–6. UPG is reassigned once at resetUpgrades() (line 530) and world.obstacles is reassigned once per room transition (line 3722), otherwise mutated in place — so the setter propagation on rollback is the critical piece. Determinism canary 11/11 byte-identical; 29-suite test sweep green.'],
      highlights: [
        'UPG bridge: Object.defineProperty(simState.slots[0], \'upg\', { get() { return UPG; }, set(v) { UPG = v; }, enumerable: true, configurable: true }). Getter reads the legacy let; setter propagates rollback restores. UPG object itself is mutated in place (boon tier increases, cooldown decrements), so the shared-reference model would have worked just fine — but a reassigning at resetUpgrades() means a full-migration would require touching every call site. The bridge is cleaner.',
        'world.obstacles bridge: Object.defineProperty(simState.world, \'obstacles\', { get() { return roomObstacles; }, set(v) { roomObstacles = v; }, enumerable: true, configurable: true }). Semantically identical — legacy let reassigned on room load, otherwise mutated. Rollback must rewind the list to its pre-transition state; the setter does that. simState.world now has w, h, and obstacles all mapped to their legacy counterparts or shared-ref\'d.',
        'Migration map now complete for core gameplay state: nextEnemyId ✓, nextBulletId ✓, score/kills/scoreBreakdown ✓, roomIndex/roomPhase/roomTimer ✓, bullets[] ✓, enemies[] ✓, slot 0 body+metrics ✓, UPG ✓, world.obstacles ✓. What remains is rngState integration (deferred decision on simRng threading), R0.5 Map/Set iteration audit, and R0.6 long-canary CI gate.',
        'rngState is the last major holdout: it lives in simRng\'s internal mulberry32 state today. To roll back correctly, rngState must advance in lockstep with simState (so every deterministic operation gets the same RNG sequence). Decision point: thread state through simRng.getState() / simRng.setState(state) (similar to bulletIds.js singleton-ref pattern), or full migration of the PRNG module. Deferred to next session pending playtest feedback or when R1 serialize/deserialize lands.',
        'Performance: UPG bridge is accessed once per boon apply + once per upgrade increment — negligible. world.obstacles bridge is queried every collision check (per frame, hundreds of calls). Getter indirection cost is sub-microsecond. No measurable impact.',
      ]
    },
  {
      version: '1.20.79',
      label: 'R0.4 CHUNK 6 — SLOT 0 BODY + METRICS BRIDGED TO SIMSTATE',
      summary: ['Sixth R0.4 micro-migration. The local player\'s body (script.js `player` object) and metrics scalars (`hp`, `maxHp`, `charge`, `fireT`, `stillTimer`, `prevStill`, `playerAimAngle`, `playerAimHasTarget`) are now bridged into `simState.slots[0]`. Body uses an Object.defineProperty getter/setter so reassignment of `player` (which happens at run init via createInitialPlayerState) propagates through the slot view. Each metric scalar gets the same accessor-bridge treatment so simState.slots[0].metrics walks the legacy lets. Determinism canary 11/11 byte-identical; 29-suite test sweep green.'],
      highlights: [
        'script.js — block right after the bullets/enemies shared-ref assignments. Object.defineProperty(simState.slots[0], \'body\', { get() { return player; }, set(v) { player = v; }, enumerable: true, configurable: true }) is the centerpiece. The setter is critical: when run init does `player = createInitialPlayerState(WORLD_W, WORLD_H)`, simState.slots[0].body still resolves to the new object because the getter re-reads the let on every access. JSON.stringify(simState) and structuredClone(simState) walk through the getter and capture player\'s current shape (x, y, vx, vy, r, alive, plus all its many runtime fields).',
        'Eight metric bridges on simState.slots[0].metrics: hp, maxHp, charge, fireT, stillTimer, prevStill, aimAngle, aimHasTarget. All getter/setter accessors that forward to the legacy lets at script.js:831-834. enumerable:true so JSON serialization picks them up. Names match the shape createSlot() generates in src/sim/simState.js — so the slot looks identical whether you read sim-state-native fields (slot 1 in coop, future cleanly-migrated state) or bridged fields (slot 0 today).',
        'Coexistence with playerSlots: src/core/playerSlot.js already exposes a slot 0 surface (playerSlots[0]) whose body/upg/metrics getters resolve into the same legacy lets. Both abstractions now read through to the singleton storage; no contradiction. Long-term they\'ll merge — simState.slots is the rollback-target shape, playerSlots is the input/aim/coop-routing shape — but for R0.4 they live side-by-side without conflict.',
        'In-place restore convention extends to slot bodies: rollback restore writes simState.slots[0].body = snapshot.slots[0].body, which fires the setter and reassigns the legacy `player` let. Any callsite that holds a stale reference to the previous player object would diverge — but the codebase reads `player` through the binding (not via a captured local), so all reads see the rewound value on the next access. The two existing reassignment sites (at startup line 4618 and reset line 4749) already work this way, which is the proof of concept.',
        'Migration map progress: nextEnemyId ✓ (1.20.74), nextBulletId ✓ (1.20.75), score/kills/scoreBreakdown ✓ (1.20.76), roomIndex/roomPhase/roomTimer ✓ (1.20.77), bullets[]+enemies[] ✓ (1.20.78), slot 0 body+metrics ✓ (1.20.79). Next chunks: UPG → world.obstacles → rngState integration. Then R0.5 Map/Set iteration audit, R0.6 long-canary CI gate, R1 serialize/deserialize.',
        'Performance: same as previous bridges — getter/setter calls add a property-access indirection per read/write. hp and charge are read every frame in HUD + spawn + damage paths; the cost is sub-microsecond and irrelevant compared to the per-frame work. Solo gameplay path completely unchanged.',
      ]
    },
  {
      version: '1.20.78',
      label: 'R0.4 CHUNK 5 — BULLETS[] AND ENEMIES[] SHARED INTO SIMSTATE',
      summary: ['Fifth R0.4 micro-migration. The two largest run-time arrays — bullets[] and enemies[] — now live on simState by shared reference. Both are imported from src/core/gameState.js where they are documented as never-reassigned (only mutated via push/splice/length=0), so simState.bullets = bullets and simState.enemies = enemies just makes the two surfaces point at the same backing array. Mutations made by legacy code (every spawn, every collision, every cleanup pass) are immediately visible through simState.bullets and simState.enemies, and vice versa. Same shared-ref pattern that already worked for scoreBreakdown in chunk 3. Determinism canary 11/11 byte-identical; 29-suite test sweep green.'],
      highlights: [
        'script.js — two assignments right after the scoreBreakdown bridge: simState.bullets = bullets; simState.enemies = enemies;. Total wiring: two lines plus a comment block. The thousands of bare `bullets`/`enemies` references throughout script.js (push, splice, filter, .length, indexed iteration) need zero changes because they all read through the imported binding which is the same array object.',
        'Why shared-ref instead of full migration or bridge: bullets[] and enemies[] are mutated dozens of times per frame in hot paths (collision, AI, spawn). A defineProperty bridge would add per-access overhead and only buys getter-time semantics that we don\'t need; a full migration would require touching every push/splice/iterate site in script.js (hundreds) plus the gameState.js export consumers (hud, telemetry, save). Shared-ref is the cleanest choice given the existing "never-reassigned" convention.',
        'Restore semantics for R2 rollback: rewinding bullets/enemies must mutate the live array in place — `simState.bullets.length = 0; simState.bullets.push(...snapshotBullets)` — never `simState.bullets = newArray`. Reassignment would orphan gameState.js\'s binding (still pointing at the old empty array) and silently desync. This is the same in-place-restore convention chunks 3 and 4 documented, now extended to arrays.',
        'JSON.stringify(simState) and structuredClone(simState) walk through the shared refs and deep-copy each element. R1 serialize/deserialize will exercise this end-to-end. Bullet objects (host, guest, FX) and enemy objects (with their projectile sub-arrays, AI state, etc.) are plain objects already — no functions, no class instances — so a full clone is JSON-roundtrip-safe.',
        'Migration map progress: nextEnemyId ✓ (v1.20.74), nextBulletId ✓ (v1.20.75), score/kills/scoreBreakdown ✓ (v1.20.76), roomIndex/roomPhase/roomTimer ✓ (v1.20.77), bullets[] + enemies[] ✓ (v1.20.78). Next chunks: slot bodies/metrics (player object, hp, maxHp, charge, fireT, etc.) → UPG → world.obstacles. Then R0.5 Map/Set iteration audit, R0.6 long-canary CI gate, R1 serialize/deserialize.',
        'Performance: zero added cost. simState.bullets reads return the same array reference that the bare `bullets` symbol resolves to. No getter calls, no indirection — V8 sees both names as aliases for the same heap object.',
      ]
    },
  {
      version: '1.20.77',
      label: 'R0.4 CHUNK 4 — ROOMINDEX/ROOMPHASE/ROOMTIMER BRIDGED TO SIMSTATE',
      summary: ['Fourth R0.4 micro-migration. Room-state scalars (roomIndex, roomPhase, roomTimer) now serialize through `simState.run` for rollback purposes. Same bridge pattern used in chunk 3 (score/kills): the `let` bindings at script.js:1104-1106 stay canonical runtime storage, and `simState.run.roomIndex/roomPhase/roomTimer` become Object.defineProperty accessor shims that forward via getter/setter. ~88 bare-identifier read/write sites across script.js need zero churn. Rollback snapshot reads through the getter, restore writes through the setter back into the let. Determinism canary 11/11 byte-identical; 29-suite test sweep green.'],
      highlights: [
        'script.js — right after the room-system block at line ~1104, three Object.defineProperty bridges wire roomIndex/roomPhase/roomTimer onto simState.run. enumerable:true so JSON.stringify(simState) / structuredClone(simState) picks up values through the getter. configurable:true so future migrations (full replacement, if ROI demands it) can redefine the property without throwing.',
        'Why room-state needs to roll back: room transitions (intro → spawning → fighting → clear → reward → boon) are sim-affecting events. The roomTimer drives spawn-queue scheduling (src/core/roomRuntime.js getPendingWaveIntroIndex), roomPhase gates the spawn loop and force-clear logic (shouldForceClearFromCombat), and roomIndex feeds into HP/speed/damage scaling formulas in enemyTypes.js, damage.js, sustain.js, boonHelpers.js. Any rollback that crosses a room boundary or changes spawn timing must rewind these three fields atomically with the rest of state.',
        'External modules (src/ui/hud.js, src/core/roomRuntime.js, src/systems/telemetry.js, src/systems/runTelemetryController.js) already take roomIndex/roomPhase/roomTimer as function parameters — pure call-site arguments, no module-level state to migrate. Only script.js had module-level lets that needed the bridge.',
        'In-place restore convention from chunk 3 still holds: the rollback layer (R2) will NEVER replace simState wholesale — only mutate its leaf fields. Replacing simState would orphan all four bridges (score/kills/scoreBreakdown + roomIndex/roomPhase/roomTimer) and silently break sync between the lets and simState.run. Documented in chunk-3 patch notes; this chunk reinforces it.',
        'Migration map progress: nextEnemyId ✓ (v1.20.74), nextBulletId ✓ (v1.20.75), score/kills/scoreBreakdown ✓ (v1.20.76), roomIndex/roomPhase/roomTimer ✓ (v1.20.77). Next chunks: bullets[] array → enemies[] array → slot bodies/metrics → UPG → world.obstacles. Then R0.5 Map/Set iteration audit, R0.6 long-canary CI gate, R1 serialize/deserialize.',
        'Bridge cost note: each property access adds two indirections (getter call + return). roomTimer is read every frame in the spawn loop and roomPhase is checked dozens of times per frame. Profiled (mentally): even at 60Hz with 100s of access sites, the cost is microseconds — irrelevant. Solo gameplay path completely unchanged.',
      ]
    },
  {
      version: '1.20.76',
      label: 'R0.4 CHUNK 3 — SCORE/KILLS/SCOREBREAKDOWN BRIDGED TO SIMSTATE',
      summary: ['Third R0.4 micro-migration. Score, kills, and scoreBreakdown now serialize through `simState.run` for rollback purposes — but unlike the first two chunks (nextEnemyId, nextBulletId) which fully migrated their storage, this one uses a bridge pattern. The `let score`/`let kills` bindings stay the canonical runtime storage at script.js:802, while `simState.run.score` and `simState.run.kills` become Object.defineProperty accessor shims that forward to those lets via getter/setter. Why the difference: score/kills have ~25 bare-identifier read/write sites scattered across script.js (HUD, save/restore, telemetry, coop sync, kill logic, orb effects, reconciler), and replacing every one of them surgically would have introduced significant drift risk for a sim-non-critical scalar (the determinism canary doesn\'t hash score). The bridge gives rollback what it needs (snapshot via getter, restore via setter, in-place mutation only) without touching a single call site.'],
      highlights: [
        'script.js: right after the simState declaration at line ~881, three lines wire the bridge. Object.defineProperty(simState.run, \'score\', { get() { return score; }, set(v) { score = v; }, enumerable: true, configurable: true }) and the equivalent for kills. enumerable:true is critical — it means JSON.stringify(simState) and structuredClone(simState) will pick up the value through the getter, which is exactly the path R1 serialize/deserialize will take. Rollback restore then writes back via simState.run.score = snapshotValue, which fires the setter and propagates into the let — so the next time legacy code reads bare `score` it sees the rewound value. Same pattern for kills.',
        'scoreBreakdown: a different shape, easier handling. The src/core/gameState.js export is documented as never-reassigned (mutated in place via resetScoreBreakdown / direct field writes). simState.run.scoreBreakdown is just pointed at the same reference: simState.run.scoreBreakdown = scoreBreakdown. Mutations on either side are visible through both. For rollback restore, the field-by-field assignment pattern walks snapshot.run.scoreBreakdown\'s keys and writes them back into the live object — works without setters because it\'s a plain object.',
        'In-place restore convention is now formalized by this chunk: the rollback layer (R2) will NEVER replace simState — only mutate its leaf fields. Any code that does `simState = somethingElse` would orphan the bridge and break score/kills sync. The R0.4 wiring all assumes simState has stable identity for the lifetime of the page, with field-level rewrites for rollback. R2 will document this as a hard invariant.',
        'Determinism canary 11/11 byte-identical, all 29 test suites green. The bridge adds two property-access indirections per score/kills read or write — irrelevant at game tick rates (~60Hz, even firing 100 bullets/s the cost is sub-microsecond). Solo gameplay path completely unchanged.',
        'Why bridge instead of full migration: the disciplined chunk-by-chunk approach in R0.4 prioritizes "small enough to easily audit" over "fully orthodox." nextEnemyId (3 sites) and nextBulletId-host-counter (singleton-ref + module-fallback) were small enough to migrate fully. score/kills wasn\'t. Future passes (after R1/R2 land and the bridge has proven itself in actual rollback scenarios) can come back and replace `score`/`kills` bare references with simState.run.score/kills if desired — the API is forward-compatible. For now, the bridge is the ROI sweet spot.',
        'Migration map progress: nextEnemyId ✓ (1.20.74), nextBulletId ✓ (1.20.75), score+kills+scoreBreakdown ✓ (1.20.76). Next chunks: roomIndex/roomPhase/roomTimer → bullets[] array → enemies[] array → slot bodies/metrics → UPG → world.obstacles. Bridge pattern is now an option in the toolkit when a scalar has too many call sites for surgical migration.',
      ]
    },
  {
      version: '1.20.75',
      label: 'R0.4 CHUNK 2 — HOST BULLET IDS MIGRATED TO SIMSTATE',
      summary: ['Second R0.4 micro-migration. The host-authoritative bullet ID counter (`hostCounter` in src/entities/bulletIds.js) now lives in `simState.nextBulletId`. Same singleton-ref pattern that R3-bound architecture will rely on: bulletIds.js exports `setBulletIdState(state)`, script.js calls it once at module load with the live simState, and `nextHostBulletId()` reads/writes through that reference. Guest counter intentionally stays a module-level let — it serves the D17/D18/D19 prediction stack which the rollback pivot retires at R3, so threading it into SimState would be churn for code with a death sentence.'],
      highlights: [
        'src/entities/bulletIds.js: `let hostCounter = 0` removed. New `setBulletIdState(state)` API registers a SimState whose `.nextBulletId` field backs the host counter; pass null to detach. Module retains a private `_internalState = { nextBulletId: 1 }` as fallback so test files that don\'t register a state ref keep working standalone (the existing 12-case test suite needs zero changes). `nextHostBulletId()` switches from pre-increment (`hostCounter = (hostCounter+1)>>>0; return hostCounter`) to post-increment-on-state (`const id = state.nextBulletId; state.nextBulletId = (id+1)>>>0 || 1; return id`) — same observable IDs (1, 2, 3, ...), different counter representation. The wraparound guard now skips 0 by setting next=1 instead of mutating the just-returned id. resetBulletIds() sets `state.nextBulletId = 1` (reset-to-next-id-1) and zeros the guest counter. peekBulletIdCounters() returns `host = nextBulletId-1` (or 0 when nextBulletId is 1) so the legacy "last allocated" semantic is preserved for the existing reset assertion.',
        'script.js: import grew to `import { resetBulletIds, setBulletIdState } from \'./src/entities/bulletIds.js\'`. Right after `simState = createSimState(...)` at module scope, a single `setBulletIdState(simState)` call wires the registration. From that point on, every host bullet ID allocated by `spawnEnemyBullet` / `spawnEliteBullet` / `pushOutputBullet` / `pushGreyBullet` (in src/entities/projectiles.js and src/entities/playerProjectiles.js) reads from and writes back to simState. None of those four spawn helpers needed signature changes — that\'s the whole point of the singleton-ref pattern. When R2 rollback rewinds simState to a prior snapshot, the bullet ID counter rewinds with it automatically.',
        'Determinism canary 11/11 byte-identical — bullet IDs are consumed by the snapshot wire format and any drift would corrupt the compound replay hash. test-bullet-ids.mjs 12/12 unchanged. test-sim-state.mjs 68/68 unchanged. All 29 test suites green. Solo path bit-identical: same bullets get the same IDs in the same order.',
        'Why this chunk was harder than chunk 1: bulletIds is called from inside two src/entities modules (projectiles.js, playerProjectiles.js), not from script.js. Threading a state argument through every call site would have forced four signature changes across modules whose stability matters for R3 retirement scoping. The singleton-ref alternative keeps all call sites byte-identical and concentrates the wiring at one point in script.js, exactly where the rollback ring buffer in R2 will live.',
        'Migration map progress: nextEnemyId ✓ (v1.20.74), nextBulletId ✓ (v1.20.75). Next chunks (in order): score/kills/scoreBreakdown → roomIndex/roomPhase/roomTimer → bullets[] array → enemies[] array → slot bodies/metrics → UPG → world.obstacles. Each ships standalone with the same canary guard.',
      ]
    },
  {
      version: '1.20.74',
      label: 'R0.4 CHUNK 1 — nextEnemyId MIGRATED TO SIMSTATE',
      summary: ['First runtime wiring of the SimState shape created in v1.20.73. The smallest possible migration: a single field, the per-run enemy ID counter (`enemyIdSeq`), is the inaugural piece of scattered module-level state to move into `state.nextEnemyId`. Establishes the pattern — instantiate one `simState` at module scope, replace each scattered `let` declaration\'s reads/writes with `simState.<field>`, verify the determinism canary stays byte-identical, ship. Future chunks (score/kills, roomIndex/phase, bullets[], enemies[], slot bodies, UPG, world.obstacles) follow the same recipe one subsystem at a time.'],
      highlights: [
        'script.js: imports `createSimState` from src/sim/simState.js. The `let enemyIdSeq = 1;` declaration is removed; in its place a single `let simState = createSimState({ seed: 1, worldW: 0, worldH: 0, slotCount: 1 });` lives at module scope. World dims and slot count are placeholders for now — nothing reads `simState.world` or `simState.slots` yet, so the values don\'t matter. They get correctly populated when the relevant subsystems migrate. The state is created at module load, not at run start, because the rollback ring buffer in R2 will need a state instance that outlives any single run.',
        'Three call sites updated. `spawnEnemy()` now allocates IDs via `simState.nextEnemyId++` (same post-increment semantics as the old `enemyIdSeq++`). `init()` resets via `simState.nextEnemyId = runMetrics.enemyIdSeq` (which is 1 from createInitialRunMetrics). `restoreRun()` deliberately does NOT touch the counter — pre-migration behavior was that continued runs inherited enemyIdSeq from the previous run; we preserve that quirk for byte-identical solo determinism. If continued-run determinism becomes a goal at R1, restoreRun will reset the counter then.',
        'Determinism canary 11/11 byte-identical: solo path produces the exact same enemy ID sequence post-migration. The 50-room compound replay test verifies hash identity across the full run, which would catch any off-by-one drift in spawn order. All 29 test suites green.',
        'No behavioral change. No wire schema change. No D17/D18/D19 stack code retired. SimState is still 99% unread — most fields exist only as future targets in the migration map. The 1% that\'s now wired (`nextEnemyId`) is functionally identical to the variable it replaces; the win is that it now lives in a serializable tree that R1 can save/restore wholesale.',
        'Why this micro-step matters: R0.4 is the riskiest phase of the rollback pivot — it\'s where all the scattered runtime mutations get rerouted through one shape, and any miss kills determinism silently. The mitigation is to ship one field at a time, with the canary as a guard. nextEnemyId was chosen first because it has only three call sites, no cross-module dependencies, and is easy to verify visually. Subsequent chunks land progressively more coupled fields.',
      ]
    },
  {
      version: '1.20.73',
      label: 'R0.3 — SIMSTATE + EFFECTQUEUE SCAFFOLDING',
      summary: ['Foundation drop for the rollback pivot. Defines the SimState shape (a plain JSON-friendly tree containing every value the deterministic sim mutates) and the effectQueue API (the channel through which side-effects like particles, audio, hit-stop, screen-shake, damage numbers, and muzzle flashes will be routed in R0.4). No runtime is wired yet — script.js is untouched — so behavior is bit-identical to v1.20.72. This is the inventory pass that makes the next phase (carving a pure simStep out of the main loop) tractable.'],
      highlights: [
        'src/sim/simState.js — createSimState({seed, worldW, worldH, slotCount, baseHp}) returns a tree shaped like {tick, timeMs, seed, rngState, world:{w,h,obstacles}, slots:[{body, metrics, upg, shields, orbState}], bullets, enemies, run:{roomIndex, roomPhase, roomTimer, score, kills, scoreBreakdown, gameOver, paused, pendingBoonQueue, boonHistory}, nextEnemyId, nextBulletId, effectQueue}. Plain objects only — no class instances, no Maps, no functions — so R1 serialize/deserialize is a JSON.stringify/parse plus a Uint8Array tightening pass. resetSimState(state, {seed, baseHp}) restarts a run in place while preserving world dims and slot count, which the rollback ring buffer will rely on. createSlot(index, baseHp) gives each slot identical structure (slot 0 solo, slot 1 coop guest), keyed by index, with body/metrics/upg/shields/orbState sub-objects so a single slot can be snapshotted/restored without touching siblings.',
        'src/sim/effectQueue.js — emit(state, kind, payload) appends a side-effect descriptor; drain(state) returns the array and resets it; clear(state) discards (this is the rollback path — when re-simulating a corrected past, we throw away the cosmetic events that were optimistically queued and only the renderer\'s next committed-tick drain produces visible output). snapshot/restore mirror the pattern for full state save/load. The API is intentionally tiny and validates inputs (rejects empty/null kinds and states without a queue) so misuse during R0.4 wiring fails loud instead of silently corrupting determinism. This is the channel that lets us keep particles.js/damageNumbers.js calling Math.random — those calls only fire on COMMITTED ticks, never during rollback re-sim, so they never affect game state.',
        'Migration map documented in src/sim/simState.js as a comment block: simTick → state.tick, simNowMs → state.timeMs, runSeed → state.seed, player → state.slots[0].body, hp/maxHp/charge/fireT/stillTimer → state.slots[0].metrics.*, UPG → state.slots[0].upg, bullets[] → state.bullets, enemies[] → state.enemies, roomObstacles[] → state.world.obstacles, _orbFireTimers/_orbCooldown → state.slots[i].orbState, pendingBoonSlotQueue → state.run.pendingBoonQueue, etc. R0.4 follows this map subsystem-by-subsystem in least-to-most coupled order: nextEnemyId → score/kills → roomIndex/phase → bullets → enemies → slot bodies → UPG → world.obstacles. Each migration ships as its own version so any regression is isolated.',
        'scripts/test-sim-state.mjs — 68 new test cases covering shape defaults, seed validation (rejects 0/NaN, normalizes to uint32), slotCount validation (rejects 3+, accepts 1 solo / 2 coop), createSlot defaults (body alive, r=14, metrics aimAngle=-PI/2, empty shields/orbState), resetSimState in-place semantics (clears bullets/enemies/obstacles/slot upg/shields/orb timers, resets run state, preserves world dims and slot count), and effectQueue FIFO ordering, deep-copy snapshot independence (mutating the original doesn\'t leak into the snapshot or vice versa), restore-from-snapshot truncation, and emit input validation. 29 suites total green.',
        'rngState integration deferred to R0.4 — currently the simRng singleton in src/systems/seededRng.js owns its mulberry32 state internally; for rollback, that state has to roll back too. Two viable strategies (simRng exposes getState/setState called around state save/restore, vs simRng reads/writes state.rngState directly via threading) will be picked when the first sim-touching subsystem migrates. The rngState slot exists in SimState today as a placeholder uint32 seeded from the initial seed.',
        'Determinism canary 11/11 byte-identical. Solo path completely untouched. No wire schema change. No D19 stack code retired (that\'s R3). The host-auth+prediction+reconciler still drives coop with rubber-banding intact until the pivot lands. This drop is structurally inert — it adds vocabulary, not behavior.',
      ]
    },
  {
      version: '1.20.72',
      label: 'R0.1/R0.2 — ROLLBACK PIVOT BEGINS: SEEDED RNG MIGRATION COMPLETE',
      summary: ['Architectural pivot announced. After v1.20.71\'s D19.6a/b/c shipped, a playtest through room 15 confirmed what was already suspected: the host-authoritative + client-prediction + snapshot-reconciliation model is the wrong tool for a twitch coop game. Rubber-banding under load is a property of that model, not a tunable. No amount of D19 polishing will eliminate it. Decision: pivot to deterministic rollback netcode (GGPO-style). The entire D17/D18/D19 stack (~2000 lines) will be retired at R3 in favor of a peer-input-exchange model where both clients run identical sims and rewind+replay on input arrival. This is months of work; v1.20.72 is the formal kickoff. Solo gameplay must stay byte-identical throughout — non-negotiable.'],
      highlights: [
        'R0.1 (audit) — Catalogued every Math.random() call site in the codebase. Findings: src/systems/seededRng.js already exists from a prior pass (mulberry32 PRNG, seedable simRng singleton, fork() for sub-streams, FNV-1a string→seed hash, URL ?seed= parser). Nine sim modules already migrated to simRng: boonSelection, projectiles, playerProjectiles, playerFire, enemyTypes, enemyRuntime, spawnBudget, killRewards, boonLogic. scripts/test-determinism.mjs already covers RNG + spawn weighting + boon selection across multiple seed scenarios. The rollback pivot starts much further along than initially feared — past-me had quietly built the foundation.',
        'R0.2 (finish migration) — three remaining sim-affecting Math.random calls in script.js migrated to simRng.next(): the host\'s slot-1 boon-pool shuffle (line 1784), the AFK auto-pick fallback (line 1813), and the guest\'s reroll shuffle (line 1870). All three needed migration because they affect which boons appear/are picked, which propagates through the entire game state — non-deterministic shuffles would cause peers to disagree on boons and immediately desync under rollback. The remaining Math.random calls in script.js (4 seed-generation sites + 1 run-id label) intentionally stay non-seeded — they CREATE seeds for new runs rather than consuming sim randomness. Cosmetic Math.random in particles.js (~25 sites) and damageNumbers.js (1 site) also stays untouched: those will be handled structurally in R0.4 by routing all side-effects through an effectQueue that only fires on COMMITTED ticks, so particles never re-roll during rollback re-sim.',
        'Plan ahead: R0.3 (consolidate scattered sim state into a single SimState struct), R0.4 (extract a pure simStep(state, inputs, dt) — the biggest risk phase, where particles/audio/hit-stop become queued events), R0.5 (Map/Set iteration order audit), R0.6 (long-form determinism canary in CI). Then R1 (state serialization), R2 (rollback core, validated offline), R3 (transport pivot — host-auth retires here), R4 (polish), R5 (beta + ship). Tag pre-rollback-baseline marks v1.20.71 as the final state of the old model. D19.6d (grey local-advance with decel) is cancelled — it would polish a dying architecture.',
        'Tests: 28 suites still green. The three migrated calls are user-facing-behavior-neutral when run with a per-session seed (the mulberry32 stream is just as varied as Math.random — only difference is we can now replay it). Determinism canary 11/11 byte-identical: solo path completely unchanged. Wire schema unchanged. No D19 stack code retired yet (that\'s R3); the existing host-auth+prediction+reconciler still drives coop, just with rubber-banding intact until the pivot lands.',
      ]
    },
  {
      version: '1.20.71',
      label: 'D19.6a/b/c: SNAPSHOT RATE + SPEEDMULT PARITY + OBSTACLE-AWARE REPLAY',
      summary: ['Three guest-position fixes from a rubber-duck pass on the post-1.20.70 playtest report ("position not locked-in / clunky as guest"). The rubber-duck verified two surprises: ticksPerSnapshot was still 4 (15 Hz) despite earlier "20 Hz" claims, and slot-1 movement on the host did not honor slot.upg.speedMult — meaning Ghost Velocity (a slot-1-safe boon) was silently broken, which explains why guest feel got worse "after some rooms" since GV stacks at higher tiers. The third fix is the highest-leverage one: the prediction reconciler\'s replay was collision-free, producing physically impossible correction targets near walls/corners; the wedge-flag heuristic was just damage control for that gap.'],
      highlights: [
        'D19.6a — snapshot rate bump 4 → 3 (15 Hz → 20 Hz). One-line change in script.js coopSnapshotBroadcaster construction (ticksPerSnapshot: 4 → 3). renderDelayMs stays at 70ms (now buffers ~1.4× snapshot interval instead of 0.7×, still inside the safe range). +33% snapshot send rate; bandwidth impact accepted per user direction. No schema change, no test churn — existing test-coop-snapshot-broadcaster.mjs (14 cases) still green.',
        'D19.6b — slot-1 speedMult parity (host auth bug). updateGuestSlotMovement and updateOnlineGuestPrediction (script.js ~2905, ~2942) both used bare 165 * GLOBAL_SPEED_LIFT, ignoring slot.upg.speedMult. Now apply Math.min(2.5, slot.upg?.speedMult || 1) — same cap slot 0 uses (script.js:5217). Ghost Velocity now actually moves the guest faster on the authoritative host. Reconciler\'s replay() gained an optional 6th arg speedOverride: when finite and >0, replaces the construction-time speedPerSecond for that one call; null/undefined/0/negative falls back. Caller passes the slot-1 effective speed so a replay window after a Ghost Velocity tier-up uses the correct speed without mutating reconciler state. titanSlow / bloodRushMult / lateBloomMoveMods are slot-0 runtime state and explicitly NOT applied to slot 1 yet — deeper movement parity (sub-stepping, slow modifiers) deferred to a future D19.7 pass.',
        'D19.6c — obstacle-aware reconciler replay. predictionReconciler.replay() gained an optional 7th arg resolveCollision(entity) that, when provided, runs after world-bounds clamp on each replay tick. Caller passes resolveEntityObstacleCollisions, which mutates a reusable scratch {x, y, r} entity in place against the current room\'s obstacles[] (matches the reconciler API). Replay path now respects walls, corners, and slide behavior — collision-free replay was producing impossible correction targets near geometry, which the wedge-flag (actualMag < expectMag * 0.6) was patching over symptomatically. Module stays pure: no callback → bit-identical to previous behavior, all 30 existing reconciler test cases unchanged. Throwing callbacks are caught so a render-side crash can\'t brick replay. Single try/catch; reused scratch object → zero per-tick allocations.',
        'Rubber-duck explicitly rejected three other plausible-sounding fixes: (1) replacing replay-start-tick with snapshotSimTick instead of lastProcessedInputSeq[1] — verified via hostRemoteInputProcessor.js that the ack-tick lag is real and using the snapshot tick would skip unacked input, making things LESS responsive not more; (2) cranking the soft-pull harder — would amplify rubber-banding on legit small drift; (3) grey straight-line local-advance — greys decel meaningfully so naive integration overshoots. Those stay where they are.',
        'Tests: 28 suites green. test-prediction-reconciler.mjs grew from 30 to 43 cases — new coverage for speedOverride (baseline parity, 2× speed travel, 0.5× speed travel, null/0/negative fallback) and resolveCollision (omitted bit-identical, per-tick wall clamp, callback invocation count, diagonal slide with x clamp, throwing-callback survival). Determinism canary 11/11 byte-identical: solo path is untouched (slot 1 doesn\'t exist solo, replay is guest-only, snapshot rate is host-only). Wire schema unchanged.',
      ]
    },
  {
      version: '1.20.70',
      label: 'D19.4/D19.5: ANY-OWNER MUZZLE + PARTNER COSMETIC SYNC',
      summary: ['Two more guest-feel fixes from the post-1.20.69 playtest. D19.4 addresses "bullets come out of thin air" — even with D19.2\'s muzzle prediction, only the guest\'s OWN slot got a spawn cue; host shots, enemy shots, and triangle bursts still appeared at their snapshot-delayed position with zero visual hint, which got worse as enemy variety grew across rooms. D19.5 fixes the "partner picked up a shield boon and I can\'t see it" report — the wire was carrying only a single shieldT timer, never the count or per-shield state, and drawGuestSlots never read shield/orb state at all, so orbiting shield boxes and orb spheres were invisible on the partner\'s screen.'],
      highlights: [
        'D19.4 — any-owner bullet spawn muzzle. New module src/net/bulletSpawnDetector.js: createBulletSpawnDetector({ ttlTicks: 60 }) returns a tracker exposing detectNewSpawns(bullets, simTick) (returns previously-unseen bullet ids), markSeen(id, tick), clear, size. Internal Map<id, lastSeenTick> with TTL eviction so memory is bounded. In script.js, after the snapshot-apply post-processing block (after the grey-decay stamp loop, after D19.1\'s local-advance splice), the detector runs over the final guest-visible bullets[] array. For each newly-appeared id we emit spawnSparks at the bullet\'s authoritative position with a color routed by state and owner: state==="danger" → C.red (always enemy regardless of ownerSlot), state==="grey" → C.ghost (subtle since greys are harvested, not "fired"), ownerSlot===1 → SKIPPED (D19.2 already fired its local muzzle for the guest\'s own shots, avoid double-flash), ownerSlot===0 → coopPartnerColorKey hex (host\'s color on guest screen) || C.green fallback. Pure cosmetic; no collision/state mutation/rollback. Risk: low — if D19.2 misses (charge clock drift) D19.4 won\'t catch the guest\'s own shot, but a missed muzzle is the lesser evil vs double-flash. New test suite test-bullet-spawn-detector.mjs (14 cases — first-sighting, dedup, multi-new, null/missing-id safety, TTL eviction, refresh-prevents-eviction, clear, non-array safety, markSeen suppression).',
        'D19.5 — partner cosmetic sync (shields + orb spheres). Wire schema bump in src/net/coopSnapshot.js encodeSlot: four new uint8 fields per slot — shieldCount (0-8 orbiting shields), shieldHardenedMask (bit i = shield i hardened), shieldCooldownMask (bit i = shield i in regen cooldown), orbCount (0-8 orbit spheres). All default to 0 → backward-compatible with v1.20.69 clients (decoded snapshots from older hosts will see all 0s). Host packing in script.js snapshot broadcaster: reads from bodyOrSlot.shields[i].hardened and .cooldown for the masks, packs orbCount from upg.orbitSphereTier. snapshotApplier.js writes received values onto body.coopShieldCount / coopShieldHardenedMask / coopShieldCooldownMask / coopOrbCount. drawGuestSlots reads those off the partner\'s body and renders the same orbiting shield rectangles (using SHIELD_ORBIT_R and SHIELD_ROTATION_SPD * simNowMs for shared phase; hardened gets C.shieldEnhanced, cooldown drops to 30% alpha) plus orbit spheres in the partner\'s coop color. Determinism: solo path untouched (slot.body.shields undefined → counts default to 0; nothing rendered for slot 0 cosmetics on the host\'s own broadcast since the host already renders its own player path). Per-orb cooldown not synced (host module-level _orbCooldown is slot-0-only) — partner orbs always render full opacity, close enough since orb-fire is rare.',
        'What we deliberately did NOT do: per-shield orbit-phase sync (using shared simNowMs * SHIELD_ROTATION_SPD on both peers naturally aligns the visual unless network drifts > 100ms, which D19.3-style lag-comp won\'t fix anyway), per-orb cooldown sync (not enough perceptual benefit to justify the extra mask field), and partner shield/orb radius bonus (UPG.orbitRadiusBonus, UPG.orbSizeMult) — partner uses base ORBIT_SPHERE_R/5px since "slightly wrong size" is a smaller sin than "completely invisible." All deferred to future versions if playtest finds them noticeable.',
        'Tests: 28 suites green (2 new: test-bullet-spawn-detector.mjs 14 cases, test-snapshot-shield-orb-sync.mjs 6 cases — encode/decode round-trip, default-zero backward compat, multi-slot independence, negative-shieldCount rejection, count-zero-with-mask-bits inert). Determinism canary 11/11 byte-identical. Wire schema is forward-compatible — older clients receiving the new fields will simply ignore them.',
      ]
    },
  {
      version: '1.20.69',
      label: 'D19.2/D19.3: GUEST MUZZLE PREDICTION + HOST GREY LAG-COMP',
      summary: ['Two follow-up tweaks to D19.1\'s bullet local-advance work. D19.2 makes the guest\'s OWN shots feel instant by emitting a cosmetic muzzle flash + directional spark cone the moment the guest\'s local fire-rate clock would have triggered firePlayer on the host — no predicted bullet is spawned (rubber-duck killed that approach: wire schema lacks a spawn-correlation key for multi-shot volleys, and firePlayer mutates charge/overload/shockwave/RNG state that can\'t be cleanly rolled back). D19.3 fixes the "I touched the grey orb but nothing happened" feel by adding host-side lag compensation: the host now buffers each grey bullet\'s last ~6 ticks of position and counts a guest-slot pickup if the body overlaps the orb at EITHER its current position OR its position from ~100ms ago (matching the renderDelayMs window guests render greys through).'],
      highlights: [
        'D19.2 — guest muzzle prediction (cosmetic-only). New helper spawnMuzzleStreak(x, y, ang, col, n=5) in src/systems/particles.js: a directional cone of ~5 particles (±0.16 rad spread, 260 px/s base speed, 6 px forward offset, 120-200 ms life) spurted along the aim angle. In script.js, the existing guest fireT-ring tick loop already detects the wrap edge (next >= interval && hasTarget && isStill) — that branch now also calls spawnSparks + spawnMuzzleStreak when sl.id === 1, gated inside the existing isCoopGuest() block. No bullet is spawned, no state mutated; the real auth bullet still arrives via snapshot+local-advance and visually hands off from the streak. Worst case: phantom muzzle if guest\'s mirrored charge clock briefly disagrees with host\'s authoritative one → small spark with no follow-up bullet for ~RTT — far cheaper than a rollback bug. Slot 0 (host\'s body on guest screen) explicitly NOT predicted; only the local player gets the immediacy boost.',
        'D19.3 — host-side grey-pickup lag compensation. New module src/net/greyLagComp.js: createGreyLagComp({ lagTicks: 6 }) returns a tracker exposing record(bullets, simTick), wasNearHistoric(id, currentTick, bx, by, absR), getHistoric, clear, size. Per-bullet ring buffer (lagTicks + 2 entries), tracks only state==="grey", evicts ids missing from input list, supports configurable lookback. Host instantiates on slot-1 install; tears down with the rest of coop state. In the bullet sim loop, hostGreyLagComp.record() runs once per tick before bullet updates. The slot-1+ pickup check at script.js:5765 was a single Math.hypot(b.x-gb.x, b.y-gb.y) test — now augmented: pickup counts if current overlap OR (no current overlap AND wasNearHistoric returns true at the K-tick-ago position). lagTicks=6 (~100 ms at 60 Hz) lines up with the 70 ms renderDelayMs guests apply to bullet snapshots plus transport jitter. Solo path untouched (hostGreyLagComp stays null without coop slot 1) → determinism canary 11/11 byte-identical.',
        'Why these two and not full bullet/pickup prediction (rubber-duck verdict): full guest player-shot prediction (D19.2 Approach A) would have required (1) a spawn-correlation key on the wire to match predicted-to-auth bullets across multi-shot volleys, (2) rollback-aware state mutation for charge/overload/shockwave/predator/sustained-fire/RNG (firePlayer touches all of these), and (3) bit-identical RNG phase between peers for crit rolls — none of which the current architecture provides. Client-side pickup prediction (D19.3 alternative) hit a different blocker: snapshotApplier.applySlot overwrites slot.metrics.charge every frame, so optimistic charge would need a render-only overlay touching every reader, and reversal-of-pickup is a "trust-breaker" — visually worse than the current ghost-through. Host lag-comp avoids both pitfalls because the host is already authoritative; the only cost is a ~6-entry ring per live grey, which is negligible. Despawn-event protocol deferred — 24 bullets.splice sites in script.js makes that change too invasive for current pain levels.',
        'Tests: 26 suites green (1 new: test-grey-lag-comp.mjs, 11 cases — record/evict/clear/size, historic-overlap detection, current-vs-historic disambiguation, young-bullet returns false to allow current-pos fallback, custom lagTicks honored, ring buffer wraps without losing the K-ticks-ago entry). Determinism canary 11/11 byte-identical. No protocol/wire-schema changes; no boon math touched; solo path identical at the byte level.',
      ]
    },
  {
      version: '1.20.68',
      label: 'D19.1: GUEST BULLET LOCAL-ADVANCE',
      summary: ['Coop guests reported that bullet contact felt "off" — grey orbs would visibly slide through the body without being absorbed, danger hits looked mistimed, and overall the world felt slightly desynced from the predicted character. Root cause: the body is rendered at sim-time-now (predicted forward each tick from input), but EVERY bullet was rendered at sim-time-now-70ms via prev/curr snapshot lerp. Body and bullets lived on different clocks. This phase narrows that gap for the bullet states we can model accurately.'],
      highlights: [
        'New module src/net/bulletLocalAdvance.js: a guest-only stateful pool of bullets keyed by id, advanced every frame with a fixed-timestep accumulator (1/60s ticks, 6-substep cap matching host\'s bullet sub-stepping at ceil(maxTravel/10)). Predictable states: \'output\' (player shots) and \'danger\' (enemy shots). Each step uses the same arena wall-bounce constants as host (M=18 inset, vx/vy reflection on edge contact, radius clamp). \'grey\' bullets, charge orbs, triangle bursts, homing/splitting outputs, gravity-well affected dangers, and obstacle bounces all stay on the legacy snapshot-lerp path — the reconciler\'s thresholds catch any divergence those create.',
        'Reconcile algorithm: once per snapshot SHIFT (snapshotSeq change), each authoritative predictable bullet is aged forward by (simTick - snapshotSimTick) ticks of linear+bounce motion to compare apples-to-apples against the local pool. Hard snap >24px (large drift = obstacle bounce or homing we don\'t model — accept truth instantly). Soft pull when 6-24px (refresh velocity + close 30% of position gap). Leave alone <6px (refresh velocity only, leave position untouched). Despawn fires immediately when a tracked id is missing from the snapshot — no fade-hang, no "I touched it then it disappeared" feel.',
        'Wire-up: in script.js, after guestSnapshotApplier.apply() rebuilds bullets[] with snapshot-lerped entries, the predictable states are stripped and replaced with the local pool\'s per-frame-advanced view. In the guest update branch, advance(dt) runs every frame so bullets travel on the same clock as the body. All code paths gated on guestBulletLocalAdvance being non-null (only constructed when role==="guest"). Solo and host paths byte-identical — determinism canary 11/11. 25 suites green (1 new: test-bullet-local-advance.mjs covers spawn/age/advance/bounce/threshold/despawn/state-filter, 20 cases). Phase 2 (guest-side player-shot prediction) and Phase 3 (predictive pickup, despawn-event protocol) are followups if D19.1 alone doesn\'t fully tighten the feel.',
      ]
    },
  {
      version: '1.20.67',
      label: 'D18.16a: BOTH-DEAD GAMEOVER + IPHONE FADE',
      summary: ['Two playtest bugs from the spectator-on-death system. (1) If the host died first into spectator state, then the guest also died, the run never ended — both ghosts walked around forever with no end-screen. (2) On iPhone Safari, the dead-spectator 30% alpha fade did not actually apply to the body sprite — both the guest viewing themselves and the host viewing the dead guest saw a full-opacity ghost where the desktop correctly showed translucency.'],
      highlights: [
        'Both-dead end-of-run fix: applyContactDamageToGuestSlot and applyDangerDamageToGuestSlot were calling handleSlotDeathInCoop(slot) but throwing away its return value. handleSlotDeathInCoop already returns true when no live coop slots remain (the host slot-0 path correctly fires gameOver from this signal via playerSlot0DiedOrGameOver). The slot-1 paths now mirror that pattern: `if (nextHp <= 0 && handleSlotDeathInCoop(slot)) gameOver()`. With this in place, host-then-guest death sequences now correctly terminate the run and surface the coop end-of-run screen.',
        'iPhone spectator fade fix: the 30% alpha was applied at the call site as ctx.save() → globalAlpha=0.3 → drawGhostSprite() → ctx.restore(). On desktop Chrome this worked. On iOS Safari, the outer globalAlpha sometimes failed to propagate through nested ctx.save/restore + shadowBlur + roundRect operations inside drawGhostSprite, leaving the sprite at full opacity. Fix: drawGhostSprite now accepts a bodyAlpha parameter (default 1) and applies it inside its own save/restore block via globalAlpha *= bodyAlpha. Both render paths (drawGhost for local player, drawGuestSlots for partner) now pass bodyAlpha:0.3 when isSpectator and let the function manage its own canvas state. Determinism canary 11/11; 24 suites pass.',
      ]
    },
  {
      version: '1.20.66',
      label: 'D18.16: GUEST PREDICTION TIGHTENED',
      summary: ['Coop guests reported their character felt "sloppy" / "not locked-in" on their own device, even when network latency to the host was clearly fast (controlling the guest device while watching the host\'s screen showed instant input response — confirming network was fine, render was wrong). Root cause: the prediction reconciler was fighting itself near walls. Three tuning fixes that should make guest movement feel close to host-quality.'],
      highlights: [
        'Wall-wedge no-pull: the reconciler\'s replay path is a collision-free Euler integration (it doesn\'t know about obstacles), but the actual predicted body resolves obstacle collisions every tick. Walking into a wall meant the auth-replay target sat 30+ px past the wall while the body was clamped at the wall edge — and the soft-correction pulled the body INTO the wall every snapshot, where the collision resolver bounced it back. Constant tug-of-war = visible vibration. updateOnlineGuestPrediction now compares actual travel to expected travel; if the body moved less than 60% of what input demanded (i.e. it\'s clamped against geometry), a wedge flag is set and the reconciler skips the soft pull until the next clear tick. Hard snap (>96 px) still fires for genuine large-drift recoveries.',
        'Wider dead-zone: RECONCILE_SOFT_DEAD_ZONE_PX raised from 1.5 to 10. Sub-pixel-to-few-pixel drift between predicted and authoritative is normal noise from input-ack timing (the host samples auth state at simTick T while the guest predicts at simTick T+jitter); pulling against 2-3 px drift produced micro-stutters with no visual benefit. 10 px is invisible to the player but kills constant-correction churn.',
        'Softer pull: RECONCILE_SOFT_FACTOR reduced from 0.35 to 0.18. With ~15 Hz snapshots, the body now closes ~50% of remaining drift in ~3 snapshots (~200 ms) instead of ~80% — slower convergence on real drift, but the per-snapshot pull is half as aggressive so the body slides smoothly toward truth instead of stepping. Determinism canary 11/11 byte-identical (no solo paths touched); 24 test suites pass.',
      ]
    },
  {
      version: '1.20.65',
      label: 'D18.15b: SPECTATOR HP/FROWN/FADE FIXES',
      summary: ['Three playtest bugs on the dead-but-walking spectator from D18.15a. (1) On the guest\'s own device, their character did not fade out when they died — they stayed at full alpha and just strobed. (2) Their HP bar was redrawn full while dead. (3) The frown arc was drawn at almost the same Y as the eyes, reading more like a second pair of squinted eyes than a sad mouth. All three were render-only mistakes; nothing about authority/sim/protocol changed.'],
      highlights: [
        'No-fade fix: the local-player render in drawGhost is gated by an invuln-blink expression (show every other 90ms tick when body.invincible>0). Spectators carry a sticky body.invincible=1e9, so the gate was strobing them at 100% alpha instead of letting drawGhost\'s 30% spectator branch run. The gate now early-outs to "always show" when body.coopSpectating is set, so the translucent render is steady. The host saw the partner correctly because their slot 1 went through drawGuestSlots, which already had the right gate. Local aim-arrow render also short-circuits for spectators.',
        'HP bar fix: drawGhost + drawGuestSlots were passing hpValue = max(1, maxHp) for spectators (a leftover from when I worried hpValue=0 would prevent body draw). drawGhostSprite\'s body sprite never gates on hpValue — only the HP bar uses it. Passing hpValue=0 now correctly draws an empty bar (0-width fill on top of the dark background) while the body itself still renders normally.',
        'Frown position fix: the forceFrown arc center moved from y=size*.08 down to y=size*.45. Eyes sit at y=−size*.25−2 (above center); the old frown was barely below center and visually overlapped the eyes. The new center puts the arc clearly in the lower half of the face so it reads as a mouth. Determinism canary 11/11; 24 suites pass.',
      ]
    },
  {
      version: '1.20.64',
      label: 'D18.15a: SPECTATORS CAN WALK + FROWN',
      summary: ['Playtest correction on D18.15: dead coop partners were stuck frozen in place at the death position. They should be able to walk around like a sad ghost — still translucent, still no firing/damage/targeting, but mobile. Movement is now allowed; the smile-eyes are replaced by a downward frown arc so it\'s clear they\'re dead. The frown is the same arc the gameState===\'dying\' branch already drew, just promoted to a standalone forceFrown flag so we get the expression without the death pop animation.'],
      highlights: [
        'Removed the slot 0 joystick gate and the slot 1 updateGuestSlotMovement gate added in D18.15 — spectators now read the joystick and walk normally. markSlotSpectating no longer sets body.deadAt or zeroes vx/vy, so the legacy guest-predictor halt at body.deadAt!=0 doesn\'t fire and prediction continues smoothly. Damage/fire/targeting still gated: hp=0 + body.invincible=1e9 short-circuits all the existing damage gates without per-site edits, and firePlayer + the slot-1 contact/danger helpers early-out on coopSpectating.',
        'New forceFrown option on drawGhostSprite — when true (and not already in the dying pop animation), the smile-eyes branch is replaced by the same downward frown arc the dying branch draws (arc at 0,size*.08, radius 4.6, π+.25 → 2π−.25). drawGhost (slot 0 local) and drawGuestSlots (partner) both pass forceFrown when body.coopSpectating, so the dead expression travels with the player whether they\'re yours or your partner\'s.',
        'Wire propagation: encodeSlot now serializes a `spectating` boolean (read from body.coopSpectating). The `alive` field becomes wire-true while spectating so the guest predictor doesn\'t halt at body.deadAt and the snapshot applier doesn\'t aliveEdge-anchor the body to a stale "dead" position. snapshotApplier sets body.coopSpectating=snapSlot.spectating each frame so the partner side renders translucent + frowning with no extra hooks. Determinism canary 11/11 byte-identical (no solo paths touched); 24 test suites pass.',
      ]
    },
  {
      version: '1.20.63',
      label: 'D18.15: COOP SPECTATOR-ON-DEATH',
      summary: ['Dying in coop no longer ends the run for both players. When a coop player dies, they become a translucent inert ghost frozen at the death position until the room ends — they can\'t move, fire, take damage, or be targeted, but their corpse stays visible at 30% opacity so the survivor can see where they fell. The survivor continues the room solo. If both players are dead the run ends. On the next room, dead players revive at 25% maxHp (or higher if HP boons were picked between rooms) and rejoin normal play. Solo runs are completely unaffected — death still ends the run immediately.'],
      highlights: [
        'New coop-only spectator state on body.coopSpectating: blocks movement (joystick gated for slot 0; updateGuestSlotMovement zeros vx/vy and continues for slot 1+), blocks fire (firePlayer early-out at top), blocks damage (existing invincible-gates short-circuit on the sticky 1e9 invuln), blocks targeting (getEnemyTargetSlot already filters hp<=0). The slot-1 contact + danger-bullet helpers also early-out on coopSpectating before the legacy hp<=0 path.',
        'Run-end logic: 3 slot-0 gameOver sites (rusher contact, phase-dash hit, direct projectile hit) now route through playerSlot0DiedOrGameOver() which calls handleSlotDeathInCoop. Solo (no activeCoopSession) returns true → gameOver fires identically to before. Coop: marks the slot as spectating and only ends the run when countLiveCoopSlots()===0. Slot 1+ contact/danger helpers route through the same handleSlotDeathInCoop instead of the old respawnGuestSlot insta-full-HP teleport.',
        'Revive: revivePartialHpSpectators() runs at the end of startRoom() — for each spectating slot, hp = max(currentHp, max(1, floor(maxHp * 0.25))) so HP boons picked while dead stack on the 25% floor instead of being clobbered. Clears coopSpectating, grants 2.0s spawn invuln, bumps respawnSeq so the snapshot applier re-anchors guest prediction. Slot 0 also syncs the legacy `hp` global and clears player.deadAt.',
        'Render: drawGuestSlots and drawGhost both wrap drawGhostSprite with ctx.globalAlpha = 0.3 when body.coopSpectating; spectators skip the aim arrow + charge ring overlays. The dead pose is still visible to both players. Determinism canary 11/11 byte-identical (all spectator branches gate on activeCoopSession or coopSpectating which are never set in solo). All 24 test suites pass.',
      ]
    },
  {
      version: '1.20.62',
      label: 'D18.14: COOP HAT HANDSHAKE',
      summary: ['Hat cosmetics now carry over to your coop partner. Before this, drawGuestSlots hardcoded hatKey=null for the partner ghost — your bunny ears were invisible to your friend (and theirs to you), so there was no way to see what they\'d picked. Color was already handshaked via the D18.7 coop-color message; now hat does the same thing through a parallel coop-hat message.'],
      highlights: [
        'New gameplay-channel message kind "coop-hat" carries the local player\'s HAT_OPTIONS key (or "none"). Each peer announces on slot install, on every hat change via setPlayerHat, and reciprocally echoes when it receives a partner\'s announce without having sent its own (handles late-join races).',
        'drawGuestSlots now reads coopPartnerHatKey instead of passing null, so partner hats render in real-time alongside their already-handshaked color scheme. Inbound payload is validated against HAT_OPTIONS so a malformed message can\'t crash the renderer.',
        'Partner hat state is reset by teardownCoopRunFully so the next coop run re-handshakes cleanly. Determinism canary 11/11; coop-only message kind never reaches solo or host-canary paths.',
      ]
    },
  {
      version: '1.20.61',
      label: 'D18.13: GUEST ROOM-CLEAR OVERLAY + CHARGE LERP JUMP-SNAP',
      summary: ['Two coop guest-side fixes from playtest: (1) the guest never saw the "ROOM CLEAR" or "BOSS DEFEATED" overlay between rooms — only the host did. The host calls showRoomClear() / showBossDefeated() inside its update path (skipped on guest), and the guest\'s snapshot mirror code only synced the room INTRO overlay. (2) The new D18.12 charge lerp blindly interpolated through any prev→curr delta, including discontinuities like room resets and boon-applied charge bumps — playtest reported "weird glitchyness" on the charge ring during the ready/go and end-of-room transitions, which was the lerp showing a fake ramp between two unrelated charge values.'],
      highlights: [
        'Guest snapshot mirror now triggers showRoomClear() (or showBossDefeated() for boss-room indices 9/19/29/39+ via the BOSS_ROOMS map) on the prevRoomPhase!=="clear" → "clear" edge. Same wrapper functions the host uses, just driven from the snapshot transition instead of the host\'s finalizeRoomClearState.',
        'Charge lerp now snaps to curr on big jumps: when |curr - prev| > 50% of maxCharge in a single snapshot, treat it as a discontinuity (room reset, fire-drop on a small maxCharge, boon applied) and skip the lerp. Normal smooth fills (< half maxCharge per snapshot) still lerp at 60Hz visible. Eliminates the visible "ramp through unrelated values" glitch on the charge ring during room transitions.',
        'Determinism canary 11/11; both fixes are coop-guest-only (host/solo paths never enter snapshot applier or guest-mirror branches).',
      ]
    },
  {
      version: '1.20.60',
      label: 'D18.12b: GUEST FIRE-RING MATCHES SOLO PLAYER\'S SLOW-FILL',
      summary: ['Follow-up to D18.12: the partner\'s fire-ready ring on the guest device was capping at the SPS interval the moment the partner started moving, instead of slowly continuing to fill like the solo player\'s own ring does. Solo advances fireT at dt * mobileChargeRate (~10%) while moving — the ring keeps creeping up gradually until you stop. D18.12\'s gating used full dt and an immediate cap, so the ring on guest looked too eager.'],
      highlights: [
        'Guest cosmetic fireT ticker now uses the solo formula verbatim: const mobileChargeMult = isStill ? 1.0 : (slot.upg.mobileChargeRate || 0.10); next = prev + dt * mobileChargeMult; cap at interval while moving; modulo-wrap only when still + has-target. Partner\'s ring now fills at the same gentle pace the solo player\'s own ring fills while running.',
        'Determinism canary 11/11; all coop logic still gated on activeCoopSession.',
      ]
    },
  {
      version: '1.20.59',
      label: 'D18.12: GUEST CHARGE LERP + GUEST REROLLS + RING PARITY',
      summary: ['Three guest-side parity issues from playtest: (1) the charge ring on the guest\'s screen ticked up in visible 15Hz steps instead of filling smoothly, making the SPS pacing feel "off" compared to the host\'s smooth ring. (2) The guest\'s boon picker had no Reroll button at all — only the host could reroll their three options. (3) The host\'s fire-ready ring on the guest\'s screen kept cycling even when the host was clearly moving (host wouldn\'t actually be firing in that state).'],
      highlights: [
        'Snapshot applier now lerps slot.metrics.charge between the previous and current snapshot frame using the same alpha that already drives body x/y/vx/vy. Previously charge was snapped to the latest snapshot value at ~15Hz, producing a stair-step charge ring on the guest device. With lerp the ring fills at render rate (60Hz visible) and matches the host\'s perceived pace. Solo/host paths never hit the applier (null in solo / canary), so determinism is unaffected.',
        'Guest now gets a working Reroll button on the boon picker (1 reroll per fresh coop run, mirroring host\'s starting count). showBoonSelection accepts an onReroll callback that returns a new boon array even when boonsOverride is set — guest\'s callback regenerates a fresh slot1-safe pool locally (same getSlot1SafeBoonPool the host uses to seed slot1BoonIds, just shuffled on the guest device). Final pick still ships via coop-boon-pick so host applies the chosen boon to slot 1\'s authoritative UPG.',
        'Guest\'s local fireT cosmetic ticker now matches host\'s fire logic exactly: fireT advances every frame, but is CAPPED at the SPS interval when isStill=false (slot has nonzero velocity in the latest snapshot) or when noSignal=true (aim.hasTarget=false). Modulo wrap only happens when both still and signal — i.e. when the host would actually be firing. Previously the ring cycled unconditionally whenever charge was full, including while the host was sprinting around. Now the partner ring only "ticks" when the partner is actually shooting.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (charge lerp and fireT gating only run inside the snapshot applier and guest cosmetic ticker — both no-ops on solo/host, both gated on activeCoopSession via the existing applier-null short-circuit).',
      ]
    },
  {
      version: '1.20.58',
      label: 'D18.11: COOP DISCONNECT RESILIENCE (SOFT PAUSE + HARD TIMEOUT)',
      summary: ['Playtest on iPhone: when the guest device suspended the app (home button / lock), the run entered a broken half-state. The guest woke up stuck on a "WAITING FOR HOST" overlay forever; the host kept playing solo and even pushed past room boundaries oblivious to the guest being gone. There was no host-side disconnect detection at all (slot 1\'s remote-input adapter just produced inactive frames when the ring was empty), and the guest\'s 30s watchdog was gated off during boon-phase so a suspend during pick was unrecoverable. Both peers now share a symmetric liveness monitor with quick soft-pause feedback and authoritative hard-timeout teardown.'],
      highlights: [
        'New coop heartbeat: every 2.5s while a coop run is active, both peers send {kind:"coop-heartbeat"} and stamp coopLastInboundAtMs on every inbound packet (any kind — heartbeat, input, snapshot, boon-pick, color, etc.). This decouples liveness from gameplay activity, so a slow boon picker no longer false-trips the watchdog and a suspended peer is detected within seconds even when no input/snapshot would normally be flowing.',
        'Soft-disconnect gate (7s of silence): freezes sim stepping and snapshot broadcasts on host, freezes guest prediction, and shows "PARTNER DISCONNECTED · waiting for reconnect…" overlay. RAF stays alive (rubber-duck blocking issue #2) so recovery + the hard-timeout check keep running. Any inbound packet — heartbeat counts — clears the soft state and resumes the sim with simAccumulatorMs reset to 0 so we don\'t fire a catch-up burst that would jump entities and break guest reconciliation.',
        'Hard-disconnect gate (30s of silence): trips unified teardown via the existing tripCoopDisconnectWatchdog path — cancels RAF, runs teardownCoopRunFully, returns to the start screen with a "CONNECTION LOST" banner. Symmetric on both peers. Runs from BOTH the main-loop gate (covers playing/dying gstate) AND a separate setInterval inside the heartbeat tick (covers boon-phase / upgrade gstate where RAF is cancelled by design — this was the exact case where the iPhone "stuck on WAITING FOR HOST" bug originated).',
        'visibilitychange + pagehide listeners send a best-effort {kind:"coop-bye"} beacon when the local tab goes away (rubber-duck blocking issue #3 — beacon is an accelerator only, never load-bearing). Partner receives it, immediately enters soft-disconnect by rewinding their coopLastInboundAtMs past the soft threshold rather than waiting 7s. On pageshow / visible: if we were hidden longer than the hard timeout, trip teardown immediately so the user doesn\'t race the watchdog from a stale resumed tab.',
        'Determinism canary 11/11 byte-identical: all new logic is gated on activeCoopSession (null in solo / canary), liveness ticking only happens with a live transport, and the new wall-clock branches never mutate sim state outside coop runs. All 24 suites green; the change is purely additive coop-only resilience.',
      ]
    },
  {
      version: '1.20.57',
      label: 'D18.10b: PC END-SCREEN LAYOUT + RING CYCLING + BULLET COLOR',
      summary: ['Three playtest follow-ups from D18.10: (1) bullets fired by the partner rendered in the LOCAL player\'s color instead of the partner\'s — both peers saw all bullets in their own palette. (2) The host\'s fire-ready ring on the GUEST device showed a permanent full fill instead of cycling with SPS — guest had no visual cue when the host was about to shoot. (3) The PC coop end screen had the in-run top HUD (ROOM N, PAUSE, score, STORED CHARGE, SPS) painting on top of the breakdown rows in the middle of the panel; iPhone was clean. Desktop was unusable.'],
      highlights: [
        'showCoopGameOverScreen no longer calls setMenuChromeVisible(true). On non-compact (desktop) viewports, that call activated CSS rules that hid #cv and collapsed #wrap to top-hud height, leaving .screen (inset:0 of #wrap) bound to a tiny area while content overflowed downward. Solo\'s showGameOverScreen has never called setMenuChromeVisible — it overlays the screen on top of the live in-game layout. Coop now matches.',
        'Guest\'s local fireT ticker (used to drive the partner\'s fire-ready ring on the guest screen) now wraps modulo the SPS interval (1 / (sps * 2)) instead of accumulating dt unbounded. Previously, when chargeFrac >= 1 the ticker grew forever and fireProgress saturated at 1 — ring stayed full. Now it cycles: filling, firing, refilling, exactly like the host renders it.',
        'drawBulletSprite gained an optional getOwnerColorScheme dep that resolves the bullet\'s ownerId to a color scheme when the bullet was fired by the remote partner (in coop). Local-owned bullets and solo/host paths default to the existing C.green/C.ghost palette — byte-identical to before. Partner bullets now render in the partner\'s chosen color (matching the body, ring, and aim arrow per D18.7/D18.9).',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (deps default null preserves the C.green/C.ghost path exactly for solo + host slot 0 sim).',
      ]
    },
  {
      version: '1.20.56',
      label: 'D18.10: COOP END-SCREEN BREAKDOWN PARITY',
      summary: ['Playtest screenshots showed the coop end screen looked very different from the solo end screen on the GUEST side: no score breakdown rows, no "X kills · Room N · M:SS" footer. D18.8 had already extended the coop-game-over packet to include breakdown/stats/boonIds and wired renderScoreBreakdown into #s-go-coop, but a guest-side bug in gameOver() was wiping the host-supplied payload before the screen could render it.'],
      highlights: [
        'gameOver() previously called coopGameOverPayload = buildCoopGameOverPayload() unconditionally on both peers. On guest, buildCoopGameOverPayload() builds from local state (scoreBreakdown is empty, kills is 0 — guest doesn\'t run the authoritative sim) so it overwrote the host\'s authoritative breakdown that had been stashed by handleCoopGameOverPacket moments earlier. Guard now: rebuild only when the local peer is host, or as a fallback if no host packet has arrived yet.',
        'handleCoopGameOverPacket also re-renders the end screen if it\'s already visible. Race protection: if the guest\'s local game-over (triggered by its own slot dying) ran before the host\'s coop-game-over packet landed, the screen used to stay blank-breakdown forever; now the late packet refreshes it with the authoritative data.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (changes are guest-side UI plumbing — host sim path untouched).',
      ]
    },
  {
      version: '1.20.55',
      label: 'D18.9: PARTNER AIM RETICLE USES PARTNER COLOR',
      summary: ['Playtest gap from the D18.7 color-sync work: drawGuestSlots was already passing the partner\'s colorScheme to drawGhostSprite (so the body, glow, charge ring, and HP bar render in the partner\'s color), but the aim reticle triangle drawn just below the sprite still hardcoded C.getRgba(C.green, 0.6) — the LOCAL player\'s color. Result: host saw the guest body in the guest\'s color but the guest\'s aim arrow in the host\'s color (and vice versa). The arrow should match the slot it belongs to.'],
      highlights: [
        'drawGuestSlots aim-arrow fillStyle now resolves the partner\'s hex via getColorSchemeForKey(coopPartnerColorKey) and falls back to C.green when the coop-color handshake hasn\'t landed yet (or in COOP_DEBUG split-screen where there\'s no remote partner). Local player\'s own aim arrow (drawn by the host slot-0 path) is unchanged — uses C.green which is already the local player\'s color.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (render-only change, partner color path is online-coop only).',
      ]
    },
  {
      version: '1.20.54',
      label: 'D18.8: COOP END-SCREEN PARITY + WAITING-FOR-PARTNER OVERLAY',
      summary: ['Two playtest gaps: (1) the coop end-of-run panel (#s-go-coop) had only score + roster + room number — no breakdown, no "Run Boons" review, no Leaderboards button — making it feel sparse compared to the solo end panel. Players wanted feature parity with the solo s-go screen. (2) Between boon picks, when the host picked a boon before the guest, the host\'s screen reverted to a frozen frame with no "WAITING FOR PARTNER…" indicator — the wait overlay was guest-only. The guest already showed an overlay when waiting on host, but host saw nothing.'],
      highlights: [
        'Coop end screen now matches solo: added go-coop-breakdown (uses the same renderScoreBreakdown helper as solo, exported from src/ui/gameOver.js), go-coop-note (kept blank by default — empty:hidden via CSS), Run Boons button + go-coop-boons-panel that renders the LOCAL player\'s loadout (host shows slot 0 / global UPG; guest shows slot 1\'s independent UPG per D14.1), and Leaderboards button (btn-lb-open-go-coop wired through the existing bindLeaderboardControls). Host/guest roster cards + Rematch + Leave buttons preserved.',
        'coop-game-over packet extended with breakdown + stats + boonIds so guest mirrors the same breakdown rows + kill/room/duration footer that the host sees. Guest\'s own scoreBreakdown is empty (it doesn\'t sim) — without this, the breakdown panel was always blank on guest\'s end screen.',
        'CSS: #go-score, #go-sub, #go-note, #go-boons-panel, #go-boons-list rules generalized to also match the coop variants (#go-coop-score, #go-coop-sub, #go-coop-note, #go-coop-boons-panel, #go-coop-boons-list). No new selectors fork; visual parity is enforced at the stylesheet level.',
        'Boon-pick wait overlay is now symmetric: when host picks first and guest hasn\'t responded yet, host sees "WAITING FOR PARTNER…" instead of a frozen frame. tryResumeCoopBoonPhase clears the overlay before resumePlayAfterBoons fires; existing handleCoopRoomAdvanceGuest + teardownCoopRunFully paths already clear it on guest. AFK auto-resolve still fires on the existing 30s timer.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (changes are end-screen UI + coop-only overlay logic — no sim-path mutations).',
      ]
    },
  {
      version: '1.20.53',
      label: 'D18.7: GUEST MOVEMENT RESTORE + PARTNER COLOR SYNC',
      summary: ['Two playtest regressions: (1) v1.20.52\'s D18.6 cosmetic-tick refactor accidentally removed the updateOnlineGuestPrediction(dt) call from the guest update gate, so the guest body stopped moving at all on its own screen — only host snapshots could move it (and they only re-anchor on death/respawn, not continuously). (2) Player color choice never crossed the network: each peer rendered both ghosts in its own locally-chosen palette, so the host saw the guest as the host\'s color and vice versa — the user picked pink as host, guest saw the host as the guest\'s color, host saw the guest as pink. Backwards from the intent.'],
      highlights: [
        'Restored updateOnlineGuestPrediction(dt) inside the guest update gate, immediately before the new D18.6 cosmetic-tick block. Prediction runs first (so the joystick adapter advances the local body this frame), then cosmetics decay, then the early-return. Solo / host paths untouched.',
        'New coop-color gameplay message: each peer broadcasts its colorKey on slot install (host on slot 1 install, guest on slot 1 install) and on every local color change via the existing phantom:player-color-change event hook. Receiver stores it on coopPartnerColorKey + auto-echoes back its own key on first receive so a late slot-install doesn\'t miss the handshake. Cleared by teardownCoopRunFully so a new coop run re-handshakes from scratch.',
        'drawGhostSprite gained an optional `colorScheme: { hex, light, dark }` parameter. When passed, all reads that previously hit the global C palette (C.green, C.ghost, C.greenRgb, C.ghostBodyRgb, C.getRgba(C.green,...)) use the override instead — body fill, ghost glow, charge-ring color, eye shimmer, HP-bar color. When omitted (solo / local player), reads from C exactly as before — byte-identical canary preserved.',
        'drawGuestSlots now passes getColorSchemeForKey(coopPartnerColorKey) to drawGhostSprite for the partner ghost. Falls back to null (= legacy C reads) until the handshake completes, so the very first frames after coop start still render something rather than blanking out. Local player\'s drawGhost is unchanged: its own ghost still uses the local C palette which is already the player\'s chosen color.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (color override defaults to null; render math falls through to existing C reads on the solo/canary path).',
      ]
    },
  {
      version: '1.20.52',
      label: 'D18.6: GUEST COSMETIC TICK + CHARGE RING + ORB FADE + AFK 30S RANDOM + WATCHDOG GATING',
      summary: ['Playtester report bundle on the online-coop guest: (1) charge rings around either player never animated on the guest screen even at full charge; (2) collected grey orbs sat at full alpha and never faded out; (3) when the guest was hit by a projectile the bullet + damage number froze in place at the hit location forever; (4) sitting on the boon picker for ~30s booted everyone with a "disconnected" message even when the network was fine. Root causes were a single shared theme: the guest\'s update() early-returns and never ticks particles/dmgNumbers/shockwaves/payloadCooldownMs, the snapshot wire format intentionally omits cosmetic-only fields (fireT, decayStart) which the guest then never re-derived locally, and the disconnect watchdog ticked unconditionally even when the host had legitimately stopped emitting snapshots during the boon picker.'],
      highlights: [
        'Guest cosmetic tick: particles, dmgNumbers, shockwaves, and payloadCooldownMs are now ticked on the guest before its update() early-return — math is byte-identical to the host\'s tick block lower in update(). Result: damage numbers float up and fade, hit sparks dissipate, and bullets no longer freeze at the hit location on the guest screen.',
        'Charge ring animation on guest: the snapshot intentionally omits slot.metrics.fireT (cosmetic-only), so the firing-ring on both slots used to render empty even when fully charged. The guest now ticks fireT locally per slot when its charge is at max, resetting to 0 when charge drops below max. Both the local guest\'s ring (drawGhost) and the partner ring (drawGuestSlots) animate again.',
        'Grey orb fade on guest: snapshots also omit bullet.decayStart. Without it the bullet renderer\'s age math collapses to NaN and the orbs stay at full alpha. Added a guest-only Map<bulletId, simNowMs> that stamps decayStart on first sight of a grey bullet and removes the entry on state transitions or bullet-removal so the map can\'t grow unbounded. Re-stamps if a bullet ever re-enters grey.',
        'Boon AFK auto-resolve is now 30s (was 60s) and picks RANDOMLY from slot 1\'s offered ids (was deterministic [0]). True-disconnect detection is reserved for the watchdog; an inattentive player just gets a random boon and the run continues.',
        'Watchdog timeout 4s → 30s + boon-phase gating: COOP_WATCHDOG_TIMEOUT_MS bumped to 30000 because the previous 4s threshold was too aggressive for any real-world transient stall. More importantly, the watchdog now skips entirely while the boon-phase / upgrade gstate is active, since the host intentionally cancels its RAF and stops emitting snapshots between rooms — that pause is no longer mistaken for a dropped transport.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (all changes are guest-render-only or coop-only constants — no sim-path mutations).',
      ]
    },
  {
      version: '1.20.51',
      label: 'D18.4: DESKTOP CANVAS PINNED TO PHONE WIDTH',
      summary: ['Playtester report: in solo and coop, the PC canvas was visibly wider left-to-right than the phone canvas, making the arena feel "drastically oversized" relative to the phone reference. Cause: the resize() cap was 380→400 wider than typical phone viewports — most phones hit the `viewportWidth - 16` rail (~374-380) while desktops always hit the 400 rail. World size scales with canvas, so the arena itself was larger on PC.'],
      highlights: [
        'Lowered canvas width cap from 400 to 380 in both script.js resize() and styles.css #wrap rule. iPhone 14 Pro Max-class devices (430 CSS px) and desktops now both render at 380 CSS px wide; smaller phones (≤396 CSS px) are unaffected because they hit the `viewportWidth - 16` cap first.',
        'Net effect: desktop canvas is now within ~3 CSS px of typical phone canvas — visually identical. World dimensions match across devices, so entity placement, spawn coords, and HUD spacing render the same regardless of form factor.',
        'Tests: all 24 suites green; determinism canary 11/11 (world size is canvas-derived but the resize() cap is a render-only ceiling, not a sim parameter).',
      ]
    },
  {
      version: '1.20.50',
      label: 'D18.3: COOP UNIFIED TEARDOWN + DISCONNECT WATCHDOG',
      summary: ['Bug class: when a coop run ended abnormally (transport silently dropped, host backgrounded, render error), the guest sat frozen with no signal — and the runtime\'s listeners + timers (snapshot applier, input uplink, rematch session, AFK boon timer) lingered as zombies. Tapping "Main Menu" then trying to start a fresh solo run wedged the start screen because those zombies fought the new run for control of playerSlots[1] and activeCoopSession. The user had to restart the app to recover.'],
      highlights: [
        'Added teardownCoopRunFully(reason) — one always-call function that disposes rematch listener+session, calls teardownCoopInputUplink (applier/broadcaster/slot 1/world pin/wait overlay), clears coopBoonAfkTimer + currentBoonPhaseId + pendingCoopBoonPicks + coopBoonPickBuffer, calls clearCoopRun(), and resets the watchdog. Idempotent — every step is null-guarded so double-calls are safe.',
        'Disconnect watchdog (guest-only): tracks latestRemoteSnapshotRecvAtMs (already populated by the snapshot ingest path). In the RAF loop, if frameStartTs - latestRemoteSnapshotRecvAtMs > 4000ms AND we\'ve received at least one snapshot, fires once: shows a "CONNECTION LOST · returning to menu" overlay, then after a 1.2s read delay cancels RAF, runs unified teardown, and returns the user to the start screen with menu chrome restored (s-start visible, s-up/s-go/s-go-coop/s-coop-lobby hidden, pause button hidden, patch-notes button visible).',
        'Wired exit-to-menu through unified teardown: pauseController accepts a new optional onExitToMenu callback; script.js wires it to teardownCoopRunFully(\'pause-exit-to-menu\'). Now an in-coop pause→Main Menu always cleans up before showing the menu.',
        'Refactored leaveCoopGame to call teardownCoopRunFully instead of the previous disposeCoopRematchSession + clearCoopRun pair, picking up AFK-timer + boon-phase + watchdog cleanup that the old path missed.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (no sim-path changes).',
      ]
    },
  {
      version: '1.20.49',
      label: 'D18.2: GUEST LOCAL-SLOT AIM TRIANGLE + INVULN BLINK FROM LOCAL DATA',
      summary: ['Bug: on the online guest, the player blink, payload-ring indicator, and aim triangle were all sourced from slot-0 globals (player.x/y, player.invincible, playerAimAngle, playerAimHasTarget). On a guest, slot 0 is the HOST, so the guest saw the host\'s aim arrow anchored to the host\'s body — never their own. The body blink was also gated on the host\'s invuln, so it would flicker when the host was hit instead of when the guest was hit.'],
      highlights: [
        'Refactored the player-render block in draw() to source position, UPG, aim, and invuln from getLocalRenderSlot() instead of slot-0 globals. Solo/host paths are unchanged: slot 0 bridges to the legacy globals via getters/setters, so the determinism canary remains byte-identical (verified 11/11 + all 24 suites green).',
        'Guest now sees their own aim triangle anchored to their own body, using their own slot.aim.angle/hasTarget (already wired via D13.4 snapshot fields), and blinks based on their own invincibility timer.',
        'Payload-ring indicator now uses the local slot\'s body/UPG with a graceful fallback to the global payloadCooldownMs when slot.metrics doesn\'t track it (host slot 0 keeps the global path → byte-identical).',
        'Foundation for the rest of D18 (HUD parity for charge ring, hp bar, etc.) — same routing pattern can be applied as needed.',
        'Tests: all 24 suites green; determinism canary 11/11.',
      ]
    },
  {
      version: '1.20.48',
      label: 'D18.5: PAUSE-FROM-BOON MENU EXIT + BUTTON-STATE LEAK FIX',
      summary: ['Bug: pausing during the upgrade/boon-pick screen and clicking "Main Menu" appeared to do nothing — the s-up boon picker stayed visible over the start screen. Then any subsequent boon click reanimated the in-run UI: pause button replaced the patch-notes button on the menu and the RAF sim restarted behind the chrome.'],
      highlights: [
        'pauseController.exitToMenu now also hides the s-up boon picker before showing s-start, so the user immediately sees the menu instead of an overlaid picker.',
        'resumePlayAfterBoons short-circuits when gstate is "start" or "gameover" — clears coop boon-phase state + AFK timer + s-up panel, then returns without flipping pause-button visibility or restarting the loop. Prevents stale boon clicks (e.g. the user picked a boon after exitToMenu fired) from leaking in-run UI into the menu.',
        'D18 plan document added in session workspace covering 5 active playtest issues: D18.1 guest hit-freeze, D18.2 guest local-slot HUD parity (charge ring + aim triangle), D18.3 unified coop teardown + disconnect watchdog, D18.4 desktop sizing matches phone exactly, D18.5 (this).',
        'Tests: all suites green; determinism canary 11/11.',
      ]
    },
  {
      version: '1.20.47',
      label: 'COOP PHASE D15: DEDICATED END-OF-RUN SCREEN + REMATCH',
      summary: ['Co-op runs were ending on the solo game-over panel, which had no path back into another co-op run together — players had to leave to the lobby and re-pair every time. D15 swaps in a dedicated coop end screen with both runners\' names, the team score, REMATCH (loop straight back into another run on the same lobby) and LEAVE.'],
      highlights: [
        'New screen #s-go-coop with HOST/GUEST roster cards (large name tags), team score, and "Room N reached" meta line. The solo s-go panel is bypassed entirely when coopRematchSession + coopRematchRole are set, so coop runs never see the wrong end UI.',
        'Session preservation: gameOver() now captures activeCoopSession into coopRematchSession BEFORE clearCoopRun + teardownCoopInputUplink fire. After teardown, a separate listener (installCoopRematchListener) is installed on the same session for coop-rematch / coop-leave / coop-rematch-request packets — the realtime channel survives the run-over so peers can talk.',
        'coop-game-over packet extended with hostName/guestName so both peers render the same roster regardless of whether they triggered the death. Guest mirrors score + roomIndex from host\'s payload (already did) plus now the names into coopGameOverPayload.',
        'REMATCH (host): generates a fresh seed, broadcasts coop-rematch { seed }, re-arms the pending coop run with the SAME session+role+code, then runs init() + restarts the loop. installCoopInputUplink internally tears down + re-installs on the same session, so the transport channel is reused.',
        'REMATCH (guest): button reads "Request Rematch" → sends coop-rematch-request to host. Host auto-accepts in v1 (no confirmation prompt), broadcasts coop-rematch with a new seed; both peers call startCoopRematchRun in parallel. Guest\'s button shows "Waiting for host…" until the rematch packet arrives.',
        'LEAVE: broadcasts coop-leave so partner sees "Partner left the run." status, then clearCoopRun + dispose rematch session refs and return to the start screen. Partner\'s rematch button disables on receipt.',
        'Name input on the coop end screen wired to setPlayerName(syncInputs:true) so changes propagate to all name inputs (start screen, solo go screen) and persist to localStorage.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical. D15 is purely a presentation + transport layer change — no sim/seed paths touched.',
        'Known limitations (v1): host pulls all rematch authority (seed gen + start). No version handshake on rematch yet — if the host reloads to a newer build mid-pair, mismatch detection is deferred to a later coop-handshake phase. Score split per peer is still unified team score; per-slot leaderboard is a separate D17 task.',
      ]
    },
  {
      version: '1.20.46',
      label: 'COOP PHASE D14: PER-PEER BOON PICKS (SLOT-1 SAFE WHITELIST)',
      summary: ['Until now coop ran a "team boons" model: only the host saw a picker, and slot 1 inherited host\'s UPG via mirrorHostUpgToSlot1 on every room transition. Players asked for guests to pick their own boons. D14 splits picks per-peer: host picks for slot 0 from the full pool; guest picks for slot 1 from a curated whitelist of boons that work correctly when applied in isolation to a single slot.'],
      highlights: [
        'D14.1 Per-peer UPG: removed the per-room mirrorHostUpgToSlot1 call from resumePlayAfterBoons. Slot 1 now evolves its own UPG independently. Initial state still matches across peers because both installOnlineCoopHostSlot1 and installOnlineCoopGuestSlot1 seed slot 1 with getDefaultUpgrades() at session start.',
        'D14.2 Boon-pick handshake: host enters phase → broadcasts coop-boon-start { roomIndex, phaseId, slot1BoonIds: [int,int,int] } where boonIds are stable indices into the BOONS array (names are unsafe — `Gravity Well` is duplicated). Each peer renders its own picker, sends coop-boon-pick { phaseId, slotId, boonId }. Both peers apply both picks locally so slot 0 and slot 1 UPGs stay mirrored; host gates resumePlayAfterBoons until both flags are set. Out-of-order picks arriving before coop-boon-start are buffered by phaseId and drained on phase entry. Stale picks (phaseId < current) are dropped.',
        'D14.3 Slot-1 safe whitelist (v1): only 22 boons are eligible for slot 1 — those that purely mutate slot.upg fields consumed by firePlayer / collisions / charge math (Rapid Fire, Ring Blast, Backshot, Snipe Shot, Twin Lance, Bigger Bullets, Faster Bullets, Critical Hit, Ricochet, Homing, Pierce, Quick Harvest, Decay Extension, Capacity Boost, Deep Reserve, Wider Absorb, Long Reach, Kinetic Harvest, Steady Aim, Ghost Velocity, Extra Life, plus Heal). Boons that hook globals (shields, room-regen, gravity-well, mirror-tide, blood-pact, EMP, predator, etc.) are excluded for slot 1 in v1 — a per-slot boon-hook refactor is deferred to a future phase. Slot 1 cannot pick legendaries v1.',
        'AFK timeout: 60s host-side timer auto-resolves slot 1 to slot1BoonIds[0] if guest doesn\'t pick (e.g. backgrounded the tab), then synthesizes a coop-boon-pick echo so guest\'s slot1.upg stays in sync when they return. Host legendary picks send a sentinel coop-boon-pick { slotId:0, boonId:-1 } so guest knows host completed without needing to mirror anything.',
        'Guest sim freeze: handleCoopBoonStartGuest now sets gstate=\'upgrade\' and cancels the RAF loop while the picker is open, mirroring host pause behavior. handleCoopRoomAdvanceGuest restores the loop. Without this, the predicted body kept moving while the picker was open and would snap on close.',
        'boonSelection.js: added boonsOverride param. When supplied as a non-empty array it bypasses pickBoonChoices (which uses simRng — host/guest can drift) and the reroll handler is hard-disabled. Solo and offline coop are unchanged.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical. No new test was needed — the existing test-coop-boon-queue covers the COOP_DEBUG queue path (untouched), and the new wire format is exercised at runtime. Future test-coverage opportunity: end-to-end host+guest simulator that exchanges the new packets.',
        'Known limitations (v1): excluded boons require deeper sim work to be slot-1 safe; no slot-1 legendaries; AFK auto-pick uses first option deterministically. These are tracked for a future D14b/D17 refactor pass.',
      ]
    },
  {
      version: '1.20.45',
      label: 'COOP PHASE D13: GUEST GAMEPLAY PARITY (RESPAWN, ORB PICKUP, HURT ANIM, AIM ARROW)',
      summary: ['After D12.4 sync was solid, but the guest still felt like a passenger. D13 closes four parity gaps in one pass: (1) on death the guest\'s predicted body never re-anchored to spawn because hp returns to max in the same host tick the slot dies — the alive flag never flips false in any serialized snapshot. (2) Slot 1 walked through grey/charge orbs without picking them up — the absorb scan only ran for slot 0. (3) The guest never saw a hurt-animation wobble or damage number on its own slot 1 because host-side distort/dmg# were local-only. (4) The guest had no aim-arrow triangle, only the host did.'],
      highlights: [
        'D13.1 Respawn anchor: bodies now carry a respawnSeq counter, incremented in respawnGuestSlot and propagated via the snapshot wire (new optional respawnSeq field, defaults to 0). snapshotApplier treats any seq change as a force-anchor trigger alongside aliveEdge and roomChanged, so the guest\'s predicted slot 1 teleports to spawn on death even when the death+respawn collapses into one host tick.',
        'D13.2 Slot-1+ grey orb absorb: added a per-slot absorb branch after the slot-0 grey path. Iterates ascending slot id (deterministic), uses per-slot absorbRange (slot.body.r + 5 + slot.upg.absorbRange), clamps to slot.upg.maxCharge so the ring never overflows, and explicitly does NOT inherit slot-0 host-only timer state (no _barrierPulse / _chainMagnet bonuses) so slot 0\'s deterministic boon timeline stays untouched. Determinism canary unaffected.',
        'D13.3 Hurt animation: snapshot now carries body.distort. The applier writes it onto the predicted body each frame so the ghost renderer\'s wobble effect plays on the guest\'s screen for slot 1\'s hits. Added invuln-blink in drawGuestSlots (every 90ms tick while invincible > 0) matching host slot-0 behavior. snapshotApplier also exposes an onSlotDamage callback that fires once per fresh snapshot (gated on shift, not on every render frame) when a slot\'s hp drops vs. previous; the script wires it to spawnDmgNumber + sparks in player color, so guests now see local damage feedback. Lethal hits remain a known limitation: hp goes maxHp→max same tick, so neither distort nor the dmg number renders for the killing blow — accepted for D13.',
        'D13.4 Guest aim arrow: snapshot gained a hasTarget bool; drawGuestSlots replicates the host\'s aim-triangle render (script.js:4759) for each guest slot using slot.aim.angle and the per-slot body radius. Triangle is hidden when hasTarget is false (no enemies to lock on) and during invuln-blink off-frames so it doesn\'t stutter through the blink effect.',
        'Tests: all 23 suites green; determinism canary 11/11 byte-identical. New optional snapshot fields default safely (?? 0 / !!) so existing test-coop-snapshot fixtures pass without modification. No regressions in solo (no slot 1 exists, all new code paths early-out on playerSlots.length <= 1).',
      ]
    },
  {
      version: '1.20.44',
      label: 'COOP PHASE D16.1: UNIFIED ARENA ASPECT (PC + MOBILE)',
      summary: ['Playtest screenshots showed the PC and iPhone clients rendering wildly different play areas in BOTH solo and coop. The iPhone got the intended tall portrait arena (1.78×W height) while PC was capped at 1.34×W height. Because entity spawn coordinates (busters at top/bottom corners, obstacle layouts, room intro placement) are calibrated to the tall portrait world, on PC the top busters were getting clipped off-screen and the bottom row was bunched against the canvas edge. This shipped as a coop fix but applies to solo too.'],
      highlights: [
        'resize(): collapsed BASE_ARENA_ASPECT (1.18) and maxArenaAspect (phone 1.78 / desktop 1.34) into a single ARENA_ASPECT = 1.78 used everywhere. Every device now sees the same tall portrait arena; on shorter desktop windows the canvas shrinks in width to keep the aspect locked rather than squishing height.',
        'Removed the isPhoneWidth / desktop branch entirely from canvas sizing. The viewport-height path (maxWidthByHeight) handles narrow desktop windows by clamping width down so the locked-aspect height fits available space.',
        'finalHeight is now simply finalWidth × ARENA_ASPECT — no more max(baseHeight, min(avail, extendedCap)) flattening. The canvas always preserves a consistent aspect, which means coop guest and host see the same world layout regardless of device.',
        'Side benefit: solo PC players now see the same map proportions as solo iPhone players. Obstacles and busters are no longer cut off or compressed on desktop. Determinism is unaffected (sim is world-coordinate; aspect change is presentation-only).',
        'Tests: all 23 suites green; determinism canary 11/11 byte-identical. No new tests were added — this is a presentation tweak with no sim impact.',
      ]
    },
  {
      version: '1.20.43',
      label: 'COOP PHASE D12.4: SLOT-1 ROOM-RESET + CHARGE FIX',
      summary: ['Two playtest issues after v1.20.42 shipped: (1) the guest\'s body did not reset to room center between rooms — only host\'s slot 0 was teleported by startRoom(), so slot 1 stayed wherever it was at room-clear and felt "stuck off-spawn" after every boon screen; (2) slot 1 was auto-firing constantly on the host without the guest needing to earn charge through gameplay. Pre-D12.4 updateGuestFire built charge at +1.0/s while the guest was still, but slot 0 has no equivalent free regen — it gains charge only through kinetic movement (moveChargeRate boon) or absorb/hit boons. Slot 1 was effectively cheating.'],
      highlights: [
        'startRoom now resets every guest slot\'s body to a center spawn (offset by ±60 px so slots don\'t overlap), zeroes velocity, refreshes spawnX/spawnY for the respawn-on-death path, and grants 1 s of spawn invuln. Snapshots already carry the new positions; the next change makes the guest\'s local prediction adopt them.',
        'snapshotApplier: applySlot now accepts `roomChanged` as a force-anchor trigger alongside `aliveEdge` and `!prevSnapSlot`. apply() detects prev.room.index !== curr.room.index and passes it through, so the guest\'s predicted slot 1 body teleports to the new spawn on every room transition instead of holding its previous position.',
        'updateGuestFire: removed the "+dt while still" auto-charge build. Slot 1 no longer charges just by standing still. This matches slot 0\'s design where standing still does not regen charge — only kinetic movement (with the Kinetic Harvest boon mirrored from host) or absorb/hit mechanics generate charge. Without the boon, slot 1 stays at 0 charge and does not fire — same behavior as a host with no charge sources.',
        'updateGuestSlotMovement: added kinetic-charge gain for guest slots while moving, mirroring the host\'s line at script.js:3576 (gainCharge with getKineticChargeRate). Gated on UPG.moveChargeRate > 0 (i.e. the host has Kinetic Harvest) and on combat phases (spawning|fighting). UPG is mirrored from host via mirrorHostUpgToSlot1, so any boon the host picks up benefits slot 1\'s charge gain too.',
        'Tests: updated test-guest-fire.mjs to drop the obsolete "still builds charge" assertion and add a "still+no-enemy does NOT build charge" guard against regression. All 24 suites green; determinism canary 11/11 byte-identical (host slot 0 path untouched).',
      ]
    },
  {
      version: '1.20.42',
      label: 'COOP PHASE D12.3: SLOT-1 GRADUAL DRIFT FIX',
      summary: ['Playtest revealed slot-1 movement starts perfectly accurate at run start, then progressively desyncs each room until guest no longer appears to move on the host. Diagnostics from v1.20.41 plus the symptom pattern pinned it to the remote-input-buffer staleness check, not transport. Each between-room boon screen pauses the host\'s simTick (gstate != "playing") while the guest\'s simTick keeps advancing — so guest input frames accumulate ahead of host\'s clock. The pre-D12.3 adapter used `Math.abs(t - frame.tick) > 12` which marked "future" frames stale just as harshly as ancient ones; once cumulative drift crossed 12 ticks (~200 ms), the host froze slot 1.'],
      highlights: [
        'Staleness check is now one-sided: only frames in the PAST (t - frame.tick > threshold) are considered stale. Future frames represent input the guest just sent that the host hasn\'t caught up to yet, and are always treated as fresh — they\'re the most accurate intent we have.',
        'STALE_TICK_THRESHOLD bumped from 12 ticks (~200 ms) to 60 ticks (~1 s). Tolerates normal cross-device sim-clock drift over long sessions plus host pauses on boon screens, while still suppressing autofire / movement when a peer has truly fallen off (≥1 s of no input).',
        'New `peekNewest()` API on remoteInputBuffer used as the fallback when peekLatestUpTo(t) returns null (i.e. all frames in buffer are after t). Previously the adapter fell through to peekOldest(), which would return an arbitrary ancient frame that no longer reflected the guest\'s current intent — exactly the "appears to stop moving" symptom.',
        'Tests: 5 new cases in test-coop-input-sync.mjs — guest-ahead small/large gap (verifies newest-frame selection + never-stale), past-frame stale at new threshold, configurable threshold still honored, fresh past frame within threshold. All 24 suites green; determinism canary 11/11 byte-identical (sim path unaffected: hostRemoteInputProcessor uses peekAt directly).',
        'Diagnostic infra (?coopdiag=1) from v1.20.41 stays in for one more release in case any drift edge case is reported during the next playtest.',
      ]
    },
  {
      version: '1.20.41',
      label: 'COOP PHASE D12.3: INPUT-CHAIN DIAGNOSTICS',
      summary: ['Playtest after D12.2 surfaced a one-way input bug: host can\'t see guest moving, but guest sees host fine. Snapshots flow host→guest correctly, but guest→host input frames either aren\'t being sent, aren\'t arriving, or aren\'t being consumed by host\'s slot-1 adapter. Without runtime telemetry it\'s impossible to localize the break, so D12.3 ships a no-op-by-default diagnostic mode (`?coopdiag=1`) that logs the entire chain on both peers.'],
      highlights: [
        'New URL flag `?coopdiag=1` enables verbose periodic logging (every 2s) of: simTick, gstate, roomPhase, coopInputSync stats (sent/received/pendingLocal/pendingRemote), hostRemoteInputProcessor stats (lastProcessedTick, processedCount, missCount), playerSlots[1] body x/y/vx/vy, slot.input.moveVector() output, and (on guest) joy.active/mag/dx/dy. Comparing the two peers\' logs side-by-side immediately shows where the chain breaks (e.g. guest sent=0 → joystick not capturing; guest sent>0 host received=0 → transport drop; received>0 processed=0 → tick mismatch).',
        'Per-packet ingest log on `kind:\'input\'` reception: prints role, slot, frame count, first/last tick, first frame still-bit, and current host simTick. Lets us see exactly which guest ticks are arriving and how they line up with the host\'s clock.',
        'Diagnostic interval is started in `installCoopInputUplink` and cleared in `teardownCoopInputUplink`, so it auto-stops on game over / disconnect / app close. Zero gameplay or determinism impact: the flag only adds console.info calls, no sim mutations.',
        'No version bump for the test runner: 24 suites still green, determinism 11/11 byte-identical (diagnostics are flag-gated and outside any sim path).',
        'Players are unaffected unless they explicitly add `?coopdiag=1` to the URL. Production runs see no extra logging.',
      ]
    },
  {
      version: '1.20.40',
      label: 'COOP PHASE D12.2: GUEST UX FIXES',
      summary: ['Post-D12.1 playtest revealed four guest-side bugs that compounded into a "half-broken" feel: the room intro overlay never went away on guest, the host\'s death didn\'t propagate to the guest (game just froze on the last snapshot), the bottom of the arena was clipped on PC browsers when guest viewport had a different aspect from the host, and a stray dev-only blue ring orbited the partner slot. D12.2 fixes all four; per-peer boon picks remains tracked for D15.'],
      highlights: [
        '"READY?" overlay sticking on guest: the room intro state machine (advanceRoomIntroPhase) only runs in the host\'s sim path, which guest skips. Snapshots already carry roomPhase but nothing was hiding the overlay when phase advanced. Snapshot apply now tracks prev/next roomPhase + roomIndex and calls showRoomIntro/hideRoomIntro on the appropriate edges. Guest sees READY?→GO!→fighting in sync with host across every room.',
        'Game-over propagation: host\'s gameOver() now broadcasts a `coop-game-over` packet (with score + roomIndex) BEFORE teardownCoopInputUplink disposes the session. Guest listener mirrors host\'s final score/room and triggers its own gameOver() so the death animation + leaderboard UI run on both peers. Without this, guest sat watching the host\'s last-snapshot pose forever.',
        'Bottom-of-arena truncation on PC browsers: guest\'s canvas was non-uniformly scaled (separate sx/sy) to fit world into a viewport with a different aspect than the host\'s. While mathematically the full world should render, in practice CSS constraints + body overflow occasionally clipped the bottom rows. D12.2 changes the strategy when the world is host-pinned: cv.width/cv.height are set to WORLD_W/WORLD_H exactly (1:1 render transform — no distortion), and only cv.style.width/height are scaled to fit the viewport while preserving the host\'s world aspect ratio. CSS letterboxes uniformly; the canvas always renders the full arena.',
        'Removed the dev-only #6ad1ff marker ring drawn around partner slots in drawGuestSlots. It served as a visual debug during D5 plumbing but is now just a distracting blue halo for players. Slot identity remains conveyed by hat/color/HP bar.',
        'Tests: 24 suites green, determinism 11/11 byte-identical (all changes are guest-side render/UI; host sim untouched).',
        'Known limit kept open: per-peer boon picks still on the host (mirrorHostUpgToSlot1). Both players will see the host\'s boon screen; guest does not get its own picks. This is the D15 milestone — a real two-screen boon flow needs per-peer UPG, separate boonSelectionOrder, and a barrier to wait for both picks before resuming the run.',
      ]
    },
  {
      version: '1.20.39',
      label: 'COOP PHASE D12.1: SHARED WORLD SIZE',
      summary: ['Playtest after D12 surfaced spatial desync: host and guest were each sizing their sim arena to their own canvas. Phones with different viewports had different WORLD_W/WORLD_H, so an enemy at (300, 500) on the host was off-screen on the guest, obstacle layouts diverged, and bullet bounds clipped at different walls. D12.1 pins the guest\'s sim world to the host\'s authoritative dimensions while keeping each device\'s canvas free to scale.'],
      highlights: [
        '`coop-run-start` packet now carries the host\'s `worldW` / `worldH`. The guest applies them via the new `setCoopWorldFromHost()` helper before `launchCoopRun()` runs, so room generation, obstacle picks, and reconciler world-bounds all use the host\'s arena from the very first frame.',
        'New `coopWorldPinned` flag in script.js makes `syncWorldFromCanvas()` a no-op once the world is pinned — subsequent canvas resizes (orientation change, viewport rescale) keep adjusting the canvas pixel size but never overwrite the host\'s world dims.',
        'Renderer already used `worldSpace.getRenderScale(cv.width, cv.height)` to letterbox the world into the canvas via a ctx transform (Phase D0a), so the guest\'s viewport now scales the host\'s arena uniformly on screen instead of cropping to its own canvas. Input is direction-only / unit-vector based, so it\'s scale-invariant — no input adjustments needed.',
        'Pin is released on coop teardown; a subsequent solo run re-syncs the world from the local canvas via the normal path. Solo and `?coopdebug=1` paths are untouched (the pin only engages on online guests after `coop-run-start`).',
        'Tests: 24 suites green. Determinism canary 11/11 byte-identical (worldSpace tests already covered the pure module; the new wiring is host/guest specific and exercised at runtime).',
      ]
    },
  {
      version: '1.20.38',
      label: 'COOP PHASE D12: LATENCY CUT + AUTOFIRE FIX',
      summary: ['First post-D11 playtest revealed two heavy issues: slot 1 (guest\'s player) appeared to fire constantly on the host\'s screen even when the guest was moving, and both peers\' views of each other felt sluggish and stale (positions lagged the actual play by 200ms+ end-to-end). D12 cuts ~50% off the input/snapshot latency stack and adds a staleness guard to the remote-input adapter so missing/old frames no longer trigger phantom autofire.'],
      highlights: [
        'Root cause of "P2 always firing": auto-fire-when-still is the game\'s core fire mechanic. With D11\'s peekOldest fallback returning whatever frame the buffer had — usually a stale `still=1` from before the guest moved — host\'s slot 1 saw a permanent "still" signal and fired every shot interval (~625 ms) until a fresher frame arrived. With 8-frame input batches at 60 Hz the fresh frames landed ~133 ms apart, so the false-still window was wide enough to look like nonstop fire.',
        'Staleness guard on remote input adapter: each lookup now reports `stale: true` when the best matching frame is more than 12 ticks (~200 ms) behind the host\'s simTick, OR when no frame exists at all. moveVector returns `{active:false, stale:true}` and isStill returns `false` (no signal — explicitly NOT still). updateGuestFire respects the new flag: charge build pauses, fire timer caps as if the slot is moving, autofire skipped. When fresh frames resume arriving, fire behavior returns instantly.',
        'Threshold is configurable per adapter via `staleTickThreshold` for testing — default 12 ticks tolerates one full batch + jitter without false positives.',
        'Input batch size halved: 8 → 4 (`createCoopInputSync` default + the lobby wire-up site). Average slot-1 input lag on host drops from 133 ms to 67 ms; guest motion changes (start/stop direction) reach the host roughly twice as fast. Bandwidth stays well under Supabase\'s 20 events/s cap (~15 msg/s outbound input, +15 msg/s inbound snapshots = 15 each direction).',
        'Snapshot rate raised: 10 Hz → 15 Hz (`ticksPerSnapshot: 6 → 4`). Host now broadcasts entity state every 67 ms instead of 100 ms — guest sees the host position update 50% more often.',
        'Render delay tightened: 100 ms → 70 ms in the guest\'s snapshot applier. Still buffers slightly more than one snapshot interval (67 ms) so the 2-snapshot interpolation never starves; takes 30 ms of authoritative-view lag off the guest\'s perception.',
        'Net combined latency improvement: input round-trip (guest move → host applies → snapshot back to guest) drops from ~233 ms to ~137 ms — about 40% off, while staying single-shot under the 20 msg/s rate cap.',
        'Tests: +3 new staleness suite cases on the remote adapter (stale-frame returns stale+isStill=false; fresh-within-threshold passes through; threshold is configurable). Updated the legacy "no frame returns inactive" test to assert the new contract (stale=true, isStill=false). 27 cases in coop-input-sync, 24 suites green overall, determinism 11/11 byte-identical (solo/COOP_DEBUG never use the remote adapter).',
        'Known limits kept open for D13+: guest-side bullet prediction (D5f) — guest\'s own shots still appear after the next snapshot lands, so firing has a perceptible click-to-bullet delay on the guest. Host-tab-hidden policy and auto-rejoin on guest refresh remain unimplemented; both are robustness items targeted for D14.',
      ]
    },
  {
      version: '1.20.37',
      label: 'COOP PHASE D11: SYNC START + TICK-TOLERANT INPUT',
      summary: ['Fixes the two bugs that surfaced in v1.20.36 playtest: (1) host and guest started their sims at independent moments (whoever clicked Start first ran ahead until the other clicked theirs), so simTick clocks were never aligned; (2) host\'s slot-1 remote-input adapter only matched on EXACT tick — once host\'s simTick passed available frames, slot 1 froze on the host\'s screen. Online co-op should now play with the guest visibly moving on the host\'s screen.'],
      highlights: [
        'Synchronized run start: host\'s "Start Run" click broadcasts `coop-run-start` over the gameplay channel and launches its own loop. Guest\'s button is replaced with a disabled "Waiting for host…" label and the guest auto-launches when the start message arrives. One human action, two synchronized sim starts (within a single Supabase round-trip).',
        'Lobby start handler refactored — the launch logic is now a `launchCoopRun()` helper that\'s idempotent (guard against double-launch) and triggered from both the host\'s click path AND the guest\'s `coop-run-start` listener. Listener is unsubscribed once the run launches.',
        'Tick-tolerant remote-input adapter: `peekAt(simTick)` is still the deterministic primary path (used by the host-remote-input processor for ack tracking). When it misses, the adapter now falls back to `peekLatestUpTo(simTick)` — newest frame at-or-before the requested tick — and finally to `peekOldest()` if host is BEHIND any buffered frame (run-start race). Slot 1 keeps moving across simTick drift instead of freezing.',
        'Two new buffer methods on `remoteInputBuffer.js`: `peekLatestUpTo(tick)` (reverse-linear scan, O(1) typical) and `peekOldest()`. Both pure / no side-effects; they don\'t consume frames so the processor\'s exact-tick `hasFrameFor` accounting (for snapshot `lastProcessedInputSeq[1]`) stays unchanged.',
        'Both fixes are independent — sync-start brings the two simTick clocks within one network RTT of each other, tick-tolerant lookup absorbs the residual drift + jitter + boon-pause-induced gaps. Together: guest\'s player visibly moves on host\'s screen.',
        'Test state: 24 suites green (415+ assertions). Determinism canary 11/11 byte-identical. The new fallback paths are invoked only when exact-tick match fails, so the determinism replay (which always calls peekAt against ticks for which a frame was just pushed) never touches the new code paths.',
        'Known limits this ship: (a) if guest reloads or refreshes after pressing Start, they get stuck on the lobby ready view (no auto-rejoin) — pre-existing. (b) if host clicks Start while guest\'s tab is backgrounded, guest may miss the start message until rAF resumes — they\'ll be a few seconds behind on tick alignment but the tick-tolerant adapter will keep their input flowing. (c) snapshot interpolation lag (~100ms) means guest still feels a slight delay on slot 0\'s position — predicted by D5d for slot 1 only.',
        'Known limits inherited: D10 team-boons (host picks for both), no leaderboard for coop runs, no host-tab-hidden policy.',
      ]
    },
  {
      version: '1.20.36',
      label: 'COOP PHASE D10: MULTI-ROOM BOONS',
      summary: ['Co-op runs no longer end after room 1. When the host clears a room, a `coop-boon-start` message hits the gameplay channel, the host opens the standard boon picker, and on confirm the host\'s upgraded UPG is mirrored onto guest slot 1 + a `coop-room-advance` hint clears the guest\'s wait overlay before the next snapshot lands. Both peers proceed into the next room together. Online co-op is now multi-room playable end-to-end.'],
      highlights: [
        'Replaces C3a-min-1 single-room termination (`endCoopDemoRun`) with `enterOnlineCoopBoonPhaseHost()` at the `clearStep.shouldShowUpgrades` branch. The unused demo-end function has been removed.',
        'Two new gameplay-channel message kinds: `coop-boon-start` (host → guest, fires when host opens the picker) and `coop-room-advance` (host → guest, fires when host\'s pick is applied and the next room is starting). Guest-only handlers wired alongside existing input/snapshot branches in `installCoopInputUplink`.',
        'Guest renders a "PARTNER PICKING A BOON…" full-screen overlay (#coop-wait-overlay) on `coop-boon-start` and clears it on `coop-room-advance`. Pure DOM injection — no extra CSS file changes — overlay is non-interactive (pointer-events:none) so it doesn\'t block input batching.',
        'Boon-application model v1: team boons. Host picks once per room (full legendary path included); the resulting UPG state is deep-cloned (JSON) and mirrored onto `playerSlots[1].upg` in-place (slot.upg is a frozen closure ref so we mutate keys rather than reassign). This means slot 1\'s authoritative bullets fire with the same stat/orb/shockwave/echo configuration as slot 0.',
        'Per-peer picks (each player chooses their own boon) are deferred — would require sending guest\'s picker state both ways, surfacing a richer overlay UI, and handling both-locked-in lockout. v1\'s host-picks-for-both keeps the protocol to two host→guest messages and ships today.',
        'Session reference is now captured at `installCoopInputUplink` time into a module-level `activeCoopSession` so non-uplink code paths (boon entry/advance) can publish messages without re-plumbing the session object through every call site. Cleared on teardown.',
        'Wait overlay + boon-phase state are reset by `teardownCoopInputUplink`, so leaving online mode (game over, leaving lobby, role change) leaves no stale UI behind.',
        'Test state: 24 suites green, determinism 11/11 byte-identical. New behavior is gated to `isCoopHost()` / role==="guest" and never touches solo / COOP_DEBUG sims.',
        'Known limits this ship: (a) host\'s tab being hidden during a pick still freezes the broadcaster — guest will sit on the wait overlay until host returns. (b) if `coop-boon-start` is dropped, guest sees no overlay but the next snapshot still advances the room cleanly — gameplay safe, UI cosmetic only. (c) if guest disconnects mid-pick, host\'s pick still applies + run continues solo-from-host\'s-POV until session detects disconnect.',
        'Remaining for v1.21.0: D5f predicted bullet visuals OR D8 two-peer fuzz harness (whichever surfaces first in playtest), C4 enemy 2× HP + per-client tint, host-tab-hidden / suspended policy.',
      ]
    },
  {
      version: '1.20.35',
      label: 'COOP PHASE D9: LOBBY → RUN HANDSHAKE',
      summary: ['The online lobby can now actually start a game. Once both peers reach the Ready view, a new "Start Run" button arms the pending coop run (role/seed/code/session) and launches via the same init+loop path solo uses. Online coop is now reachable from the UI for the first time. Same-room single-room playable end-to-end.'],
      highlights: [
        'New "Start Run" button on the coop ready view (#coop-ready-start). The "Gameplay launch arrives in the next experimental build" placeholder text is gone — the next build is here.',
        'CoopLobby `onReady` payload now includes the gameplay channel `session` so the host\'s session reference can be forwarded to `armPendingCoopRun` and re-used by `installCoopInputUplink` in init() — no second transport instance, no double-listener.',
        'Wire path: `lobby.onReady` → `armPendingCoopRun({ role, seed, code, session })` → user clicks Start Run → `init()` (consumes pending coop record, seeds RNG from coop seed, installs uplink + slots/applier/reconciler appropriate to role) → `gstate=playing` → loop starts.',
        'Both peers must press Start Run independently on their own device — no auto-start. This is intentional for the first ship: gives each player a beat to confirm they\'re ready before the host starts authoritative sim and the guest snaps into prediction.',
        'D5e reconciliation (shipped in v1.20.34) now actually exercises end-to-end through the lobby path. Predicted movement + soft-pull correction visible in real online play.',
        'Single-room termination (C3a-min-1) still applies online: round 1 plays through, run ends on room clear / death / pause-quit. Multi-room boon handshake (D10) is the next blocker for full runs.',
        'Test state: 24 suites green, determinism 11/11 byte-identical. Lobby wiring is UI-only — no tests added (would require DOM harness).',
        'Known limits this ship: (a) one room only — see D10. (b) no predicted bullet visuals on guest fire — guest sees their bullets emerge from authoritative position with ~snapshot-interval delay until D5f. (c) no host-tab-hidden handling — minimizing host tab will desync until either pause-both or end-run policy lands. (d) no leaderboard for coop runs (intentional, gated by isCoopRun).',
      ]
    },
  {
      version: '1.20.34',
      label: 'COOP PHASE D5e: RECONCILIATION (INPUT REPLAY)',
      summary: ['Closes the loop on guest prediction. Each fresh host snapshot, the guest replays its own locally-buffered input frames forward from the host-acknowledged tick, computes a "corrected" position, and either snaps (large desync) or softly pulls the predicted body toward truth (small drift). Result: predicted-feel stays responsive while authoritative state always wins over time. Determinism canary 11/11.'],
      highlights: [
        'New module `src/net/predictionReconciler.js` (~190 lines): tick-keyed ring-buffer for guest input frames, plus a pure replay function that applies the same prediction math (165 * GLOBAL_SPEED_LIFT * tMag) starting from any authoritative state. Default 240-tick (4s @ 60Hz) capacity gives comfortable margin against packet loss at 10Hz snapshot cadence. 31 unit tests covering empty history, single/multi-frame replay, inactive frames, world-bound clamping, ring wraparound, reset, constructor validation.',
        'Guest install path now builds the reconciler alongside the snapshot applier with matching speedPerSecond and current world bounds. Lifecycle: rebuilt per guest run, torn down with the rest of the coop scaffolding when leaving online mode.',
        '`updateOnlineGuestPrediction` records this tick\'s input frame ({tick, dx, dy, t, active}) into the reconciler BEFORE applying movement — so the recorded frame matches what the local sim used and what was sent up to the host on the input channel.',
        'Reconciliation correction runs in the loop\'s applier hook ONCE per fresh snapshot (gated by snapshotSeq tracker, so 60Hz render against 10Hz snapshots doesn\'t multi-correct). Pulls authoritative slot 1 state + lastProcessedInputSeq[1] from the snapshot, calls reconciler.replay(auth, ackTick, simTick, dt, bodyR), and compares the corrected position to the predicted body.',
        'Hard-snap threshold: 96px error → instant teleport (catastrophic desync, prediction is unrecoverable). Soft band: 1.5px–96px → close 35% of error per snapshot, converging in ~3-5 snapshots (~0.3-0.5s). Below 1.5px: ignored as numerical noise. Tunable via constants near the top of script.js.',
        'Skipped during respawn lifecycle: when guest is dead (body.deadAt) or host slot is dead, no replay runs — applier\'s alive-edge anchor handles those discontinuities instead. Skipped also when host hasn\'t yet ack\'d any of our input ticks (lastProcessedInputSeq[1] === null).',
        'Obstacle collision deliberately NOT replayed in this version. Drift near walls is acceptable since each snapshot recorrects, and the obstacle solver depends on global room state the reconciler can\'t see. World-bounds clamping IS replayed.',
        'Test state: 24 suites green (413+ assertions). Determinism canary 11/11 byte-identical — reconciliation is gated to isCoopGuest()-only paths and never touches host/solo/COOP_DEBUG sims.',
        'Next up: D5f (predicted bullet visuals or first multi-peer integration test against the reconciler under simulated jitter/loss).',
      ]
    },
  {
      version: '1.20.33',
      label: 'COOP PHASE D5d: LOCAL PREDICTION (GUEST SLOT 1)',
      summary: ['Guest now feels their own movement instantly. Joystick input drives the local slot 1 body each frame; the snapshot applier skips writing slot 1\'s body x/y/vx/vy continuously, but still re-anchors on death, respawn, runId reset, and first snapshot. Aim, hp, charge, invulnT, and alive flag remain host-authoritative. Determinism canary 11/11.'],
      highlights: [
        'Snapshot applier accepts a new factory option `predictedSlotId`. When set, applySlot skips body x/y/vx/vy writes for that slot id during normal interpolation — the prediction loop owns body movement. Aim angle is still applied from snapshot every frame (with 100ms interpolation lag), so auto-targeting matches host-authoritative bullets without divergence.',
        'Re-anchor on lifecycle discontinuities: even with prediction enabled, the applier writes the body authoritatively when (a) it\'s the first snapshot for that slot, (b) the alive flag toggles (death or respawn), or (c) the runId changes. Death + respawn anchors zero local vx/vy so stale predicted velocity can\'t keep drifting after the lifecycle event.',
        'Discrete fields (hp, charge, maxCharge, maxHp, invulnT, deadAt, alive) are still applied from snapshot every frame regardless of skipBody — the prediction loop reads body.deadAt to halt movement when host says we\'re dead.',
        'New `updateOnlineGuestPrediction(dt)` runs in the isCoopGuest branch of update(). Reads slot1.input.moveVector() (HostInputAdapter on the local joystick), applies movement at 165 * GLOBAL_SPEED_LIFT (matching host-side guest movement), clamps to world bounds, and resolves obstacle collisions via the shared resolveEntityObstacleCollisions helper.',
        'Guest\'s slot 1 install (`installOnlineCoopGuestSlot1`) now mounts `createHostInputAdapter(joy)` on `slot.input` (was null in D5b/c). Same adapter the input-uplink already uses to send frames to the host — predicted state and uplink stay perfectly in sync without sampling the joystick twice.',
        'Bullets still come from snapshots and are authored against host-authoritative slot 1 position. Until reconciliation lands (D5e/f), guest may see their own shots emerge slightly offset from the predicted body when local prediction has drifted from server truth. This is cosmetic — gameplay impact comes from prediction-feel, which is what D5d delivers.',
        '5 new applier test scenarios (8 new assertions): predicted slot body preserved, aim+hp+charge still update, alive→dead re-anchor + zero velocity, dead→alive (respawn) re-anchor, runId reset re-anchor, and predictedSlotId=null leaves all slots interpolating normally.',
        'Test state: 23 suites green (382+ assertions). Determinism canary 11/11 byte-identical (gated to solo/host/COOP_DEBUG paths — guest prediction never runs in those).',
        'Next up (Phase D5e): bullet/aim prediction or input acknowledgement-based reconciliation — closing the loop so predicted state corrects to authoritative state without visible snap-back.',
      ]
    },
  {
      version: '1.20.32',
      label: 'COOP PHASE D5c: INTERPOLATION BUFFER + UPSERT-BY-ID',
      summary: ['Guest now renders smooth motion. The applier holds a 2-snapshot buffer (prev + curr) and lerps entity positions at `renderTimeMs - renderDelayMs` (default 100 ms). Upsert-by-id replaces wipe-and-rebuild — entities only despawn when missing from the latest snapshot. Solo / host / COOP_DEBUG remain byte-identical (applier null). Determinism canary 11/11.'],
      highlights: [
        'snapshotApplier.js rewritten end-to-end. The applier now keeps a 2-snapshot buffer ({snapshot, recvAtMs} for prev and curr). Each frame, the loop calls .apply() with the latest known snapshot + the current rAF timestamp; the applier shifts curr→prev only when the input is a genuinely newer (runId, seq) tuple, then renders interpolated state at `renderTimeMs - renderDelayMs`.',
        'Position interpolation: enemies, bullets, and slot bodies all lerp x/y/vx/vy by id between prev and curr. Default render delay = 100 ms, roughly one snapshot interval at 10 Hz, so guest typically has prev+curr to interp between unless a snapshot is dropped.',
        'Aim arrow uses shortest-arc angle interpolation (lerpAngle wraps over ±π). Without this, an aim crossing the back hemisphere would spin the wrong way for one frame on every snapshot.',
        'Discrete values (hp, charge, maxCharge, invulnT, alive flag, room index/phase, score) are taken from curr — never lerped. Health bars don\'t flicker fractional values; pause/death state changes flip cleanly on the next snapshot.',
        'Upsert-by-id: enemies/bullets are now indexed by id when interpolating. Ids in both prev+curr lerp; ids only in curr (just-spawned) render at curr position; ids only in prev (despawned) drop out of the local arrays. No accidental zombies, no flicker between rebuilds.',
        'Boundary handling: targetT < prev.recvAt → snap to prev (alpha=0). targetT > curr.recvAt → snap to curr (alpha=1, no extrapolation in D5c). Same-seq replays don\'t shift the buffer but still re-render at advancing alpha so the loop animates smoothly between snapshot arrivals.',
        'Run-id epoch: a snapshot from a different runId clears prev so the new run\'s first frame snaps to curr (no stale interp into the new world). Last-applied seq tracker resets on epoch.',
        'D5b-compatible fallback: if renderTimeMs is omitted, applier snaps to curr (alpha=1, interpolated=false). Useful in tests and for any caller that just wants latest authoritative state.',
        'Wiring in script.js: snapshot ingest now stamps performance.now() into latestRemoteSnapshotRecvAtMs alongside the decoded snapshot. Loop hook in loop(ts) passes both renderTimeMs (frameStartTs) and snapshotRecvAtMs to apply().',
        'Test suite rewritten — 51 assertions covering: first-snapshot snap, mid-window interpolation, slot lerp, shortest-arc aim, despawn (id missing in curr), spawn (id missing in prev), extrapolation skip, prev clamp, same-seq replay, older-seq protection, runId reset, fallback path, unknown enemy type, bullet field round-trip, bullet position lerp, maxHp safe default, reset, null-arg guards, discrete-value pass-through.',
        'Test state: 23 suites green (374+ assertions, +1 suite vs D5b). Determinism 11/11 byte-identical.',
        'Next up (Phase D5d): local prediction for guest\'s OWN slot — guest reads its joystick, simulates its own movement locally, and submits inputs to host. Snapshot applier will skip writing slot 1 from snapshots so prediction owns the frame.',
      ]
    },
  {
      version: '1.20.31',
      label: 'COOP PHASE D5b: SNAP-TO-LATEST SNAPSHOT APPLIER',
      summary: ['Guest now actually sees the world. The snapshot applier ingests host broadcasts, validates them via decodeSnapshot, and writes enemy / bullet / slot state into the local arrays so guest renders the host\'s authoritative state. Solo / host / COOP_DEBUG remain byte-identical (applier is null on those code paths). Determinism canary 11/11.'],
      highlights: [
        'New module src/net/snapshotApplier.js — pure factory createSnapshotApplier({ enemyTypeDefs, resolveColors }) returns an object with .apply(snapshot, target). No transport, no DOM, no globals. Wipes-and-rebuilds enemies/bullets per applied snapshot (D5c will replace with upsert + interpolation).',
        'Decode-on-ingress: incoming snapshot payloads now run through decodeSnapshot before being stored. Malformed packets (NaN positions, missing required scalars, wrong kind) are dropped with a console.warn instead of wedging the applier mid-frame.',
        'Sequence memory: each applier instance remembers the last (runId, snapshotSeq) it actually applied. The 60 Hz frame loop hits .apply every frame, but the 10 Hz snapshot feed means 5 of every 6 calls would be duplicates — the applier no-ops on same-or-older seq so the entity arrays only thrash when there is genuinely new data. Run-id mismatch resets the tracker (host restarted).',
        'Slot match by id, not array index: snapshot.slots[i].id (0=host, 1=guest in wire format) is the source of truth. Sparse slot arrays from the host (e.g. host omits a downed slot) no longer scramble assignment.',
        'Wire schema extended: maxHp added to encodeEnemy. Without it, every wipe-rebuild would have collapsed maxHp to current hp, causing the enemy HP bar to flicker only on damage frames. coopSnapshot test count: 24/24.',
        'Guest slot 1 install: new installOnlineCoopGuestSlot1() seats a placeholder body for the local guest player so D5a\'s getLocalRenderSlot() has a real target. Body is a placeholder for now; positions snap to host\'s view of slot 1 each frame. D5d replaces snapshot-driven position with locally-predicted state.',
        'Color resolver: applier accepts a resolveColors(type, def) callback. script.js wires it through getEnemyDefinition() which already runs resolveEnemyColor against the local palette — host and guest can therefore have different cosmetic palettes without breaking either.',
        'runElapsedMs intentionally NOT overwritten on guest from snapshots (rubber-duck D5b finding). Guest advances its own run timer locally; overwriting at ~10 Hz would cause stutter / jump-back between snapshots. roomIndex / roomPhase / score ARE mirrored from snapshot — they are game-wide singletons, not per-frame timers.',
        'Loop integration: applier hook runs once per frame AFTER fixed-step sim ticks (no-op on guest because guest update() early-returns) and BEFORE draw(simNowMs). Solo/host: applier is null, hook skipped.',
        'Known limitation: isBoss is not on the wire. Guest derives visuals from ENEMY_TYPES[type] only, so boss HP-bar and \"★ BOSS\" label may render incorrectly on guest until a follow-up adds the flag. Acceptable D5b scope.',
        'New test suite scripts/test-snapshot-applier.mjs (50 tests): basic apply, wipe-and-rebuild, empty snapshot, slot-match-by-id, seq-skip, runId reset, unknown enemy type fallback, maxHp safe defaulting, bullet field round-trip, missing slot resilience, reset() behavior, null-arg guards.',
        'Rubber-duck critique adopted: (a) full hydrate of static-per-type enemy flags from ENEMY_TYPES, (b) lastAppliedSeq tracker to avoid 60 Hz re-application, (c) runElapsedMs stays local, (d) match slots by id, (e) decode/validate at ingress, (f) maxHp on wire.',
        'Test state: 22 suites green (323+ assertions). Determinism 11/11 byte-identical.',
        'Next up (Phase D5c): interpolation buffer — render guest entities ~50–75 ms behind latest snapshot for smooth motion; upsert-by-id instead of wipe-and-rebuild.',
      ]
    },
  {
      version: '1.20.30',
      label: 'COOP PHASE D5a: RENDER/HUD TO LOCAL SLOT',
      summary: ['Ghost sprite and HUD now read from the local render slot (whichever slot represents this browser) instead of hardcoded slot 0. Solo / host / COOP_DEBUG → byte-identical (local slot is slot 0, whose metrics/upg bridge to the legacy globals). Online guest will now correctly bind its own ghost + charge bar + sps to slot 1 once D5b installs the guest body.'],
      highlights: [
        'New getLocalRenderSlot() helper in script.js wraps getLocalSlot(playerSlots) and falls back to playerSlots[0] when the local slot has not been installed yet — guests wake up with no slot 1 until D5b\'s snapshot applier seats one, and we never want the renderer to NPE in that gap.',
        'drawGhost(ts) now reads body / charge / maxCharge / fireT / hp / maxHp / sps from the local slot\'s body+metrics+upg instead of the slot-0 globals (player / charge / UPG.maxCharge / fireT / hp / maxHp / UPG.sps). For solo and host these are the same objects via the slot 0 getter bridges, so the canary stays byte-identical.',
        'drawGuestSlots(ts) now skips whichever slot is local rather than hardcoding `i = 1`. On the host this still draws slot 1 (the guest); on the guest, after D5b, this will draw slot 0 (the host) — both peers see their partner via the same code path.',
        'hudUpdate() now reads charge / maxCharge / sps from the local slot\'s metrics+upg. roomIndex / runElapsedMs / score remain global (they are game-wide values shared between both peers, not per-slot).',
        'Out of scope (intentionally deferred): payload ring, aim arrow, shields, orbit spheres, void walker. These still read player.* / UPG.* globals. They will be retargeted in a follow-up once D5b populates slot positions on the guest — until then, slot 0 has no useful x/y on a guest peer, so retargeting now would render onto stale data anyway.',
        'Test state: 22 suites green (273+ assertions). Determinism 11/11 byte-identical — local slot collapses to slot 0 in the canary harness so render reads are unchanged.',
        'Next up (Phase D5b): snap-to-latest snapshot applier so the guest actually sees enemies / bullets / partner positions instead of an empty world.',
      ]
    },
  {
      version: '1.20.29',
      label: 'COOP PHASE D4.6: SNAPSHOT CONTRACT FIX',
      summary: ['Pre-D5 audit caught four bugs in the wire format that would have made guest rendering impossible: enemy IDs were unstable, enemy fire fields were unpopulated, bullets lacked render-critical fields, and slot data was incomplete. All fixed before guests start consuming snapshots in D5. Determinism canary byte-identical.'],
      highlights: [
        'Enemy stable IDs: collectHostSnapshotState now reads e.eid (the runtime field set by createEnemy) instead of e.id (which is undefined → was falling back to array index → guest upsert would have thrashed every frame as enemies sorted differently).',
        'Enemy fire fields renamed to match runtime: schema now carries fT (cooldown counter, ms) and fRate (period, ms) instead of nonexistent fireT/windup. Guests will be able to render live fire-tells (charging-up animation before an enemy shoots).',
        'Bullets now carry r (radius) and state (output|grey|danger). bulletRenderer.js dispatches on b.state directly, so without these fields every guest-rendered projectile would have crashed or fallen through to default visuals. r is needed for hit-region drawing and bounce-ring math.',
        'Slot data now fully populated. encodeSlot already declared charge/maxCharge/aimAngle/invulnT/shieldT/stillTimer/alive but collectHostSnapshotState was only writing 6 of the 13 fields → guests would have decoded zeros for shields, aim arrow, charge bar, etc. Now reads s.metrics for hp/maxHp/charge/stillTimer, slot.upg.maxCharge, slot.aim.angle, body.invincible (invulnT), body.shields[0].t (shieldT), body.deadAt (alive).',
        'Bullet ownerSlot still clamped to 0 for danger bullets (no slot owner) — type/state fields carry the player/danger discriminator. spawnTick still 0 until D4b proper bullet spawn-tick stamping (which D5 does not need).',
        'New coopSnapshot tests (24 total, +3): default values for new fields (bullet r=6, state=output; enemy r=12, fT=0, fRate=0), regression guard ensuring legacy fireT/windup keys are NOT present in encoded output (we want hard breaks if anything still reads the old names).',
        'No changes to broadcaster, applier, runtime sim, or HUD. Pure schema/collection fix.',
        'Rubber-duck of D5 plan flagged this as a blocker — ALL of D5\'s rendering would have been built on phantom data. Better to catch it now than after D5b lands and guests render the wrong world.',
        'All 22 test suites green (273+ assertions). Determinism 11/11 byte-identical — change is host-broadcast-only, sim path untouched.',
        'Next up (Phase D5a): route render/HUD to local slot (currently hardcoded to slot 0) so the guest sees their own slot 1 as the "main" player rather than the host.',
      ]
    },
  {
      version: '1.20.28',
      label: 'COOP PHASE D4.5: HOST DRIVES ONLINE SLOT 1',
      summary: ['Host now actually consumes guest input frames to drive slot 1 in the authoritative sim. lastProcessedInputSeq[1] is no longer a placeholder — it reflects the highest sim-tick where the host applied a real remote-input frame, ready for D6 reconciliation. Determinism canary byte-identical (online host code path is gated; offline runs untouched).'],
      highlights: [
        'New src/net/hostRemoteInputProcessor.js: tracks the highest sim-tick for which the host has CONSUMED a remote-input frame (not "received" — that distinction was rubber-duck finding #3 on the D4 plan). Per-tick, peeks the ring; if a frame exists, advances lastProcessedTick and trims the buffer to retainTicks (default 60 = ~1s history for D6 replay).',
        'Online host slot 1 now spawned in installCoopInputUplink (host branch) via createRemoteInputAdapter(remoteRing, { getCurrentTick: () => simTick }). Body, metrics, timers, aim mirror the COOP_DEBUG installGuestDebugSlot setup so the existing slot-1 movement / contact-damage / respawn paths work unchanged.',
        'collectHostSnapshotState (the broadcaster getState callback) now reads lastProcessedInputSeq[1] from hostRemoteInputProcessor.getLastProcessedTick(). Stays null until the first frame is applied, then advances every tick a guest frame is consumed.',
        'Loop wiring: hostRemoteInputProcessor.tick(simTick) runs INSIDE the fixed-step accumulator, immediately AFTER update() and BEFORE coopSnapshotBroadcaster.tick(). Order matters — the snapshot must reflect the just-consumed tick rather than lagging by a cadence period.',
        'teardownCoopInputUplink also tears down the slot 1 entry (delete playerSlots[1]) and resets the processor handle so a fresh init() / restoreRun() starts clean. Slot 0 lifecycle is left to installPlayerSlot0 — we only own what we installed.',
        'Idempotent install: if playerSlots[1] is already registered (COOP_DEBUG path or a re-entry) we skip — real online runs never coexist with COOP_DEBUG, but the guard is conservative belt-and-braces.',
        'New scripts/test-host-remote-input-processor.mjs (12 tests): construction guards, lastProcessedTick null start, missing-frame leaves value unchanged, frame-present advances, monotonic-ish behavior across gaps, non-finite/negative simTick rejection, retainTicks=N trim arithmetic, retainTicks=0 evicts the just-processed frame, cutoff<0 skipped at run start, reset, integration over 121 ticks.',
        'All 22 test suites green (270+ assertions). Determinism 11/11 byte-identical — slot-1 install is gated behind isCoopHost (online); solo and COOP_DEBUG paths are untouched.',
        'D6 reconciliation can now use lastProcessedInputSeq[1] to safely trim guest replay buffers without dropping un-applied input.',
        'Next up (Phase D5): guest renders from snapshots — interpolation between two consecutive snapshots, plus client-side prediction for slot-1 movement so guest input feels responsive.',
      ]
    },
  {
      version: '1.20.27',
      label: 'COOP PHASE D4: HOST SNAPSHOT BROADCAST',
      summary: ['Host now emits a full state snapshot every 6 sim ticks (~10 Hz). Each snapshot is tagged with a runId/epoch so stale packets from a disposed run can never contaminate the next one. Guests receive and store the latest snapshot but do not yet render from it — D5 wires prediction + interpolation. Determinism canary byte-identical.'],
      highlights: [
        'New src/net/coopSnapshotBroadcaster.js: tick-cadence broadcaster. Cadence is sim-tick-based (NOT wall time) so behavior is independent of frame jitter, tab-throttle and rAF resume bursts — a 500-tick gap emits exactly ONE snapshot, not 84 catch-up sends.',
        'Async-safe sendGameplay: Promise.resolve(result).then(() => sent++).catch(failed++) pattern matches the D3-fix shape so unhandled rejections cannot leak. Sync throws and async rejections are both counted in stats.failed.',
        'Late-resolve safety: if dispose() fires before an in-flight async send resolves, the late .then() does NOT increment stats.sent. Important for runId/epoch transitions where a brand-new broadcaster is taking over.',
        'New src/net/coopSnapshot.js schema additions: required `runId` (string 1-128 chars) on every encoded snapshot; lastProcessedInputSeq[0|1] now u32-or-null (was forced 0). null = "host has not consumed any input for this slot yet" — D6 reconciliation must NOT trim replay buffer when null. 0 is reserved as a valid tick.',
        'script.js wiring: currentRunId generated via crypto.randomUUID() (with fallback) on init() and restoreRun() right after resetBulletIds(). installCoopInputUplink builds the broadcaster on host role; teardownCoopInputUplink disposes it. Loop calls coopSnapshotBroadcaster?.tick(simTick) inside the fixed-step accumulator so cadence is deterministic.',
        'Guest snapshot receipt: onGameplay handler now also processes kind=\'snapshot\' envelopes. Epoch gate: if incoming runId differs from latestRemoteSnapshot.runId we hard-reset seq tracking (otherwise a late packet from the old run could fight a fresh sequence). isNewerSnapshot() then gates against duplicates / out-of-order delivery.',
        'collectHostSnapshotState() builds a defensive loose object: ?? defaults on every field, ownerSlot clamped to non-negative (danger bullets carry the danger/player discriminator in the `type` field). encodeSnapshot is strict — any throw is caught by the broadcaster and counted as a failed send rather than crashing the loop.',
        'Rate budget: 10 Hz host (snapshots) + ~7.5 Hz guest (8-frame input batch) = ~17.5 msg/s. Comfortable headroom under Supabase 20 msg/s cap for retries / pings / boon-pick handshakes.',
        'New scripts/test-coop-snapshot-broadcaster.mjs: 14 tests covering construction guards, cadence (first-tick + every-N), gap-no-burst, ticksPerSnapshot floor, non-finite simTick rejection, output envelope shape, sequencer integration, sync send error isolation, async rejection not-unhandled, getState throw isolation, encode failure isolation, dispose stops sends, late-resolve-after-dispose does not count, stats fields populated.',
        'Updated scripts/test-coop-snapshot.mjs: every encodeSnapshot call now includes runId; new tests for runId required, runId type/length validation, lastProcessedInputSeq null support per slot. 21/21 passing.',
        'All 21 test suites green (260+ assertions). Determinism 11/11 byte-identical — no host-only code path touches the deterministic sim.',
        'D7 host-side lag-comp remains BLOCKED/DEFERRED: Valve-style rewind only works for hitscan, but our projectiles bounce/home/split. Host-authoritative projectile timing for v1; revisit if playtest shows guest shots feel unfair.',
        'Next up (Phase D4.5): host drives online slot 1 by draining remoteInputBuffer + sets a true lastProcessedInputSeq[1]. Then D5 (guest prediction + interpolation, snapshots actually drive rendering).',
      ]
    },
  {
      version: '1.20.26',
      label: 'COOP PHASE D3-FIX: TRANSPORT CONTRACT + ASYNC SEND',
      summary: ['Pre-D4 hotfix. Rubber-duck found that D3 was silently broken on the real Supabase transport: the onGameplay handler treated its arg as the raw payload, but coopSession actually delivers {payload,from,ts} envelopes — every guest input frame was being dropped. Also tightened async sendGameplay error handling.'],
      highlights: [
        'script.js: onGameplay handler in installCoopInputUplink now unwraps `ev.payload` before kind-checking. Previously `payload.kind` was always undefined → every input dropped → host never saw guest movement.',
        'src/net/coopInputSync.js: sendGameplay error handling now covers both sync throws AND async rejections via Promise.resolve(result).then(() => sentCount++).catch(logger). Previously async rejections produced unhandled-promise warnings and a wrongly-incremented sent counter.',
        'Default batchSize bumped 4 → 8 frames (~7.5 msg/s instead of ~15 msg/s). Combined with the upcoming 10 Hz host snapshot broadcaster (D4) keeps the channel at ~17.5 msg/s with safe headroom under the Supabase 20 msg/s cap for retries/pings/boon picks.',
        'scripts/test-coop-input-uplink.mjs: mock session now matches real coopSession contract (envelope wrapping in simulateIncoming, async sendGameplay). Added unwrapToInputIngest helper that mirrors the script.js fix. New tests: defensive null/undefined envelope handling, async-rejection-not-unhandled, async-resolve-increments-sent.',
        'scripts/test-coop-input-sync.mjs: stats.sent assertion converted to async-aware (await microtasks before checking) since increments now fire on Promise resolution.',
        'Both test suites now expose async-test capability via Promise tracking in their harnesses.',
        'All 20 test suites green. Determinism 11/11 byte-identical (no sim path touched).',
        'Next up (Phase D4): tick-cadence snapshot broadcaster — every 6 sim ticks → 10 Hz, with runId/epoch in the envelope so stale post-dispose sends are harmless across runs.',
      ]
    },
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

const PATCH_NOTES = PATCH_NOTES_RECENT.slice(0, 50);

const PATCH_NOTES_ARCHIVE_MESSAGE = 'In-client notes show the 50 most recent updates. Older builds were not archived in this panel.';

export { PATCH_NOTES, PATCH_NOTES_ARCHIVE_MESSAGE };
