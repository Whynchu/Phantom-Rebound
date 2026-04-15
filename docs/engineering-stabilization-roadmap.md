# Phantom Rebound Engineering Stabilization Roadmap

Status: active repo audit after `1.16.50`

## Execution Progress

Recent stabilization stages landed after `1.16.51`:

- `789d746` Added CI workflow [`.github/workflows/verify-all.yml`](C:/Development/Phantom-Rebound/.github/workflows/verify-all.yml:1) to enforce release gate checks on push/PR.
- `abe6c4c` Extracted room definition and pacing helpers into [src/core/roomFlow.js](C:/Development/Phantom-Rebound/src/core/roomFlow.js:1) with Node test coverage.
- `1914094` Extracted room phase transition helpers into [src/core/roomRuntime.js](C:/Development/Phantom-Rebound/src/core/roomRuntime.js:1) with deterministic tests.
- `87ae708` Extracted run/room telemetry builders into [src/systems/telemetry.js](C:/Development/Phantom-Rebound/src/systems/telemetry.js:1), added payload regression tests.
- `15b9a6c` Extracted damageless room progression into [src/systems/progression.js](C:/Development/Phantom-Rebound/src/systems/progression.js:1) and unified both room-clear paths to one rule.
- `a3680e2` Extracted local leaderboard sanitize/parse/upsert/entry logic into [src/platform/leaderboardLocal.js](C:/Development/Phantom-Rebound/src/platform/leaderboardLocal.js:1).
- `a60c0a2` Extracted crash diagnostics report construction/persistence into [src/platform/diagnostics.js](C:/Development/Phantom-Rebound/src/platform/diagnostics.js:1).
- `ba9ec96` Extracted patch-notes rendering/visibility helpers into [src/ui/patchNotes.js](C:/Development/Phantom-Rebound/src/ui/patchNotes.js:1).
- `9f09a50` Extracted leaderboard badge/toggle UI helpers into [src/ui/leaderboard.js](C:/Development/Phantom-Rebound/src/ui/leaderboard.js:1) and removed duplicate script-side UI state wiring.
- `cd8191a` Extracted game-over panel rendering helper into [src/ui/gameOver.js](C:/Development/Phantom-Rebound/src/ui/gameOver.js:1).
- `e34a295` Extracted leaderboard refresh/submit async orchestration into [src/platform/leaderboardRuntime.js](C:/Development/Phantom-Rebound/src/platform/leaderboardRuntime.js:1).
- `df482c5` Extracted app-shell/menu-chrome helper behavior into [src/ui/shell.js](C:/Development/Phantom-Rebound/src/ui/shell.js:1).
- `238356f` Hardened release gate by adding browser-module syntax validation to [scripts/verify-all.ps1](C:/Development/Phantom-Rebound/scripts/verify-all.ps1:1), which catches scope leaks that CommonJS checks can miss.
- `04d5b2d` Tightened mobile viewport handling in [script.js](C:/Development/Phantom-Rebound/script.js:1) for taller phone-width arenas and stronger iPhone gesture suppression.
- `experimental` extraction stage: room clear/intro overlay helpers now live in [src/ui/roomOverlays.js](C:/Development/Phantom-Rebound/src/ui/roomOverlays.js:1), and page-level gesture suppression now lives in [src/platform/gestureGuards.js](C:/Development/Phantom-Rebound/src/platform/gestureGuards.js:1), both with regression coverage in [scripts/test-systems.mjs](C:/Development/Phantom-Rebound/scripts/test-systems.mjs:1).
- `experimental` extraction stage: patch notes, leaderboard screen controls, boon panel toggles, and popup-close wiring now live in [src/ui/appChrome.js](C:/Development/Phantom-Rebound/src/ui/appChrome.js:1), reducing entrypoint DOM glue and adding regression coverage for app chrome interactions.
- `experimental` extraction stage: player-name sync plus start/restart/main-menu flow now live in [src/ui/sessionFlow.js](C:/Development/Phantom-Rebound/src/ui/sessionFlow.js:1), removing another block of screen-state wiring from `script.js` and adding regression coverage for session transitions.
- `experimental` extraction stage: enemy projectile creation/staging helpers now live in [src/entities/projectiles.js](C:/Development/Phantom-Rebound/src/entities/projectiles.js:1), with `script.js` retaining only thin adapters for current runtime state and regression coverage added for danger/elite projectile generation.
- `experimental` extraction stage: player output/grey projectile constructors now live in [src/entities/playerProjectiles.js](C:/Development/Phantom-Rebound/src/entities/playerProjectiles.js:1), reducing repeated `bullets.push(...)` sites across fire, echo, split, absorb-refraction, mirror, and burst logic.
- `experimental` extraction stage: player shot-layout and volley-spec construction now live in [src/entities/playerFire.js](C:/Development/Phantom-Rebound/src/entities/playerFire.js:1), pulling `firePlayer()` angle/lane planning and reusable bullet-spec assembly out of `script.js` while keeping the runtime entrypoint focused on charge spend, SFX, and side effects.
- `experimental` extraction stage: orbit/shield runtime helpers now live in [src/entities/defenseRuntime.js](C:/Development/Phantom-Rebound/src/entities/defenseRuntime.js:1), centralizing orb timer sync, orbit/shield slot positioning, shield cooldown ticking, ready-shield counting, and Aegis Battery timer stepping for reuse across combat branches.
- `experimental` extraction stage: bullet lifecycle transition helpers now live in [src/systems/bulletRuntime.js](C:/Development/Phantom-Rebound/src/systems/bulletRuntime.js:1), centralizing output expiry, out-of-bounds cleanup, danger-bounce state changes, and output-bounce/split decisions while leaving VFX and gameplay side effects in the main loop for now.
- `experimental` extraction stage: output-hit resolution helpers now live in [src/systems/outputHit.js](C:/Development/Phantom-Rebound/src/systems/outputHit.js:1), centralizing crit/dead-man damage math, blood-pact eligibility, pierce/volatile-round decisions, and sanguine-burst cadence while keeping kill rewards and room-side effects in `script.js`.
- `experimental` extraction stage: enemy kill reward derivation now lives in [src/systems/killRewards.js](C:/Development/Phantom-Rebound/src/systems/killRewards.js:1), centralizing boss-clear rewards, vampiric/blood-moon/corona/final-form reward values, crimson harvest drops, and streak timer updates while `script.js` applies the concrete side effects.
- `experimental` extraction stage: danger-hit/player-defense resolution now lives in [src/systems/dangerHit.js](C:/Development/Phantom-Rebound/src/systems/dangerHit.js:1), centralizing void-zone blocks, phase-dash vs mirror-tide vs direct-hit branching, lifeline recovery state, and slipstream near-miss detection while `script.js` applies movement/VFX and bullet cleanup.
- `experimental` extraction stage: enemy movement/fire-cycle helpers now live in [src/entities/enemyRuntime.js](C:/Development/Phantom-Rebound/src/entities/enemyRuntime.js:1), centralizing siphon/rusher stepping, ranged-enemy windup/fire cadence, and disruptor cooldown handling while projectile-spawn specifics remain in `script.js`.
- `experimental` extraction stage: enemy burst-pattern routing now lives in [src/entities/enemyRuntime.js](C:/Development/Phantom-Rebound/src/entities/enemyRuntime.js:1) via `fireEnemyBurst`, moving zoner/triangle/elite/purple/disruptor fire branching out of `script.js` while preserving existing spawn callbacks.
- `experimental` extraction stage: orbit-sphere enemy contact resolution now lives in [src/entities/enemyRuntime.js](C:/Development/Phantom-Rebound/src/entities/enemyRuntime.js:1) via `applyOrbitSphereContact`, centralizing cooldown-gated per-orb contact damage and kill-state detection.
- `experimental` extraction stage: charged-orb firing resolution now lives in [src/entities/defenseRuntime.js](C:/Development/Phantom-Rebound/src/entities/defenseRuntime.js:1) via `buildChargedOrbVolleyForSlot`, centralizing per-slot timer advancement, target selection, charge gating, and shot spec generation.
- `experimental` extraction stage: rusher contact hit resolution now lives in [src/systems/dangerHit.js](C:/Development/Phantom-Rebound/src/systems/dangerHit.js:1) via `resolveRusherContactHit`, centralizing contact damage/lifeline/last-stand/game-over branching while `script.js` applies VFX and projectile side effects.
- `experimental` extraction stage: Aegis battery bolt target/shot derivation now lives in [src/entities/defenseRuntime.js](C:/Development/Phantom-Rebound/src/entities/defenseRuntime.js:1) via `buildAegisBatteryBoltSpec`, centralizing nearest-target selection and bolt spec creation while `script.js` retains only spawn/VFX side effects.
- `experimental` extraction stage: enemy combat-step orchestration now lives in [src/entities/enemyRuntime.js](C:/Development/Phantom-Rebound/src/entities/enemyRuntime.js:1) via `stepEnemyCombatState`, centralizing per-type movement/fire-intent branching (siphon/rusher/ranged) while `script.js` keeps hit and spawn side effects.
- `experimental` extraction stage: post-hit shockwave and last-stand burst derivation now lives in [src/systems/dangerHit.js](C:/Development/Phantom-Rebound/src/systems/dangerHit.js:1) via `convertNearbyDangerBulletsToGrey` and `buildLastStandBurstSpec`, reducing duplicated hit-resolution side effects between rusher and projectile branches.
- `experimental` extraction stage: orbit-kill reward derivation now lives in [src/systems/killRewards.js](C:/Development/Phantom-Rebound/src/systems/killRewards.js:1) via `resolveOrbitKillEffects`, centralizing score/kill deltas plus final-form charge eligibility for orbit contact kills.
- `experimental` extraction stage: shared post-hit aftermath derivation now lives in [src/systems/dangerHit.js](C:/Development/Phantom-Rebound/src/systems/dangerHit.js:1) via `resolvePostHitAftermath`, centralizing lifeline state handoff, optional colossus shockwave trigger, and optional last-stand burst spec generation for rusher/direct/phase hit paths.
- `experimental` extraction stage: output-kill reward-action derivation now lives in [src/systems/killRewards.js](C:/Development/Phantom-Rebound/src/systems/killRewards.js:1) via `applyKillUpgradeState` and `buildKillRewardActions`, centralizing kill-state upgrade writes plus reward action generation (boss clear, sustain/charge rewards, grey drops, sanguine bursts).
- `experimental` extraction stage: mirror shield reflection and shield-burst output specs now live in [src/entities/defenseRuntime.js](C:/Development/Phantom-Rebound/src/entities/defenseRuntime.js:1) via `buildMirrorShieldReflectionSpec` and `buildShieldBurstSpec`, reducing inline defensive projectile math in `script.js`.
- `experimental` phase-1 coupling cleanup: player-color storage reads/writes were removed from [src/data/colorScheme.js](C:/Development/Phantom-Rebound/src/data/colorScheme.js:1), with persistence/bootstrap now handled in [script.js](C:/Development/Phantom-Rebound/script.js:1) via platform storage adapters.

