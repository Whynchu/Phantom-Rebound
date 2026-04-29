# Early-Game Power Rebalance — Plan

## Problem

Telemetry from `supabase/scores/1.19.32_1.3.0.csv` (75 runs, last 7 days on `1.19.32`):

- **25% of runs end in rooms 6–10** (the first wall), before the room-20 difficulty spike.
- Median run ends at room ~17. Long-tail is healthy: 27% reach room 30+, 11% reach 50+.
- Long-run boon stacking is dominated by **Titan Heart (47 picks across 21 long runs = 2.2/run)** and direct-damage boons (Crit 52, Snipe 44, Pierce 42, Rapid Fire 40).
- Direct-damage boons (Crit, Pierce, Snipe, Rapid Fire) have an **avg first-pick index of 16–22** — they show up *late*. Conditional/scaling boons (Late Bloom, Berserker, Escalation) are picked early but pay off late.

**Diagnosis:** the early wall is a damage-ramp problem, not a difficulty problem. Players in rooms 6–10 only have 2–4 boons and weak T1 effects, while enemy HP has already tripled from base. Late game scales well and shouldn't change.

## Goal

Lift early-game power without trivializing late game. Median run length should drift from ~17 to ~22–25; rooms-50+ percentage stays roughly flat.

## Levers

### 1. Titan Heart nerf
**File:** `src/data/boonConstants.js`

- `TITAN_HP_PCT`: `[1.00, 0.50, 0.25, 0.10, 0.05]` → `[0.50, 0.30, 0.18, 0.10, 0.05]`
- Cumulative HP gain drops from ~+200% → ~+125% over 5 tiers.
- Tier 1 no longer doubles current max HP.
- Damage bonus (+5%/tier), size penalty (+25%/tier), speed penalty (−5%/tier) **unchanged**.

### 2. MINI buff — adds shot speed
**Files:** `src/data/boonConstants.js`, `src/data/boonDefinitions.js`, `src/systems/boonLogic.js`, bullet velocity application site.

- New constant: `MINI_SHOT_SPD_PER_TIER = 0.10`.
- Apply: `upg.miniShotSpdMult = 1 + miniTier * MINI_SHOT_SPD_PER_TIER`.
- Multiply bullet velocity by `miniShotSpdMult` at fire time (multiplicative with `shotSpd`).
- Update boon `desc` and `getActiveBoonEntries`.

### 3. Extra Life serious buff
**File:** `src/data/boonConstants.js`

- `EXTRA_LIFE_GAINS`: `[40, 34, 28, 22, 18, 14]` → `[100, 60, 45, 36, 28, 22]`.
- Tier 1 lifts to **+50% max HP** (+100 over base 200).

### 4. Tier-1 floor bump on direct-damage boons
**File:** `src/data/boonDefinitions.js`

- Bigger Bullets `apply`: `upg.shotSize = getHyperbolicScale(tier) * (tier === 1 ? 1.06 : 1)`
- Faster Bullets `apply`: `upg.shotSpd  = getHyperbolicScale(tier) * (tier === 1 ? 1.06 : 1)`

### 5. Soften enemy HP, rooms 1–8 only
**File:** `src/entities/enemyTypes.js` (~line 89)

```js
const earlyHpEase = roomIndex < 9 ? 0.85 : 1;
const earlyMidHpEase = roomIndex >= 9 && roomIndex < 20 ? 0.88 : 1;
const hpMult = hpScale * earlyHpEase * earlyMidHpEase * room20Mult * midTierHpMult * lateTierHpMult * lateRoomHpMult;
```

Speed untouched.

### 6. MINI enhanced crit
**Files:** `src/data/boonConstants.js`, `src/data/boonDefinitions.js`, `src/systems/boonLogic.js`, crit application sites.

- New constants: `MINI_CRIT_CHANCE_PER_TIER = 0.05`, `MINI_T3_CRIT_DMG_BONUS = 0.20`.
- MINI apply():
  - Add `MINI_CRIT_CHANCE_PER_TIER` to `upg.critChance` (cap 0.95).
  - On reaching tier 3, set `upg.critDamageBonus = MINI_T3_CRIT_DMG_BONUS`.
- Crit damage application: `final = CRIT_DAMAGE_FACTOR * (1 + (upg.critDamageBonus || 0))`.

### 7. Extra Life movement-speed cost
**Files:** `src/data/boonConstants.js`, `src/data/boonDefinitions.js`, player speed chain in `script.js`.

- New constant: `EXTRA_LIFE_SLOW_PER_TIER = 0.98`.
- `upg.extraLifeSlowMult = (upg.extraLifeSlowMult || 1) * EXTRA_LIFE_SLOW_PER_TIER`.
- Multiply into player speed alongside `titanSlowMult`.

