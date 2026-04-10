# Phantom Rebound Codebase Audit

Status: proposed audit plan after v1.16.28.

## Purpose

This audit is meant to make Phantom Rebound easier to extend without slowing down balance iteration. The current project is productive for a prototype, but several systems are now sharing the same runtime surface. The goal is not a large rewrite. The goal is to identify the smallest structural changes that improve reliability, release safety, and future feature velocity.

## Current Snapshot

- The intended ownership model already exists in `docs/ownership.md`.
- The actual runtime is still concentrated in `script.js`, which owns game state, room flow, collisions, rendering, telemetry, leaderboard UI, diagnostics, and several platform concerns.
- Balance data has started moving into `src/data/`, especially `boons.js`, `gameData.js`, and `enemyTypes.js`.
- UI, input, viewport, leaderboard, and color systems have partial slices under `src/`.
- Server telemetry is useful and already exposes balance failure modes, such as runaway charge economies and passive safety loops.

## High-Risk Findings

1. Release automation does not match the hard gate.
   `scripts/bump-version.ps1` only updates part of the required version surface and appears to parse the older two-part version format. The project gate now requires `src/data/version.js`, `version.json`, the `index.html` fallback banner, `window.__APP_BUILD__`, and `script.js` / `styles.css` cache-busting query strings to move together.

2. `script.js` is carrying too many responsibilities.
   The main file contains simulation, rendering, telemetry, room generation, local storage, remote calls, DOM rendering, input flow, and game-over behavior. This makes small changes fast, but increases regression risk because unrelated systems share mutable globals.

3. Browser globals block headless tests.
   Some data modules perform browser work at import time. For example, importing game data in Node can fail because color initialization touches `localStorage`. This blocks deterministic simulation tests and CI-friendly balance checks.

4. Network and diagnostics paths are duplicated.
   Diagnostic submission exists in both the platform service and the main runtime. Duplicated request paths are a reliability risk because one can drift from the other.

5. Test coverage is mostly smoke-level.
   `test-triangle.mjs` confirms metadata exists, but there is no general test runner, no version-gate test, no deterministic room/balance tests, and no automated telemetry regression report.

6. Generated artifacts need clearer handling.
   `supabase/scores/`, screenshots, and comment exports are valuable, but they should have a documented rule for whether they are committed fixtures, local analysis inputs, or ignored generated output.

## Audit Tracks

### 1. Release And Version Gate

Objectives:

- Make one command update every required version surface.
- Add a validation command that fails when version fields drift.
- Update `docs/release.md` so it matches the current hard gate.

Recommended tasks:

- Replace the current version parser with `major.minor.patch` support.
- Update `version.json`, `src/data/version.js`, `window.__APP_BUILD__`, fallback banner, and cache-busting query strings together.
- Add `scripts/verify-version.ps1`.
- Consider generating the fallback banner from `VERSION` during a build step if a build pipeline is introduced later.

### 2. Runtime Boundary Audit

Objectives:

- Reduce the blast radius of gameplay changes.
- Move pure logic out of `script.js` before moving browser-dependent code.
- Keep behavior unchanged during extraction.

Suggested target slices:

- `src/core/runState.js`: score, hp, charge, room phase, reset flow.
- `src/core/rooms.js`: room definitions, spawn queue, reinforcement pacing.
- `src/systems/projectileDamage.js`: projectile damage scaling, Phase Dash graze damage, hit rewards.
- `src/systems/chargeEconomy.js`: grey drops, absorb gain, charge caps, wasted charge.
- `src/systems/telemetry.js`: run telemetry object creation, room summaries, snapshots.
- `src/render/canvasRenderer.js`: draw loop helpers and visual-only canvas code.
- `src/platform/diagnostics.js`: crash report storage and upload.
- `src/ui/hud.js`: HUD writes, game-over rendering, leaderboard modal rendering.

### 3. Reliability And Test Harness

