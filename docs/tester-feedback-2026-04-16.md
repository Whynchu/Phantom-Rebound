# Tester Feedback - 2026-04-16

## Scope
Consolidated notes from playtest feedback and follow-up implementation tasks.

## Issues and Actions

1. High-speed wall clipping
- Concern: fast movement builds could clip through wall cubes.
- Action: player movement now uses sub-stepped collision checks against wall cubes each frame.
- Status: Implemented.

2. Titan Heart size vs wall windows
- Concern: Titan scaling can exceed intended wall-window readability and traversal constraints.
- Action: Titan Heart size growth now clamps to a max size multiplier (`TITAN_MAX_SIZE_MULT = 2.0`).
- Status: Implemented.

3. Legal wall traversal boon
- Concern: walls should be hard unless a specific boon grants legal passage.
- Action: added `Phase Walk` boon; player wall collision is bypassed only when this boon is active.
- Status: Implemented.

4. Spread Shot underperforming vs Twin Lance
- Concern: Spread Shot is rarely selected and lacks compelling power.
- Action:
  - reduced spread charge burden from +2 to +1 required shots,
  - spread pellets gain +35% damage,
  - spread pellets gain +1 pierce.
- Status: Implemented.

5. Rushers/Disruptors sticking near center walls
- Concern: units can stall against new center geometry.
- Action: increased LOS-blocked flank pressure over time (adaptive boost) for rusher/ranged steering paths.
- Status: Implemented.

6. Enemy naming refactor did not fully land
- Concern: labels such as "Buster" exist in definitions but are not shown in runtime labels.
- Action: enemy label render now prefers `enemy.label` over raw type id.
- Status: Implemented.

## Follow-up Validation
- Run targeted test matrix:
  - high speed + wall corridor,
  - Titan-heavy builds through center window,
  - Spread Shot pickup rates vs Twin Lance,
  - rusher/disruptor wall navigation in center geometry,
  - enemy label consistency across all archetypes.