### 8. CONDUIT — lightning arcs between orbs (LEGENDARY)
**Files:** `src/data/boonDefinitions.js`, orb runtime + render.

- Tag `LEGENDARY`. Single pick. `requires: upg => upg.orbitSphereTier >= 2`.
- `apply`: `upg.conduit = true`, `upg.conduitArcDmg = 6`, `upg.conduitArcTickMs = 120`.
- Runtime: sort orbs by `orbitAngle`; for each consecutive pair (and wrap last→first if `orbCount >= 3`), define a line segment.
  - For each enemy: if `pointToSegmentDistance <= enemy.r + 6` and `now - (enemy.lastConduitHit ?? 0) >= conduitArcTickMs`, deal `conduitArcDmg` and stamp `lastConduitHit = now`.
  - Same logic for danger bullets — bullets despawn on contact (same per-bullet tick rule).
- Render: jittered cyan polyline between orb positions (3–5 segments, ±2px perpendicular noise re-rolled each frame), additive blend, faint wider underlay glow.
- Pool exclusion: mutually exclusive with Berserker and Titan Heart (any tier). All orb mods stack.
- Telemetry: `runTelemetry.conduit = true`.
- Desc: "Lightning arcs between your orbs, shocking anything caught in the web. Stacks with all orb boons. Exclusive."

### 9. Three new "splitter" boons
**File:** `src/data/boonDefinitions.js`

- **Glass Cannon** (OFFENSE, max 5):
  - Per-tier dmg multipliers compounded into `upg.playerDamageMult`: `[1.10, 1.15, 1.25, 1.35, 1.50]`.
  - Per-tier HP cost: `state.maxHp = Math.max(20, Math.round(state.maxHp * 0.92))`, hp clamped.
- **Adrenal Surge** (SURVIVE, max 4 — stacking cap rises with picks):
  - `upg.adrenalSurgeTier++` (max 4). Cap = tier.
  - On damage intake (excluding shield-only blocked hits): push `now + 4000` to `upg.adrenalStackExpiries`; prune; cap at tier.
  - At fire-time: effective `spsTier = min(SPS_LADDER.length-1, spsTier + activeStackCount)`.
- **Tether Orbit** (UTILITY, single pick, requires `orbitSphereTier > 0`):
  - For each danger bullet, if any orb's distance to the bullet ≤ `orbitRadius`, multiply bullet velocity by 0.80 this frame.

### 10. Extra boon card at room 1
**File:** `src/ui/boonSelection.js`

- When `roomIdx === 1` and not in legendary flow, request **4 choices** instead of 3.

## Out of scope (explicitly preserved)

- Room-20 difficulty spike, triangle bursts, reinforcement cap, MAX_TYPES, boss rooms, late boon weights, legendary gating, enemy speed at any room, all unlisted boons.

## Validation

1. `node scripts\test-systems.mjs` — full suite must pass (59+ tests).
2. `node scripts\test-determinism.mjs` — `pickBoonChoices` determinism with the room-1 4-card path.
3. Visual smoke (hard-refresh `index.html`):
   - MINI: bullets visibly faster, crit chance climbs; T3 crits ~2.88×.
   - Extra Life: HP +100 on T1, movement subtly slower.
   - Titan Heart T1: ~+100 HP at base (was +200).
   - Room 1 clear: 4 boon cards.
   - Rooms 1–8 squishier; rooms 9+ unchanged.
   - 2 orbs + CONDUIT: cyan lightning arcs visible, enemies in orbit ring take steady damage, danger bullets crossing arcs despawn.
   - Glass Cannon, Adrenal Surge, Tether Orbit visibly behave per spec.

## Release

`node scripts\bump-version.mjs <next> "EARLY POWER REBALANCE" --note ...` then commit + push.

## Files touched (summary)

- `src/data/boonConstants.js`
- `src/data/boonDefinitions.js`
- `src/data/boons.js` (barrel)
- `src/systems/boonLogic.js`
- `src/systems/boonHelpers.js`
- `src/sim/outputHitDispatch.js` / `src/systems/outputHit.js` (crit dmg bonus, primary dmg mult)
- `src/sim/playerFireStep.js` / bullet runtime (`miniShotSpdMult`)
- `src/entities/enemyTypes.js` (early HP ease)
- `src/ui/boonSelection.js` (4-card room 1)
- `src/systems/runTelemetryController.js` (new identity flags)
- `script.js` (player speed `extraLifeSlowMult`, CONDUIT runtime + render, Tether Orbit, Adrenal Surge intake)
- `index.html`, `version.json`, `src/data/version.js`, `src/data/patchNotes.js` (via bump-version)
