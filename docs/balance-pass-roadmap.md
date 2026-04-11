# Phantom Rebound Balance Pass Roadmap

Status: draft after `1.16.30` telemetry review.

## Purpose

This document is the working brief for the next gameplay balance pass. The goal is to keep the upcoming changes coherent, staged, and measurable so that shot balance, charge economy, onboarding, and build diversity move together instead of being tuned as isolated hotfixes.

This roadmap is meant to answer four questions before implementation starts:

1. What problems are we actually solving?
2. In what order should the fixes land?
3. What telemetry or tests must confirm each step?
4. What should not be changed in the same pass?

## Current Problems Confirmed By `1.16.30`

### 1. Early-game difficulty spikes too hard around room 10

- Half of sampled runs ended by room 14.
- Average HP loss jumps sharply at room 10.
- Danger bullet volume spikes hard at the first boss window.
- Runs that still fail early are already spending several minutes before the loss, which makes the fail loop feel punitive.

Interpretation:

- The run is asking for meaningful execution before the build has expressed itself.
- The first boss and immediate follow-up rooms are arriving before weaker/newer builds have enough tools.

### 2. Bullet builds still define the ceiling

- The deepest runs in `1.16.30` still rely on strong bullet packages.
- Orbit and shield tech appear in successful runs, but mostly as support, safety, or economy.
- Deep runs show orbit kills near zero, which means orbit and shield systems are not yet true late-game carry paths.

Interpretation:

- Orbit and shield packages are helping runs survive.
- They are not providing enough independent damage output to compete with bullet-first scaling.

### 3. Charge caps still get too large in long runs

- Room-80 and room-100 snapshots still show very large pools in reserve-heavy runs.
- `Deep Reserve` remains strong for too long.
- `Charge Cap Up` and `Deep Reserve` multiply together too cleanly.

Interpretation:

- Large pools are still enabling runaway sustain and smoothing out too much intended tension.
- Charge economy is still rewarding capacity stacking more than intended.

### 4. Kinetic Harvest and Deep Reserve are structurally fighting each other

Current behavior rewards low-cap scarcity. That helped small-pool builds, but it also means reserve-heavy builds lose Kinetic value too abruptly.

Interpretation:

- The current Kinetic model does not match the intended feel.
- Kinetic should help refill the front of the bar quickly, not punish the player for ever taking capacity.

### 5. Multi-shot scaling compounds too hard

At the moment, extra bullets largely keep full bullet damage. That means more lanes can function like near-linear DPS growth on top of better coverage and proc density.

Interpretation:

- Shot count is doing too many jobs at once:
  - more coverage
  - more proc opportunities
  - more crowd control
  - more raw total damage
- That combination makes bullet builds too easy to snowball.

### 6. Spread Shot has a real combination bug

`Spread Shot` currently expands every forward lane after lane generation, so combinations like `Twin Lance + Spread Shot` overproduce bullets relative to the intended pattern.

Interpretation:

- This needs to be fixed before judging any shot-balance data.

## Balance Goals

The pass should aim for the following outcomes:

1. Reaching room 20 should feel achievable without requiring a high-roll build.
2. Bullet packages should remain good, but no longer define the only reliable late-game damage ceiling.
3. Orbit and shield packages should be able to contribute meaningful damage, not just protection.
4. Charge-cap builds should remain a distinct style without invalidating Kinetic.
5. Runs should feel less binary by room 25.
6. Every change should have telemetry that proves whether it worked.

## Design Principles

1. More shots should add coverage faster than they add raw DPS.
2. Capacity should add flexibility, not erase charge tension.
3. Defense packages need offensive conversion points if they are expected to carry late.
4. Early rooms should teach patterns before punishing mistakes.
5. New boons should be added only when a tuning-only fix cannot solve the problem.

## Workstreams

### A. Shot-Count Damage Normalization

This is the anchor change for the pass.

#### Proposal