Validation status:

- `verify-all.ps1` passes with current extraction stack.
- [scripts/test-systems.mjs](C:/Development/Phantom-Rebound/scripts/test-systems.mjs:1) now covers room flow/runtime, telemetry, progression, leaderboard local helpers, and diagnostics payload building.
- The regression harness also covers room overlay class/text transitions and gesture suppression timing guards.
- The regression harness also covers patch-notes, leaderboard-control, and boon-panel event binding behavior.
- The regression harness also covers player-name state syncing and start/restart/main-menu transition wiring.
- The regression harness also covers elite-stage projectile palette application and enemy projectile spawn helpers.
- The regression harness also covers player output-bullet creation, grey-drop spawning, split fragments, and radial player bursts.
- The regression harness also covers player lane-offset generation, shot-plan construction, and volley-spec assembly.
- The regression harness also covers orbit timer sync, shield cooldown ticking, orbit/shield slot positioning, and Aegis Battery timing behavior.
- The regression harness also covers bullet expiry, out-of-bounds cleanup, danger bounce transitions, and output bounce/split decisions.
- The regression harness also covers output-hit damage resolution, blood-pact eligibility, pierce/volatile-round behavior, and sanguine-burst cadence.
- The regression harness also covers enemy kill reward derivation for boss rewards, sustain, streak timers, and reward-spawn counts.
- The regression harness also covers void-zone blocking, phase-dash/mirror-tide/direct-hit decisions, lifeline recovery, and slipstream near-miss behavior.
- The regression harness also covers enemy movement stepping, ranged fire cadence, and disruptor post-fire cooldown behavior.
- The regression harness also covers enemy burst fire routing across zoner/triangle/elite/purple/disruptor paths.
- The regression harness also covers orbit-sphere contact damage timing and kill transitions.
- The regression harness also covers charged-orb per-slot fire timing, charge spend, and shot-spec generation.
- The regression harness also covers rusher contact hit outcomes including lifeline and last-stand triggers.
- The regression harness also covers Aegis battery bolt gating, nearest-target selection, and bolt stat derivation.
- The regression harness also covers enemy combat-step orchestration across siphon, rusher, and ranged paths.
- The regression harness also covers post-hit nearby-danger conversion and last-stand burst spec derivation.
- The regression harness also covers orbit-kill score/final-form reward derivation.
- The regression harness also covers shared post-hit aftermath derivation (lifeline, colossus shockwave trigger, and last-stand burst spec).
- The regression harness also covers output-kill reward action generation and upgrade-state application.
- The regression harness also covers mirror-shield reflection and shield-burst spec derivation.
- The regression harness also covers Node-safe color selection updates without browser storage dependencies.

