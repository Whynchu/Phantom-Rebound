# Legendary Overhaul Implementation Plan

Status: ready to implement

Goal: make every legendary boon feel like a distinct late-run choice, with a unique trigger, a visible payoff, and a role that does not overlap too hard with the others.

## What is already locked in

These three are already on the right track and should stay as anchors:

- `Phantom Rebound`: projectile geometry into charge economy
- `CONDUIT`: orbit density into a lightning web
- `Colossus`: max HP into area control

Do not reopen those unless telemetry shows a real regression.

## Implemented In This Branch

- `Blood Moon`: now adds short-lived kill stacks that convert kills into extra charge and decay after 4 seconds.
- `Void Walker`: now applies a real void-zone slow field to danger bullets while the zone is active.
- `Corona`: now builds flare stacks on ring kills and erupts in a localized burst on the third stack.
- `Tether Orbit` / `CONDUIT` / `Colossus`: still hold their identity roles from the earlier pass.

## Design rules

1. Every legendary must answer a different gameplay question.
2. Every legendary must have one primary trigger and one primary payoff.
3. Avoid generic "just add more damage" tuning unless damage is the secondary effect of a unique loop.
4. Keep the payoff visible in normal play, not only in perfect builds.
5. Keep the implementation in small tickets that a low-context model can complete safely.

## Legendary identity map

### `Phantom Rebound`

- Trigger: wall-bounce geometry
- Promise: shots become a charge economy engine
- Role: benchmark legendary for late-run scaling
- Status: keep as-is

Why it works:

- It changes shot routing and resource flow at the same time.
- It is not a generic damage steroid.
- It stays relevant in long runs without being passive.

### `CONDUIT`

- Trigger: orbit density
- Promise: orbs form a damage web
- Role: orb-capstone legendary
- Status: implemented, keep wording and telemetry only unless data says otherwise

Why it works:

- It gives the orbit package a clear endgame.
- It is distinct from `Tether Orbit`, which is now utility-only.

### `Colossus`

- Trigger: taking damage at high max HP
- Promise: durability converts into space control
- Role: Titan capstone legendary
- Status: implemented, keep as an identity anchor

Why it works:

- It makes max HP matter in combat, not just on the HUD.
- It gives the Titan path a real "hit me and you pay for it" fantasy.

### `Bulwark` `(internal id: aegisTitan)`

- Trigger: shield state and shield break timing
- Promise: shields become retaliation and burst control
- Role: shield-capstone legendary

Distinct identity:

- This should be about blocking, countering, and shield timing.
- It should not drift into the same space as `Colossus`, which is HP-driven control.

Plan:

- Keep the core shield fantasy.
- Improve text so the player understands it is a shield timing legendary, not a general defense boost.
- If telemetry shows it is underpicked, improve the shield-specific payoff before adding raw stats.

### `Ghost Flow`

- Trigger: movement and absorb uptime
- Promise: moving well turns absorb into economy
- Role: mobility / absorb capstone legendary

Distinct identity:

- This should reward clean movement and near-miss play.
- It should not become another flat sustain pick.

Plan:

- Keep the speed-to-absorb loop as the core.
- Make the payoff visible if players do not notice it during normal runs.
- Do not convert it into a damage legendary.

### `Corona`

- Trigger: ring-shot density
- Promise: radial shots become a dedicated loop
- Role: ring-build capstone legendary

Distinct identity:

- This is the radial-geometry legendary.
- It must not feel like a second `Phantom Rebound`.

Plan:

- Implemented: ring kills build flare stacks and the third stack erupts in a localized burst.
- Keep it ring-specific.
- If it underperforms, tune the flare burst before adding generic damage.
- Make the charge refund / pierce loop readable in the boon text.

### `Final Form`

- Trigger: critical low HP
- Promise: clutch mode becomes a run-shaping spike
- Role: death-defiance / execute legendary

Distinct identity:

