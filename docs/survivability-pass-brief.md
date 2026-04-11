# Phantom Rebound Survivability Pass Brief

Status: active design brief after `1.16.36` telemetry review and follow-up discussion.

Phase 1 implemented in `1.16.39`:

- base HP raised from `120` to `200`
- `Extra Life` front-loaded to `+40 / +34 / +28 / +22 / +18 / +14`
- `Room Regen` increased to `+18` per pick, capped at `54` per room

Phase 2 implemented in `1.16.40`:

- projectile damage is softened through the early-mid curve, returning to full scaling by room `30`
- follow-up waves now recenter the player, clear stray bullets, and replay the wave-start presentation before the next packet lands

Phase 3 implemented in `1.16.42`:

- `Berserker` is retuned to `50` HP so it remains extreme without feeling invalid against the new base-health floor
- `Recover` now restores `100%`, then `66%`, then `66%` of max HP

## Purpose

This document captures the current balance direction in one place so the next changes stay coherent.

The current goal is not simply to make rooms faster. The goal is to let rooms stay dangerous and sometimes longer while giving the player a much larger and more meaningful mistake budget.

## Core Read

The latest runs point to one main problem:

- the player is too squishy relative to room length

This is more important than raw enemy HP by itself.

Longer rooms are acceptable if:

- the player can survive several mistakes
- defensive picks clearly increase stability
- HP-heavy runs do not still die in effectively 2-3 hits

Longer rooms are not acceptable if:

- each extra 10-20 seconds of room time is just more chances to be deleted
- HP boons inflate the bar without changing real survivability
- defense picks do not noticeably outperform offense-first builds in mistake tolerance

## Telemetry Summary

### What the recent `1.16.36` runs showed

- Rooms `10-20` were still too slow in many non-highroll runs.
- Bosses and pressure rooms in that band often ran into the `25s-60s` range.
- One room-20 triangle boss run lasted `101.7s`, which is far outside the intended target.
- HP-heavy runs still took chunks large enough to erase multiple survivability picks quickly.
- `Extra Life` investment did not reliably convert into several extra mistakes.

### Concrete examples from discussed runs

- Pink run to room 20:
  Rooms `10-19` mostly landed around `24s-33s`.
  Room `20` took `101.7s`.

- Orange run to room 12:
  Room `10` took `60.0s`.
  Room `11` took `42.9s`.

- Blue orbit run to room 22:
  This was one of the healthier runs, but room `11` still took `28.4s`, room `16` took `26.9s`, and room `20` took `26.6s`.

- Pink HP-heavy run:
  Max HP reached `154`, but later projectile chunks still hit for `78`, `96`, `130`, and `148` in individual rooms/bosses.

### Design conclusion from telemetry

The game does not mainly need lower TTK.

It mainly needs:

- higher player survivability
- more meaningful defensive scaling
- a lower lethality-per-mistake curve through early and midgame

## Current Design Direction

### 1. Raise base survivability

Current discussion direction:

- increase base HP from `120` to `200`

Why:

- this raises the baseline mistake budget for every run
- it reduces the need to highroll defense just to survive room pressure
- it supports longer rooms without forcing every balance fix to lower enemy HP

What this implies:

- `Extra Life` must also get larger, or it becomes relatively weaker
- `Room Regen` must likely increase, or it becomes too small to matter against a `200 HP` baseline
- Berserker and similar extreme-survival tradeoffs must be rechecked

### 2. Make raw HP boons actually matter

Current `Extra Life` is too soft for this game shape.

At the moment, the boon gives:

- first pick: `+18`
- second pick: `+16`
- third pick: `+14`

That is not enough if enemy projectile damage can quickly reach chunks large enough to erase those gains.

Planned direction:

- front-load `Extra Life` heavily
- make the first one or two picks create an immediate, obvious difference
- taper later picks so defense can be strong without becoming the only correct path

Design principle:

- the first survivability pick should change how many mistakes the player can survive
- not just make the HP bar cosmetically longer

### 3. Slow damage growth more than HP growth in the midcurve

The rooms can stay slower and denser if the punishment per hit is reduced.

Planned direction:

- flatten projectile damage growth through roughly rooms `8-25`
- keep enemy HP and room pressure meaningful
- let longer rooms feel tense instead of unfair

This is preferable to solving everything by dropping enemy HP because:

- lower HP shortens rooms, but does not fix fragility
- lower damage preserves challenge while giving the player recovery space

### 4. Re-evaluate regen and sustain against the new base

If base HP becomes `200`, then these likely need review:

- `Room Regen`
- `Recover`
- boss heal rewards
- defensive sustain pacing in general

Important distinction:

- sustain should help stabilize long rooms
- sustain should not replace real durability

### 5. Present extra waves as real wave transitions

Rooms with additional waves should not quietly drip more enemies into the current state if that makes the encounter too easy or too exploitable.

Planned direction:

- when a later wave starts, reposition the player to center
- present the new wave as a fresh wave start like the opening presentation
- use that reset to restore encounter clarity and raise challenge

Why:

- current extra-wave flow can be too easy because the player carries momentum, position, and charge state too freely
- a proper wave reset makes rooms read more cleanly and makes each wave feel intentional

Open design caution:

- avoid making this feel like a hard interruption every few seconds
- use it only when the room is meant to be clearly multi-phase

### 6. Keep post-50 boss pacing, but improve wave presentation

Current direction already discussed:

- after room `50`, bosses should appear every `20` rooms instead of every `10`
- those bosses should use larger, more layered escort waves

This works best if multi-wave presentation is also improved, because:

- denser boss content is more readable when waves are clearly staged
- deep bosses should feel like deliberate set pieces, not just one crowded blob

### 7. Avoid a full 10x number rescale

Question discussed:

- would scaling everything by `10` help balance?
- example: start at `1000 HP` instead of `100 HP`

Current conclusion:

- not as a real balance fix

Why not:

- if both HP and damage scale by `10`, the gameplay ratios are unchanged
- the player will still feel just as squishy if the underlying hit-count math stays the same
- it creates large implementation churn without solving the actual balance issue

Potential minor upsides of a 10x scale:

- cleaner-looking bigger numbers in UI
- slightly finer integer tuning if the design wants to avoid decimals

Why it is still not recommended:

- the game already uses fractional charge and telemetry values
- JavaScript handles non-integer internal values fine
- better balance granularity can be achieved by adjusting formulas and rounding behavior directly

Recommendation:

- keep current number scale
- tune around hit counts, room times, and effective HP instead of cosmetic larger numbers

## Desired Feel Targets

### Room-time targets

For healthy runs:

- rooms `1-9`: usually `8s-18s`
- rooms `10-20`: usually `15s-25s`
- pressure rooms and bosses may exceed that, but should not routinely sit in the `30s-60s` range

### Mistake-budget targets

These are more important than raw clear speed.

- Base build in rooms `10-20`:
  should survive about `4-5` projectile hits

- Build with `2-3` defensive picks by rooms `10-20`:
  should survive about `6-8` projectile hits

- Defense-heavy build:
  should clearly trade speed for stability, not die nearly as fast as offense-first runs

### Build-identity targets

- Offense-first:
  faster rooms, lower forgiveness

- Defense-first:
  slower rooms, larger mistake budget

- Hybrid:
  the most stable general-purpose route, but not the fastest or safest extreme

## Proposed Change Bundle

This is the intended bundle for the next survivability-oriented pass.

1. Raise base HP to `200`.
2. Rework `Extra Life` so the first two picks are much larger.
3. Increase `Room Regen` enough to still matter on a `200 HP` baseline.
4. Flatten projectile-damage growth through the early-mid game.
5. Keep enemy HP meaningful unless room times become obviously too slow after survivability changes.
6. Recenter and re-present deliberate follow-up waves.
7. Re-check Berserker, boss heal rewards, and other survival extremes against the new baseline.

## Implementation Order

Recommended sequence:

1. Base HP and HP-boon rebalance.
2. Midcurve projectile-damage flattening.
3. Regen and sustain retune.
4. Multi-wave player recenter + wave presentation.
5. Telemetry review after those changes.

This order matters because:

- Phase 1 now covers items `1-3`.
- Phase 2 now covers projectile-damage flattening and multi-wave recentering.

- survivability changes should be measured before making more room-HP cuts
- otherwise the project risks overcorrecting in both directions at once

## Telemetry Checks After The Pass

After implementation, check:

- room `10-20` clear times across weak, average, and strong runs
- total HP lost by room band
- number of hits taken before death in midgame runs
- whether early `Extra Life` picks visibly increase mistake tolerance
- whether longer rooms feel survivable instead of oppressive
- whether multi-wave rooms feel clearer and harder in the intended way

## Non-Goals

This pass should not:

- solve balance by only lowering enemy HP everywhere
- make defense so strong that offense becomes optional
- use a full 10x stat rescale as a substitute for real tuning
- turn every multi-wave room into a jarring hard reset

## Working Principle

The player should be allowed to make more mistakes.

That is the guiding rule behind this entire pass.

If the game wants longer rooms, more enemies, or more layered wave content, then survivability must scale up enough that the player can actually engage with those systems instead of dying to the first few errors.