## Purpose

This document turns the current codebase state into a practical gameplan for making *Phantom Rebound* sustainable, expandable, and safe to evolve with AI agents.

This is not a rewrite brief.

The goal is to:

- reduce regression risk as the game grows
- make features land in clear ownership slices
- make balance and room logic testable outside the browser
- make release/version safety enforceable
- give AI agents a repo shape they can work in without repeatedly touching the whole game

## Executive Summary

The repo already has the right direction documented in [docs/ownership.md](C:/Development/Phantom-Rebound/docs/ownership.md:1), but the runtime has not caught up to that structure.

The main issue is that `script.js` is still the actual game engine surface:

- simulation
- room generation
- score flow
- telemetry
- local storage
- remote submission
- HUD updates
- overlays
- input wiring
- render loop
- game-over handling

That is fast for prototype iteration, but it is the main reason feature work is fragile. AI agents can help most when the repo has clean, narrow write surfaces. Right now many features still require modifying the same large entrypoint, which increases merge conflicts, missed side effects, and accidental behavior drift.

## Current Repo Snapshot

Observed structure:

- `script.js` is about 3,010 lines and remains the dominant runtime surface.
- `src/` exists and matches the intended ownership model, but several ownership folders are mostly placeholders.
- `src/core/` is effectively empty while the true core logic remains in `script.js`.
- `src/data/` is real and valuable, especially `boons.js`, `gameData.js`, `enemyTypes.js`, `patchNotes.js`, and `version.js`.
- `src/ui/`, `src/input/`, and `src/platform/` exist, but only partial responsibilities have moved into them.
- Supabase is present for leaderboard and diagnostics, but platform/network handling is still split between service modules and `script.js`.

