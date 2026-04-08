const PATCH_NOTES = [
  {
    version: '1.16.14',
    label: 'MENU FIT FOLLOW-UP',
    summary: [
      'This follow-up tightens two archive-style overlays on shorter phones. The patch notes panel now sits at the full shell level instead of stopping at the canvas boundary, and the leaderboard title scales down more aggressively on smaller screens so the heading no longer overpowers the viewport.'
    ],
    highlights: [
      'Patch Notes now extends through the full available shell height instead of leaving the lower HUD visible beneath it.',
      'The Leaderboards heading now scales responsively and steps down further in compact and tight viewport modes.'
    ]
  },
  {
    version: '1.16.13',
    label: 'DARK BACKDROP RESTORE',
    summary: [
      'This is a presentation follow-up to the small-iPhone fit patch. The responsive sizing changes stayed in place, but the outer app backdrop was pulled back to a solid dark base so Safari and browser chrome no longer read as bright or washed out around the game shell.'
    ],
    highlights: [
      'Restored a solid dark root and body background behind the app shell.',
      'Keeps the 1.16.12 viewport-fit changes without the lighter browser-facing backdrop.'
    ]
  },
  {
    version: '1.16.12',
    label: 'SMALL IPHONE FIT',
    summary: [
      'This follow-up patch tightens the mobile shell for shorter iPhones and Safari chrome-heavy layouts. The game canvas now sizes itself against both width and available height instead of assuming a comfortable vertical budget, which prevents the stack from overcommitting space on smaller screens.',
      'The UI also gains compact viewport modes that only activate on shorter devices, so the typography and shell spacing step down when needed without shrinking the whole presentation for larger phones.'
    ],
    highlights: [
      'Canvas sizing now respects vertical viewport budget as well as width.',
      'Shorter iPhones get compact and tight layout modes instead of relying on browser text-size reduction.',
      'Safe-area padding and shell usage were adjusted so the browser view feels less letterboxed.'
    ]
  },
  {
    version: '1.16.11',
    label: 'THREAT ROTATION + BOON SURGE',
    summary: [
      'This update rebuilds the threat-color system around a single rotated baseline instead of per-color exceptions. The green-mode relationship is now the source of truth, and every other player color shifts the full threat stack by the same hue offsets, which keeps danger, advanced, and elite stages aligned no matter which ghost color is selected.',
      'It also pushes a broad power pass across the boon ecosystem so more picks can compete with the strongest lane-clearing builds. Charge economy, crit scaling, shield tech, orbit tech, vampiric synergies, actives, and several underperforming offensive follow-ups were all raised together, while a few long-standing behavior mismatches like Spread Shot ammo ordering and Fracture only splitting into two were corrected in runtime.'
    ],
    highlights: [
      'Threat colors now rotate as a full set from the player hue, fixing palette collisions like the cyan readability issue and restoring the intended staged elite progression.',
      'Spread Shot now counts correctly for shot economy and enemy grey drops, and low-ammo cone shots fire center-first instead of left-first.',
      'Dense Core was heavily buffed, including a stronger per-tier multiplier and a bigger one-cap desperation spike.',
      'Large boon uplift pass: Rapid Fire, Critical Hit, Quick Harvest, Charge Cap Up, Deep Reserve, Kinetic Harvest, shield boons, Charged Orbs, Escalation, Refraction, Mirror Tide, Phase Dash, Overload, vampiric synergies, and several follow-up effects were all raised.',
      'Fracture now actually fires 3 split bullets in gameplay instead of behaving like a 2-way split despite the card text.'
    ]
  },
  {
    version: '1.16.4',
    label: 'BALANCE PASS',
    summary: [
      'This build is a direct balance response to late-run telemetry showing that a few stacked systems were overwhelming the room curve long before enemy pressure had a chance to matter. The reserve economy was pulled back so oversized charge pools stop snowballing into permanent uptime, Deep Reserve and Charge Cap Up now top out far earlier, Kinetic Harvest grants flat movement charge instead of multiplying off giant reserves, and Dense Core no longer turns low-cap builds into quite such a reckless damage spike.',
      'The passive safety package was also tightened so survival tools stay valuable without quietly becoming a second primary weapon. Mirror Shield countershots and Aegis Nova bursts now fire as partial-damage responses instead of full-value inherited offense, Charged Orbs fire more slowly, Volatile Orbs have both longer recovery and a shared detonation lockout, and rooms above 80 now answer back with more elites, faster firing enemies, denser reinforcement flow, and a stronger late-game health and speed ramp.'
    ],
    highlights: [
      'Reserve growth reduced: Charge Cap Up is +15% per pick with a hard ceiling, and Deep Reserve now grows slower and caps at +180 flat charge.',
      'Dense Core damage was lowered, the one-cap desperation spike was reduced, and movement charging no longer scales off max charge.',
      'Mirror Shield, Shield Burst, and Aegis Nova still work, but they no longer get to act like free full-power copies of the main gun.',
      'Room 80+ and 120+ now scale harder through elite chance, firing cadence, on-screen count, and reinforcement timing.'
    ]
  },
  {
    version: '1.16.3',
    label: 'HAPPY EASTER',
    summary: [
      'The bloom system was expanded from a single runaway power pick into a cleaner trio of mutually exclusive long-run identities. Late Bloom stayed as the damage route, Swift Bloom became the movement route, and Guard Bloom became the defensive route, with each version carrying a small downside so the payoff reads as a deliberate build direction instead of a free universal upgrade.',
      'This gave long runs a more readable arc. If a run is scaling damage, speed, or defense hard into the late rooms, the player can now see exactly which bloom path is doing the work, what the tradeoff is, and why that build lane was chosen instead of the others.'
    ],
    highlights: [
      'Added three exclusive bloom variants: power, speed, and defense.',
      'Each bloom now carries a subtle tax so the choice has texture instead of only upside.',
      'The active-boon display reports the current bloom bonus and its attached drawback.'
    ]
  },
  {
    version: '1.16.2',
    label: 'THREAT CLEANUP',
    summary: [
      'This patch focused on readability, threat identity, and pruning mechanics that were muddying the arena instead of strengthening it. Transmute and Pulse Mine were removed from the ecosystem, enemy families were pushed back onto the shared hue-shift rules so the selected player color consistently creates the intended visual offset across mobs and hostile projectiles, and triangle shots were enlarged to read faster under pressure.',
      'It also cleaned up a dangerous edge case where triangle wall bursts were visually breaking into harmless-looking grey shots even though they were supposed to stay threatening. Those spawned shots now keep their danger state, which keeps the combat language cleaner and prevents the game from teaching the wrong visual rule.'
    ],
    highlights: [
      'Removed Transmute and Pulse Mine from the boon pool.',
      'Forced enemy and projectile threat palettes to respect the player-color offset everywhere they should.',
      'Triangle projectiles were made larger and their wall-burst followups now remain active danger bullets.',
      'Mirror Tide and Phase Dash were converted into room-limited abilities with cooldowns, preventing infinite abuse loops.'
    ]
  },
  {
    version: '1.16.1',
    label: 'HP COLOR',
    summary: [
      'This update was small but important for cohesion. The player HP presentation stopped using the same hard-coded green for every run and began inheriting the currently selected player accent instead, which keeps the HUD aligned with the chosen character color and makes the whole run presentation feel more intentional.',
      'The warning readability was preserved, so medium and critical health still transition into the existing caution colors rather than becoming too decorative to parse in motion.'
    ],
    highlights: [
      'Player HP now inherits the active player color instead of defaulting to green.',
      'Low-health warning states still shift into yellow and red for clarity.'
    ]
  }
];

const PATCH_NOTES_ARCHIVE_MESSAGE = 'In-client notes currently begin at v1.16.1. Older builds were not archived in this panel.';

export { PATCH_NOTES, PATCH_NOTES_ARCHIVE_MESSAGE };
