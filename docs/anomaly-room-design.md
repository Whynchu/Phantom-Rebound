# Anomaly Room Design

## Goal

Anomaly rooms should make a run feel newly textured without changing the core rule of Phantom Rebound: survive enemy pressure, absorb shots, and clear the room.

The feature should not be a hidden stat bump or a generic score bonus. A player should understand within a few seconds that the room has a different rule and should make a different tactical choice because of it.

## Design Principles

- Keep the core objective intact: every room still ends by clearing enemies.
- Change target priority, positioning, timing, or resource choices.
- Make the rule visible on canvas, not only in text.
- Reward skillful adaptation, but avoid hard fail states that abruptly end a strong run.
- Avoid adding many new enemy classes for the first pass. Prefer temporary room rules layered onto existing enemies.
- Keep mobile readability high: one anomaly rule per room, one primary visual language.

## Candidate Anomalies

### Marked Prey

One enemy receives a clear mark. Killing the marked enemy before any other enemy triggers a strong reward, such as charge refill, shield pulse, bullet clear, or a short damage window.

If another enemy dies first, the mark either jumps to a new target in a weakened state or converts into a smaller consolation reward.

Why it works:
- Creates immediate target priority.
- Still asks the player to clear the room.
- Rewards precision without making the room impossible if the player misses the ideal route.

Risks:
- If the reward is only score, it will feel optional and thin.
- If the marked enemy is too hard to reach, players may ignore the mechanic.

### Hunter Seal

One enemy becomes the room Anchor. While alive, it empowers nearby enemies or interferes with the player.

Possible Anchor effects:
- Nearby enemies gain modest speed.
- Nearby ranged enemies fire slightly faster.
- The player gains less charge near the Anchor.
- The Anchor periodically emits a pulse that pressures movement.

Killing the Anchor releases a tactical reward:
- Clears enemy projectiles in a radius.
- Grants charge.
- Creates a brief slow field.
- Grants a temporary fire-rate or damage window.

Why it works:
- The mark is tactical, not just a bounty.
- Ignoring the Anchor makes the room worse.
- Killing it creates a visible turning point in the room.

Risks:
- Too much aura stacking can become unreadable.
- If the Anchor is always optimal to kill first, it may become rote.

### Pressure Leak

An unstable enemy leaks value when damaged, not only when killed. Hits may release charge sparks, temporary shield energy, or a short local slow.

The player can choose to farm a few hits, but leaving the enemy alive keeps risk on the board.

Why it works:
- Changes damage rhythm.
- Gives multi-hit, pierce, and orb builds a distinct payoff.
- Creates a greedy choice without requiring a separate objective.

Risks:
- Can become exploitable if farming is too safe.
- Needs a cap or decay so the optimal play is not stalling.

### Countdown Target

One enemy carries a visible countdown. Killing it before the timer expires prevents a penalty. If the timer expires, the room continues but gains a burst of pressure.

Possible penalties:
- Spawn one fallback shooter.
- Fire a radial danger burst.
- Trigger a Jammer-style pulse.
- Briefly speed up enemies.

Why it works:
- Adds urgency without failing the room.
- Gives players a concrete short-term objective.
- Fits well with mobile readability if the countdown is simple.

Risks:
- Timer pressure can feel unfair when obstacles or enemy composition block access.
- Needs generous timing at lower rooms.

### Split Mark

Two enemies are linked. Killing one empowers the other unless both die within a short window.

Possible link behavior:
- The survivor gains speed/fire rate.
- The survivor releases a projectile burst.
- The survivor inherits remaining mark reward.

Why it works:
- Changes target planning and damage timing.
- Rewards burst, pierce, and area damage in a way normal rooms do not.

Risks:
- Harder to communicate.
- Can punish low-damage builds if tuned too tightly.

### No Safe Last

The anomaly rule watches the last enemy. If the final enemy is non-projectile support, it mutates or calls in pressure.

Possible behavior:
- A lone support enemy summons a fallback shooter.
- A lone support enemy gains a temporary ranged attack.
- A lone support enemy releases a final pulse and then weakens.

Why it works:
- Turns a known dead-room problem into visible design.
- Makes support enemies feel intentional instead of stalled.

Risks:
- This should not replace the baseline bug fix. The game should still prevent dead rooms even outside anomaly rooms.
- If overused, it may feel like the game is extending rooms artificially.

## Strong First Slice

The best first implementation is probably Hunter Seal, with Marked Prey as the reward structure.