Relevant files:

- [script.js](C:/Development/Phantom-Rebound/script.js:1)
- [src/data/gameData.js](C:/Development/Phantom-Rebound/src/data/gameData.js:1)
- [src/data/colorScheme.js](C:/Development/Phantom-Rebound/src/data/colorScheme.js:1)
- [src/platform/leaderboardService.js](C:/Development/Phantom-Rebound/src/platform/leaderboardService.js:1)
- [scripts/bump-version.ps1](C:/Development/Phantom-Rebound/scripts/bump-version.ps1:1)
- [docs/release.md](C:/Development/Phantom-Rebound/docs/release.md:1)

## Critical Findings

### 1. The ownership model is documented but not enforced

`docs/ownership.md` says `src/core/` should own game loop, state progression, collision orchestration, and room flow. In practice, that logic is still in `script.js`.

Impact:

- most gameplay features still touch the same file
- AI-assisted work is harder to parallelize
- unrelated systems are coupled through shared mutable globals

### 2. Data modules still have browser-side effects at import time

[src/data/gameData.js](C:/Development/Phantom-Rebound/src/data/gameData.js:1) imports color logic and immediately calls `loadPlayerColorFromStorage()`, which depends on browser globals and local storage.

Impact:

- pure gameplay/data modules are not reliably importable in Node
- headless tests and balance simulations are harder than they should be
- agents cannot safely reuse runtime logic in scripts without browser assumptions leaking in