Treat each volley as a shared total damage pool based on emitted shot count:

- `1 shot = 1.00x total`
- `2 shots = 1.75x total`
- `3 shots = 2.40x total`
- `4 shots = 2.95x total`
- `5 shots = 3.40x total`
- `6 shots = 3.75x total`
- `7+ shots = 4.00x total cap`

Per-bullet damage becomes:

- `total volley multiplier / emitted bullet count`

That means extra shots still improve coverage and proc density, but they no longer scale raw total damage without limit.

#### Required implementation notes

- Fix `Spread Shot` pattern generation before tuning this.
- Apply normalization to the actual emitted bullet count, not a theoretical count.
- `Echo Fire` must inherit normalized per-bullet damage.
- Review how ring shots participate in the same pool.
- Review how `Front+Back` participates in the same pool.

#### Why this matters

- It reins in bullet-first snowballing.
- It gives room for non-bullet offensive systems to matter.
- It makes shot packages feel distinct without automatically making them the best raw DPS path.

#### Acceptance targets

- Multi-shot builds still feel stronger in coverage and consistency.
- Bullet builds no longer dominate purely by lane count.
- Deep bullet runs rely more on proc synergies and less on raw shot multiplication.

### B. Kinetic Harvest Redesign

#### Proposal

Replace the current low-cap scarcity boost with a front-loaded fill model:

- The first part of the charge bar fills quickly while moving.
- The fast-fill portion shrinks as max charge gets larger.
- The fast-fill portion never drops below `5%` of the bar.
- Low-cap builds can still reach roughly `50%` fast-fill coverage.

Example target behavior:

- low caps: fast-fill window near `50%`
- medium caps: fast-fill window around `20%` to `30%`
- very large caps: fast-fill window floors at `5%`

#### Why this matters

- It matches intended feel better than the current scarcity multiplier.
- It allows reserve builds to still get useful startup charge.
- It preserves the identity of small-pool builds without making larger pools feel dead.

#### Acceptance targets

- Kinetic is still strong on low-cap builds.
- Kinetic remains useful on reserve builds, especially at low current charge.
- Reserve no longer hard-disables Kinetic value.

### C. Charge Cap Audit

#### Proposal

Rebuild charge-cap math as one system, not separate boon tweaks.

Primary changes to evaluate:

- Multiply base pool and shot buffer first.
- Add `Deep Reserve` after the multiplier step.
- Increase `Deep Reserve` falloff.
- Revisit `Charge Cap Up` percent and cap.
- Re-check `Dense Core` interaction after the new cap math lands.

#### Why this matters

- Current math lets reserve stack too efficiently into massive late-game pools.
- Kinetic and cap tuning cannot be judged cleanly until this is corrected.

#### Acceptance targets

- Reserve builds still exist, but deep snapshots stop routinely exploding into extreme values.
- Capacity remains a playstyle choice instead of a default best economy line.
- Dense Core stays meaningful as the low-cap specialist.

### D. Room 10-15 Smoothing

#### Proposal

Reduce the first major difficulty wall before adding more content.

Areas to evaluate:

- first boss pressure
- escort pressure at the first boss
- room 11-12 bullet volume
- early clear-time pacing
- first-act boon quality floor

#### Why this matters

- The current early fail loop costs too much time before the player gets enough build identity.
- Build diversity will not matter if too many runs die before the build comes online.

#### Acceptance targets

- More runs should reach room 20.
- Room 10 should still feel like a boss spike, but not a cliff.
- Early losses should feel more attributable to compounding mistakes than one abrupt pressure jump.

### E. Orbit And Shield Offense Pass

#### Scope

Do not add a large boon batch. Start with a small, focused package.

Initial target: two orbit offense accents and two shield offense accents.

#### Candidate directions

- orbit offense that scales with absorbs or charge state
- orbit offense that improves single-target boss pressure
- shield offense that stores blocked pressure and retaliates harder
- shield offense that rewards maintaining active plates