- This is the "I am strongest when I should be dead" legendary.
- Its current issue is not the fantasy, it is the narrow window.

Plan:

- Keep the big low-HP spike.
- Consider a smaller pre-threshold benefit so it feels less binary.
- Do not move it toward a passive stat legendary.

### `Blood Moon`

- Trigger: kills during the active loop
- Promise: kills turn into room tempo and sustain
- Role: vampire / kill-chain legendary

Distinct identity:

- This needs a visible room-shaping payoff.
- Sustain alone is not enough for a legendary.

Plan:

- Implemented: kills add short-lived charge stacks.
- Keep the healing and grey-bullet drops.
- Avoid a flat damage bonus as the primary upgrade.

### `Void Walker`

- Trigger: dash / phase movement
- Promise: movement creates temporary space control
- Role: evasion / zone-control legendary

Distinct identity:

- This should feel like a movement-to-control conversion.
- It should not become a second damage aura.

Plan:

- Implemented: void zone now visibly slows danger bullets.
- Only add enemy slow if bullet control alone is not enough.
- Keep the movement fantasy intact.

## Implementation order

### Ticket 0: baseline audit and text sync

Scope:

- Confirm each legendary description matches the actual runtime behavior.
- Update any stale active-detail text.
- Make sure the boon card text names the identity clearly.

Files:

- `src/data/boonDefinitions.js`
- `src/systems/boonLogic.js`

Acceptance:

- Every legendary card says what it is for.
- No legendary description promises a loop it does not actually have.

### Ticket 1: lock the stable legendaries

Targets:

- `Bulwark` `(internal id: aegisTitan)`
- `Ghost Flow`
- `Final Form`

Scope:

- Text polish first.
- Behavior change only if a clear gap shows up in playtest or telemetry.
- Keep these as separate choice lanes instead of folding them into other capstones.

Acceptance:

- Each one has a distinct identity statement.
- No overlap with `Colossus`, `CONDUIT`, or `Phantom Rebound`.

### Ticket 2: Blood Moon pressure conversion

Goal:

- Give `Blood Moon` a visible kill-chain payoff.

Preferred direction:

- Kills during `Blood Moon` create a short-lived stack or burst window.
- Stacks should improve room tempo, not just raw damage.

Files to inspect:

- `src/data/boonDefinitions.js`
- `src/systems/boonLogic.js`
- `src/systems/boonHelpers.js`
- live kill handling in `script.js`
- sim kill handling in `src/sim/`

Acceptance:

- `Blood Moon` still heals and drops grey bullets.
- The boon now feels like a room-tempo engine.
- It does not become "generic damage but red."

### Ticket 3: Void Walker zone control

Goal:

- Make the void zone obviously control space.

Preferred direction:

- Bullet slow first.
- Enemy slow second only if needed.

Files to inspect:

- `src/systems/dangerHit.js`
- `src/sim/dangerHitDispatch.js`
- live danger-bullet loop in `script.js`

Acceptance:

- The zone is visibly useful without needing a perfect setup.
- Dash behavior itself remains unchanged.

### Ticket 4: telemetry pass

Goal:

- Measure whether the legendaries now split into distinct pick patterns.

Check:

- legendary pick frequency
- room depth when each legendary is picked
- late-run survival and room clear speed
- whether any legendary still behaves like an obviously weaker version of another one

Files/data:

- `supabase/scores/`
- run telemetry payloads

Acceptance:

- Do not tune numbers again until there is fresh run data.
- Use the next pass to decide whether `Bulwark` `(internal id: aegisTitan)`, `Ghost Flow`, or `Final Form` need real behavior work.

## Non-negotiables

- Preserve `Phantom Rebound`.
- Preserve the current `CONDUIT` and `Colossus` direction.
- Do not make every legendary a damage steroid.
- Keep each change small enough for a low-context implementation model.
- Run `node scripts\test-systems.mjs` after each code ticket.
- Bump version and add patch notes before pushing.