### 3. Platform logic is duplicated

`submit_run_diagnostic` exists in [src/platform/leaderboardService.js](C:/Development/Phantom-Rebound/src/platform/leaderboardService.js:66), but `script.js` also carries its own `DIAGNOSTIC_REMOTE_CONFIG` and direct fetch path.

Impact:

- platform/network behavior can drift
- fixes have to be made twice
- diagnostics become less trustworthy over time

### 4. Release tooling is out of date with the actual release gate

[scripts/bump-version.ps1](C:/Development/Phantom-Rebound/scripts/bump-version.ps1:1) still parses an older version shape and only updates part of the required release surface. [docs/release.md](C:/Development/Phantom-Rebound/docs/release.md:1) is also stale relative to the current push requirements.

Impact:

- version drift remains possible
- pushes rely on manual discipline instead of validation
- release safety depends too much on memory

### 5. There is no real headless regression harness yet

The game has useful telemetry and Supabase score archives, but there is no first-class test harness around:

- charge economy
- room generation
- sustain ceilings
- projectile damage
- score calculation
- version consistency

Impact:

- balancing remains reactive
- regressions are discovered in live play instead of pre-merge
- AI agents cannot verify isolated systems cleanly

### 6. The repo lacks a stable feature pipeline for larger systems

The game is growing into features like identity, cloud state, and possibly co-op. The current runtime shape is not yet ready for those without heavy friction.

Impact:

- every major feature risks becoming another `script.js` expansion
- architecture debt compounds exactly where future systems want clean seams

## What "Stable To Work On With AI Agents" Should Mean

For this repo, agent-friendly engineering does not mean "many agents at once." It means:

- each feature has an obvious owning slice
- pure gameplay logic can be tested without DOM or local storage
- browser and network concerns live behind narrow interfaces
- game balance changes mostly touch `src/data/` and isolated systems
- versioning and release checks are automated
- docs describe the intended write boundaries so agents do not invent new ones

The target is a repo where an AI worker can safely own one of these tasks without editing the entrypoint:

- add a boon
- tune room pacing
- add a projectile mechanic
- change leaderboard payloads
- add a HUD panel
- add a new network-backed feature

## Target Architecture

This is the recommended runtime split.

### `src/core/`

Owns:

- run state
- room phase progression
- state resets
- room start/end transitions
- deterministic step ordering

Target files:

- `src/core/runState.js`
- `src/core/roomFlow.js`
- `src/core/resetRun.js`

### `src/systems/`

Owns pure gameplay rules that can be tested headlessly.

Target files:

- `src/systems/damage.js`
- `src/systems/chargeEconomy.js`
- `src/systems/sustain.js`
- `src/systems/scoring.js`
- `src/systems/telemetry.js`
- `src/systems/spawnBudget.js`

### `src/entities/`

Owns runtime actor definitions and actor-specific helpers.

Current anchor:

- [src/entities/enemyTypes.js](C:/Development/Phantom-Rebound/src/entities/enemyTypes.js:1)

Future additions:

- `src/entities/player.js`
- `src/entities/projectiles.js`
- `src/entities/orbits.js`

### `src/data/`

Owns static definitions and balance constants only.

Working rule:

- no browser reads
- no local storage
- no DOM writes
- no import-time side effects

### `src/ui/`

Owns DOM rendering and overlays only.

Target files:

- `src/ui/hud.js`
- `src/ui/gameOver.js`
- `src/ui/leaderboard.js`
- `src/ui/patchNotes.js`

### `src/platform/`

Owns browser and service adapters only.

Target files:

- `src/platform/storage.js`
- `src/platform/leaderboardService.js`
- `src/platform/diagnostics.js`
- `src/platform/auth.js`
- `src/platform/viewport.js`

## Implementation Strategy

Do not rewrite the game in one pass.

Use a staged extraction plan that converts unstable surfaces into narrow modules while keeping gameplay live.

## Phase 0: Release Safety First

This is the first required step because it protects every later change.

Tasks:

- rewrite [scripts/bump-version.ps1](C:/Development/Phantom-Rebound/scripts/bump-version.ps1:1) for `major.minor.patch`
- add `scripts/verify-version.ps1`
- validate:
  - `src/data/version.js`
  - `version.json`
  - `index.html` fallback banner
  - `window.__APP_BUILD__`
  - `script.js` cache-busting query string
  - `styles.css` cache-busting query string
- update [docs/release.md](C:/Development/Phantom-Rebound/docs/release.md:1) to match the real hard gate

Definition of done:

- one command bumps all required version surfaces
- one command fails the build when version fields drift

## Phase 1: Remove Import-Time Browser Coupling

This is the highest-leverage engineering cleanup after release safety.

Tasks:

- remove `loadPlayerColorFromStorage()` from import-time execution in [src/data/gameData.js](C:/Development/Phantom-Rebound/src/data/gameData.js:1)
- move color loading into app boot or a platform init function
- ensure `src/data/` modules can load in Node without DOM/local storage

Definition of done:

- core data modules can be imported in Node
- simulation helpers no longer depend on browser initialization

## Phase 2: Extract Pure Systems From `script.js`

This phase is the main architecture unlock.

Priority order:

1. scoring
2. sustain
3. projectile damage
4. telemetry aggregation
5. room/spawn budget math

Why this order:

- these systems are high-churn
- they are mostly rules, not rendering
- they matter to balance and future content
- they are the easiest to test once isolated

Definition of done:

- new balance work mostly happens in `src/systems/*`
- `script.js` becomes orchestration, not rule storage

## Phase 3: Consolidate Platform Boundaries

Tasks:

- move diagnostics submission out of `script.js`
- use one service surface for leaderboard and diagnostics
- create explicit storage helpers for:
  - runner name
  - leaderboard cache
  - crash reports
  - pending submissions

Definition of done:

- no direct leaderboard/diagnostic fetch calls remain in `script.js`
- local storage keys are managed in one place

## Phase 4: Build A Real Test Harness

Use a lightweight Node-based harness first. Do not wait for a full framework rewrite.

Minimum test set:

- version surface consistency
- required shot count math
- charge cap synchronization
- sustain cap behavior
- projectile damage scaling
- room generation constraints
- score checkpoint calculations
- telemetry summary rollups