Objectives:

- Make balance logic testable without a browser.
- Catch release/version mistakes before push.
- Protect high-churn mechanics with focused regression tests.

Initial tests:

- `getRequiredShotCount` with forward lanes, ring shots, dual shot, and spread shot.
- `syncChargeCapacity` with Charge Cap Up, Deep Reserve, Dense Core, and cap limits.
- Enemy death drop cap never exceeds 5.
- Projectile damage scaling and Phase Dash graze damage.
- Boon application idempotency for one-time boons.
- Room generation always includes at least one shooter when needed.
- Telemetry summary totals match room records.
- Version fields all match.

### 4. Headless Balance Simulation

Objectives:

- Replay representative build paths without manual play.
- Run balance checks over exported telemetry and synthetic scenarios.

Useful scenarios:

- Wide-shot sustain build through rooms 60, 80, and 100.
- Shield-heavy safety build with Phase Dash and Mirror Tide.
- Low-offense single-shot build through first boss.
- High-charge reserve build with Quick Harvest and Deep Reserve.
- Passive-orbit build with Charged Orbs and Absorb Orbs.

Outputs:

- Average clear time by room band.
- Damage taken by source.
- Charge gained, spent, and wasted.
- Sustain by source.
- Safety proc count by room.
- Kills by source.

### 5. Telemetry And Balance Review

Objectives:

- Turn server score exports into repeatable balance reports.
- Define thresholds that make runaway builds visible.

Suggested thresholds to monitor:

- Charge wasted per room.
- Grey charge gained per kill.
- Shots fired per kill.
- Rooms cleared with zero or near-zero output firing.
- Phase Dash and Mirror Tide procs per room.
- Shield blocks per room.
- Average clear time below target bands.
- HP ending at cap across repeated late rooms.

### 6. Platform And Network Reliability

Objectives:

- Keep leaderboard and diagnostics paths consistent.
- Avoid losing submissions on mobile network failure.

Recommended tasks:

- Use one platform service for leaderboard scores and diagnostics.
- Add a small pending-submission queue in local storage.
- Retry failed submissions on next launch.
- Record remote submit failures in local diagnostics.
- Document the trust model for client-submitted score and telemetry data.

### 7. Performance And Mobile Scalability

Objectives:

- Verify late-room frame stability on mobile-sized canvases.
- Identify whether object pooling or spatial partitioning is needed.

Recommended checks:

- Measure frame time with maximum bullets, particles, enemies, shields, orbits, and reflected shots.
- Track bullet and particle allocation churn.
- Stress rooms 80, 100, and 120 with full projectile effects.
- Verify viewport modes on short phones, tall phones, and desktop.
- Capture Playwright screenshots for menu, gameplay, upgrade, leaderboard, and game-over states.

## Proposed Order

1. Fix release/version automation.
2. Add `verify-version` and basic syntax/test commands.
3. Make data modules importable in Node by removing import-time browser side effects.
4. Extract pure projectile damage and charge economy helpers.
5. Add unit tests for charge, damage, room generation, and telemetry summaries.
6. Consolidate diagnostics and leaderboard submission.
7. Build a telemetry report script for `supabase/scores`.
8. Extract rendering and HUD modules once core logic has tests.

## Definition Of Done

The audit is complete when:

- A version validation command exists and passes.
- Core data modules can be imported in Node without browser mocks.
- The highest-risk balance helpers have tests.
- The main runtime has a documented extraction map with completed first slices.
- Duplicate network submission paths are removed.
- Telemetry exports can produce a repeatable balance report.
- `docs/release.md` and `docs/ownership.md` match the codebase reality.

## First Concrete Patch

Start with release safety:

- Rewrite `scripts/bump-version.ps1` for `major.minor.patch`.
- Update every required version field.
- Add `scripts/verify-version.ps1`.
- Update `docs/release.md`.

This is small, easy to verify, and protects every later refactor.