Suggested first pass:
- Starting around room 12, some generated rooms can become anomaly rooms.
- Pick one non-boss enemy as the Anchor after it spawns.
- Draw a distinct ring and pulse around the Anchor.
- While the Anchor is alive, nearby enemies receive one modest pressure buff.
- Killing the Anchor clears enemy projectiles in a radius and grants charge.

This is visible, tactical, and useful for survival. It also avoids making score the main reason to care.

## Jammer Relationship

Jammer should stay, but it needs clearer identity and better support behavior.

Current role:
- Anti-overflow support enemy.
- Slow drifter with an aura that suppresses and drains overflow.

Problems:
- It resembles siphon too closely in broad behavior.
- If it is the last enemy on the field, current shooter-pressure logic can fail to spawn a projectile enemy.

Direction:
- Keep Jammer as the anti-overflow enemy.
- Include Jammer in baseline dry-enemy support logic.
- Consider using Jammer as a possible Anchor effect later, but do not make all anomaly rooms about overflow.

## Open Questions

- Should anomaly rooms be random only, or should some scripted rooms introduce them?
- Should the room title display the anomaly name, or should the first pass rely on canvas language?
- Should anomaly rewards include score immediately, or should score wait until the survival mechanic feels good?
- What is the right unlock point: room 10, 12, or after the first phase enemy?
- Should bosses ever have anomaly escorts, or should boss rooms stay clean?

## Implementation Notes

- Keep anomaly state in a small `src/` module instead of expanding `script.js`.
- Avoid changing enemy definitions unless an anomaly needs persistent metadata.
- Store per-enemy flags such as `isAnomalyAnchor`, `anomalyKind`, and `anomalyMarkedAt` on the live enemy object.
- Keep all effects deterministic enough for coop rollback before enabling anomalies in online runs.
- Add tests around anomaly selection, reward resolution, and the dry-enemy support predicate.

## First Implementation Path

### 1. Baseline Bug Fix

Before adding anomaly rooms, fix support enemies that can strand combat when they are the last enemy alive.

Rule:
- A room with only non-projectile pressure enemies and no active enemy bullets should spawn fallback shooter pressure.

Covered enemy roles:
- Rusher
- Siphon
- Jammer

This must be baseline game logic, not an anomaly-only behavior.

### 2. New Anomaly Module

Create `src/systems/anomalyRooms.js` with pure helpers:

- `shouldRollAnomalyRoom({ roomIndex, isBossRoom, random })`
- `selectAnomalyKind({ roomIndex, random })`
- `selectAnomalyAnchor(enemies, { random })`
- `applyAnomalyAnchor(enemy, anomalyState)`
- `resolveAnomalyAnchorDeath(anomalyState, enemy, ctx)`

The module should not import DOM or canvas APIs. It should return small result objects that `script.js` can apply with existing helpers like charge gain, danger bullet removal, sparks, and damage numbers.

### 3. Run State Shape

Add a small run-level object:

```js
roomAnomaly = {
  active: true,
  kind: 'hunterSeal',
  anchorId: 123,
  rewardClaimed: false,
}
```

Keep the enemy-level marker minimal:

```js
enemy.isAnomalyAnchor = true;
enemy.anomalyKind = 'hunterSeal';
```

### 4. Integration Points

Room start:
- After the room spawn queue is composed, decide whether the room can be anomalous.
- Do not mark an Anchor until at least one eligible enemy has spawned.

Enemy spawn:
- If the current room has an unassigned anomaly, mark the first eligible enemy or choose from the current wave once enough enemies are present.

Enemy update:
- If the Anchor is alive, apply a modest aura effect to nearby enemies.
- Keep first-pass effects simple: speed multiplier or fire-rate pressure only.

Enemy death:
- If the killed enemy is the Anchor, resolve the reward once.
- First reward candidate: clear enemy projectiles in a radius and grant charge.

Drawing:
- Add a visible Anchor ring/pulse near the enemy draw path.
- Do not depend on HUD text for the mechanic to be understood.

### 5. First Slice: Hunter Seal

Recommended first playable version:

- Unlock after room 12.
- Disabled in boss rooms.
- Low roll chance, around 12-15%.
- One Anchor per anomaly room.
- Anchor aura buffs nearby enemies slightly.
- Anchor death clears nearby danger bullets and grants charge.

Why this slice:
- It is visible.
- It changes target priority.
- It creates a room turning point.
- It avoids score-only motivation.
- It can be tuned without adding new enemies.

### 6. Test Targets

Add tests for:

- Boss rooms do not roll anomalies.
- Early rooms do not roll anomalies.
- Anchor selection skips invalid/dead/boss enemies.
- Anchor reward resolves once.
- Aura math does not mutate unrelated enemies unexpectedly.
- Jammer remains covered by fallback shooter pressure.