Definition of done:

- balance changes can be checked before manual play
- AI agents can run deterministic verification on the touched system

## Phase 5: Telemetry And Balance Pipeline

The repo already has useful score archives under `supabase/scores/`. Turn that into a repeatable report path.

Tasks:

- document whether `supabase/scores/` is fixture data, working analysis input, or generated output
- add a telemetry report script for exported runs
- define target metrics by room band:
  - clear time
  - HP lost
  - sustain by source
  - score pacing
  - damage source distribution

Definition of done:

- balance conversations are driven by reports, not memory
- regressions like runaway sustain or dead-room pacing show up quickly

## Phase 6: UI And Entry Point Cleanup

Once the core rules are extracted, clean the remaining entrypoint responsibilities.

Tasks:

- move HUD writing out of `script.js`
- move leaderboard rendering out of `script.js`
- move patch notes rendering out of `script.js`
- keep `script.js` focused on bootstrapping, wiring, and frame stepping

Definition of done:

- the entrypoint becomes readable
- UI work and gameplay work stop colliding

## Phase 7: Prepare For Real Feature Expansion

Only after the previous phases should the game grow into heavier systems like:

- authenticated identity
- cloud-synced progression
- challenge seeds
- asynchronous social features
- true multiplayer/co-op

At that point the repo will have the boundaries needed to add large systems without collapsing back into one giant runtime file.

## AI Agent Workflow Rules

These are the repo rules I recommend adopting explicitly.

### Rule 1: New features must declare an owner slice first

Before adding code, the feature must name its home:

- `src/data`
- `src/systems`
- `src/entities`
- `src/ui`
- `src/platform`
- `src/core`

If the answer is "script.js," that should be treated as a temporary exception, not the default.

### Rule 2: Pure logic goes in pure modules

If code does not need:

- DOM
- `window`
- `document`
- `localStorage`
- `fetch`

then it should not live in browser-bound files.

### Rule 3: `src/data/` is static

No side effects.
No browser initialization.
No persistence reads.

This is essential for testing and simulation.

### Rule 4: Platform code must be behind adapters

Supabase, auth, storage, diagnostics, and viewport handling should never be spread through gameplay files.

### Rule 5: Every push must pass a release gate

Version drift should be impossible to miss.

### Rule 6: Balance work should be telemetry-backed

If a balance change is deep enough to affect room pacing, sustain, damage, or scoring, it should either:

- add telemetry
- use existing telemetry
- or add a focused regression test

## Immediate Recommended Backlog

This is the practical order I would execute next.

1. Fix version tooling and add `verify-version`.
2. Remove import-time browser coupling from `src/data/gameData.js`.
3. Extract sustain and scoring into `src/systems/`.
4. Consolidate diagnostics into `src/platform/leaderboardService.js` or a new `src/platform/diagnostics.js`.
5. Add a minimal Node test harness for version, sustain, scoring, and room generation.
6. Move HUD and leaderboard rendering out of `script.js`.

## What Not To Do

Avoid these traps:

- do not rewrite the full game loop all at once
- do not split files by size alone
- do not move browser-coupled code into `src/data/`
- do not add major new systems before release safety and testability
- do not treat documentation as done unless it matches the real code path

## Success Criteria

This roadmap is working when:

- `script.js` stops being the only meaningful write surface
- at least the highest-risk gameplay rules are testable in Node
- release/version checks are automatic
- AI agents can land isolated features without touching unrelated runtime systems
- large future features have obvious insertion points

## First Concrete Patch Set

If you want the highest-value first engineering pass, it should be:

1. rewrite `bump-version.ps1`
2. add `verify-version.ps1`
3. update `docs/release.md`
4. remove import-time color loading from `src/data/gameData.js`
5. add a platform init path for player color
6. extract sustain and score calculation into `src/systems/`

That sequence improves release safety, testability, and future feature velocity without freezing gameplay iteration.