#### Why this matters

- Orbit and shield tech are currently mostly defensive support.
- They need offensive conversion points if they are expected to compete with bullet-led builds.

#### Acceptance targets

- Deep runs with orbit/shield packages should show meaningful non-bullet kill contribution.
- Orbit and shield builds should feel like real archetypes, not add-ons.

### F. Boon Offer Shaping

#### Proposal

Use the boon-offer layer to improve archetype formation earlier in the run.

Current weighting already boosts modifiers when the base exists. Expand that carefully:

- improve early chances of seeing an archetype anchor
- reduce dead-end early option sets
- avoid overcommitting the run too early

#### Why this matters

- Part of the "god mode or dead by 25" feeling is not just power level.
- It is also that some runs fail to assemble a recognizable direction early enough.

#### Acceptance targets

- Early boon sets produce clearer run identities.
- Early picks feel less random without becoming scripted.

### G. Telemetry Expansion

Add telemetry before or alongside the offensive diversity pass.

#### New counters to add

- `chargedOrbKills`
- `volatileOrbKills`
- `mirrorShieldKills`
- `shieldBurstKills`
- `echoKills`
- `ringKills`
- `kineticFastWindowCharge`
- `kineticSlowWindowCharge`

#### Why this matters

- The current data is not specific enough to tune orbit and shield offense cleanly.
- We need to know which systems are actually carrying damage and economy.

## Recommended Order Of Execution

### Phase 0: Baseline

- Freeze the current telemetry readout as the baseline.
- Keep this document updated as decisions change.
- Confirm which open questions are resolved before code changes start.

### Phase 1: Shot System

- Fix `Spread Shot` combination bug.
- Implement shared volley damage normalization.
- Apply the same normalized damage logic to `Echo Fire`.
- Verify ring and `Front+Back` behavior.

### Phase 2: Charge Economy

- Replace current Kinetic scaling with front-loaded fill behavior.
- Rework cap math so reserve is not fully multiplied.
- Re-evaluate `Charge Cap Up`, `Deep Reserve`, and `Dense Core`.

### Phase 3: Early-Game Pacing

- Tune room 10-15 pressure.
- Re-run telemetry or targeted test cases.
- Confirm early survival improved before adding more boon content.

### Phase 4: Build Diversity

- Add the first orbit/shield offense package.
- Re-tune any underperforming existing orbit/shield boons.
- Expand telemetry to measure kill-source changes.

### Phase 5: Offer Shaping

- Improve early boon presentation and archetype formation.
- Re-check whether runs still feel too binary by room 25.

### Phase 6: Review

- Compare post-pass telemetry against the baseline.
- Decide whether further boon additions are still needed.

## Validation Checklist

Every phase should be checked against the following:

- syntax checks pass
- telemetry fields still serialize cleanly
- no known boon combinations produce unintended bullet counts
- no economy changes create infinite or near-infinite sustain loops
- room 10-15 survival improves without deleting challenge
- non-bullet archetypes show real offensive contribution

## Open Questions To Resolve Before Coding

1. Does `Spread Shot` become a fixed cone pattern, or should it still interact with other lane boons additively?
2. Should ring shots share the same normalized damage pool as forward shots, or use a separate ring-specific rule?
3. Should shield retaliation scale from blocked bullet damage, player damage, or a hybrid?
4. Should orbit offense scale from charge state, absorb events, or player damage multipliers?
5. What is the desired upper band for deep-run max charge after the cap audit?

## Non-Goals For This Pass

- large content rewrite
- major refactor of the room system
- broad visual overhaul
- adding many new legendary chains at once
- changing every boon in the pool

## Working Rule

Do not treat any single balance fix as complete until it has been checked against:

- onboarding health
- charge economy
- bullet-package ceiling
- orbit/shield viability
- telemetry readability

This pass should produce a healthier system, not just a new strongest build.
