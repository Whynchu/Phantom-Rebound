// Older notes archived in patchNotesArchive.js. Only the 50 most recent entries are loaded in-client.

const PATCH_NOTES_RECENT = [
  {
      version: '1.7.0',
      label: 'DAMAGE READOUT',
      summary: ['Damage numbers now render larger and more readable above enemies and players.'],
      highlights: [
        'Charged Orbs were softened so they scale more sanely from the player\'s build.',
      ]
    },
  {
      version: '1.6.2',
      label: 'ORB SAFETY 2',
      summary: ['Fixed the Charged Orbs crash by moving the shared player-damage baseline into the right scope.'],
      highlights: [
        'Orb safety guards remain in place so malformed values won\'t take down the frame.',
      ]
    },
  {
      version: '1.6.1',
      label: 'ORB SAFETY',
      summary: ['Charged Orbs now have extra safety guards so malformed damage values can\'t crash the frame.'],
      highlights: [
        'Orb volleys still scale from the player\'s build, but they stay below the main shot baseline and remain readable.',
      ]
    },
  {
      version: '1.6.0',
      label: 'ORB READABILITY',
      summary: ['Charged Orbs now scale from the player\'s real shot damage, but hit a bit lighter than the main gun.'],
      highlights: [
        'Orbit spheres now show a readiness ring so their shot timing is readable at a glance.',
      ]
    },
  {
      version: '1.5.5',
      label: 'RELEASE NOTES',
      summary: [
        'This is the big 1.4.x-to-1.5.x balance pass: damage now feels wider, crit builds are cleaner, and the whole curve has been rebuilt around stronger floor and ceiling control.',
        'The reward menu now shows your live combat stats under HP, while movement and shot pacing were raised to make the game feel sharper at the new baseline.',
      ],
      highlights: [
        'Player damage now rolls in a wider band instead of clustering around one narrow number, so weak and strong shots both read more clearly.',
        'Damage boons now have clearer jobs: some raise the top end, some raise the floor, and Glass Cannon now pushes both.',
        'Crit now starts at 5% and crit damage is a separate capped stat, so crit builds scale harder without turning every setup into a guaranteed crit machine.',
        'Enemy shots also roll damage in a range now, and the curve was softened so the early and mid game feel fairer.',
        'Movement speed is now 225 by default and bullet speed is now 275 by default, which gives the game a tighter, more aggressive feel.',
        'The color-based enemy names were normalized into Phase and Omega families, including Shotbuster, Phase Shotbuster, and Omega Shotbuster.',
      ]
    },
  {
      version: '1.5.4',
      label: 'BASE SPEEDS',
      summary: ['Raised the player base movement speed to 225 and base shot speed to 275.'],
      highlights: [
        'Player crit now starts at 5% so reward stats and combat match the same baseline.',
      ]
    },
  {
      version: '1.5.3',
      label: 'REWARD STATS',
      summary: ['Reward menu now shows live damage, crit, move speed, and bullet speed under HP.'],
      highlights: [
        'Damage display uses the same variance and crit math as combat.',
      ]
    },
  {
      version: '1.5.2',
      label: 'GLASS CANNON',
      summary: ['Glass Cannon now raises the damage floor too, not just the ceiling.'],
      highlights: [
        'First pick is stronger and the damage ladder is more aggressive.',
      ]
    },
  {
      version: '1.5.1',
      label: 'PHASE SHOTBUSTER',
      summary: ['Renamed color-based enemy variants to phase and omega naming.'],
      highlights: [
        'Added shotbuster family naming and normalized burst helpers.',
      ]
    },
  {
      version: '1.5.0',
      label: 'BOSS SIZE',
      summary: ['Move the release line to 1.5.x and shrink bosses about 10% so they fit the wall structure better.'],
      highlights: [
        'Move the release line to 1.5.x and shrink bosses about 10% so they fit the wall structure better.',
      ]
    },
  {
      version: '1.4.19',
      label: 'ENEMY CURVE',
      summary: ['Slightly soften the enemy damage curve while keeping the new random damage band, so early hits land closer to 17-28 by room 10 and around 40-70 by room 50.'],
      highlights: [
        'Slightly soften the enemy damage curve while keeping the new random damage band, so early hits land closer to 17-28 by room 10 and around 40-70 by room 50.',
      ]
    },
  {
      version: '1.4.18',
      label: 'ENEMY DAMAGE RANGE',
      summary: ['Enemy projectile damage now rolls in a visible range before room and boss multipliers are applied, so early hits read more like 10-18 instead of a single fixed number.'],
      highlights: [
        'Enemy projectile damage now rolls in a visible range before room and boss multipliers are applied, so early hits read more like 10-18 instead of a single fixed number.',
      ]
    },
  {
      version: '1.4.17',
      label: 'CEILING TUNE',
      summary: ['Retune the main damage ceiling boons so they push top-end damage harder without broadening the floor: stronger Heavy Rounds, sharper Dense Core, and a more explosive Glass Cannon.'],
      highlights: [
        'Retune the main damage ceiling boons so they push top-end damage harder without broadening the floor: stronger Heavy Rounds, sharper Dense Core, and a more explosive Glass Cannon.',
      ]
    },
  {
      version: '1.4.16',
      label: 'DAMAGE RANGE',
      summary: ['Widen the early damage band to 5-12, add separate boons for top-end damage and floor smoothing, and split crit damage into its own lower-starting capped stat.'],
      highlights: [
        'Widen the early damage band to 5-12, add separate boons for top-end damage and floor smoothing, and split crit damage into its own lower-starting capped stat.',
      ]
    },
  {
      version: '1.4.15',
      label: 'LEADERBOARD FALLBACK',
      summary: ['Retry the legacy leaderboard RPC signature when the new prefix-based function is not yet deployed, so the leaderboard screen falls back cleanly instead of surfacing a 404.'],
      highlights: [
        'Retry the legacy leaderboard RPC signature when the new prefix-based function is not yet deployed, so the leaderboard screen falls back cleanly instead of surfacing a 404.',
      ]
    },
  {
      version: '1.4.14',
      label: 'LEADERBOARD COHORT',
      summary: ['Keep 1.4.x leaderboard entries together so 1.4.8 scores remain visible after later experimental updates.'],
      highlights: [
        'Keep 1.4.x leaderboard entries together so 1.4.8 scores remain visible after later experimental updates.',
      ]
    },
  {
      version: '1.4.13',
      label: 'PICKUP POP',
      summary: ['Added a brighter bubbly pickup sound for grey absorbs and orb absorbs.'],
      highlights: [
        'Raised the procedural SFX mix so the retro audio reads more clearly in playtests.',
      ]
    },
  {
      version: '1.4.12',
      label: 'LOUDER POP',
      summary: ['Raised the procedural SFX mix after the first playtest.'],
      highlights: [
        'Added distinct player damage sounds for melee contact and danger bullet hits.',
      ]
    },
  {
      version: '1.4.11',
      label: 'RETRO POP',
      summary: ['Added the first procedural retro SFX pass for ghost shots, enemy shots, wall bounces, and target splats.'],
      highlights: [
        'Lowered the overall SFX mix so the shot loop starts softer for playtesting.',
      ]
    },
  {
      version: '1.4.10',
      label: 'PERF COPY',
      summary: ['Made performance export copy resilient when the browser blocks clipboard access.'],
      highlights: [
        'Made performance export copy resilient when the browser blocks clipboard access.',
      ]
    },
  {
      version: '1.4.9',
      label: 'PERF PROBE',
      summary: ['Added browser-console performance export for 5-room profiling sessions.'],
      highlights: [
        'Reduced repeated enemy flank line-of-sight scans while held path choices are active.',
      ]
    },
  {
      version: '1.4.8',
      label: 'GLOW DRIFT',
      summary: ['Player movement now has slight inertia so control feels less instant and more tense.'],
      highlights: [
        'Player and danger projectiles have a stronger readability glow, with player shots rendering larger without changing hitboxes.',
      ]
    },
  {
      version: '1.4.7',
      label: 'ESCORT BLINK',
      summary: ['Boss escorts are back, but melee escorts now blink and stay harmless for their first second.'],
      highlights: [
        'The late-room shooter fallback remains intact when only melee pressure is left.',
      ]
    },
  {
      version: '1.4.6',
      label: 'LATE GAME',
      summary: ['Late-room reinforcement pop-in is gone; pressure shifts into sturdier enemy HP instead.'],
      highlights: [
        'Boss escort respawns and reinforcement trickle are disabled in later rooms so pacing stays cleaner.',
      ]
    },
  {
      version: '1.4.5',
      label: 'FLAWLESS',
      summary: ['Flawless rooms now pay out a much larger room-clear bonus.'],
      highlights: [
        'Damageless clears are meant to stand out more sharply on the score curve.',
      ]
    },
  {
      version: '1.4.4',
      label: 'DODGE TICK',
      summary: ['Live dodge score now ticks on near-miss instead of waiting for room clear.'],
      highlights: [
        'Room-clear bonuses stay deferred; dodge is no longer double-awarded at room end.',
      ]
    },
  {
      version: '1.4.3',
      label: 'HOTFIX',
      summary: ['The HUD score now counts up rapidly during the room instead of waiting for the end-of-room summary, while the final score still stays exact.'],
      highlights: [
        'The HUD score now counts up rapidly during the room instead of waiting for the end-of-room summary, while the final score still stays exact.',
      ]
    },
  {
      version: '1.4.2',
      label: 'HOTFIX',
      summary: ['Online coop guests no longer run the legacy slot-1 movement loop, which restores host-side motion and prevents the guest from fighting its own prediction path.'],
      highlights: [
        'Online coop guests no longer run the legacy slot-1 movement loop, which restores host-side motion and prevents the guest from fighting its own prediction path.',
      ]
    },
  {
      version: '1.4.1',
      label: 'HOTFIX',
      summary: ['Leaderboard run summaries now accept boon data from nested picks, flat boon arrays, or boonIds so loadouts render reliably.'],
      highlights: [
        'Leaderboard run summaries now accept boon data from nested picks, flat boon arrays, or boonIds so loadouts render reliably.',
      ]
    },
  {
      version: '1.14.0',
      label: 'REBOUND BUMP',
      summary: ['Shots now start with one wall bounce by default, and Ricochet adds another bounce instead of merely enabling the mechanic.'],
      highlights: [
        'Shots now start with one wall bounce by default, and Ricochet adds another bounce instead of merely enabling the mechanic.',
      ]
    },
  {
      version: '1.3.12',
      label: 'HOTFIX',
      summary: ['Shots now start with one wall bounce by default, and Ricochet adds another bounce instead of merely enabling the mechanic.'],
      highlights: [
        'Shots now start with one wall bounce by default, and Ricochet adds another bounce instead of merely enabling the mechanic.',
      ]
    },
  {
      version: '1.3.11',
      label: 'HOTFIX',
      summary: ['Moving now clears stored fire timer progress, so Twin Lance cannot bank a hidden follow-up shot while strafing.'],
      highlights: [
        'Moving now clears stored fire timer progress, so Twin Lance cannot bank a hidden follow-up shot while strafing.',
      ]
    },
  {
      version: '1.3.10',
      label: 'HOTFIX',
      summary: ['The charge ring now fills again at normal SPS, while only the full-charge glow stays locked to exact max charge.'],
      highlights: [
        'The charge ring now fills again at normal SPS, while only the full-charge glow stays locked to exact max charge.',
      ]
    },
  {
      version: '1.3.9',
      label: 'HOTFIX',
      summary: ['Payload-ready ring now uses the opposite tint on the normal ring, and tether ring slows enemy shots without freezing them.'],
      highlights: [
        'Payload-ready ring now uses the opposite tint on the normal ring, and tether ring slows enemy shots without freezing them.',
      ]
    },
  {
      version: '1.3.8',
      label: 'HOTFIX',
      summary: ['Payload-ready ring now uses the player color, and full-charge glow/size only triggers at exact max charge.'],
      highlights: [
        'Payload-ready ring now uses the player color, and full-charge glow/size only triggers at exact max charge.',
      ]
    },
  {
      version: '1.3.7',
      label: 'HOTFIX',
      summary: ['Softened the Gravity Well II and Tether Orbit interaction so ranged enemies keep moving instead of appearing frozen.'],
      highlights: [
        'Softened the Gravity Well II and Tether Orbit interaction so ranged enemies keep moving instead of appearing frozen.',
      ]
    },
  {
      version: '1.3.6',
      label: 'ROOM LAYOUTS',
      summary: ['Leaderboards now open a full run summary with your score breakdown and boon loadout.'],
      highlights: [
        'Rooms use the same layout scale on every device, with several layouts rotating through each run.',
      ]
    },
  {
      version: '1.3.5',
      label: 'LEADERBOARD COOP TOGGLE',
      summary: ['Leaderboard now shows up to 100 results (was 10).'],
      highlights: [
        'New Solo / Co-op toggle on the leaderboard screen — co-op runs are tracked separately.',
        'Co-op runs now submit to the leaderboard (each player gets their own entry tagged co-op).',
        'Supabase: leaderboard_scores gains a run_mode column; submit_score / get_leaderboard accept p_run_mode. Migration in supabase/leaderboard.sql.',
      ]
    },
  {
      version: '1.3.4',
      label: 'EARLY POWER HOTFIX',
      summary: ['Fixed a crash that could end a run immediately after it began, including some orb-heavy setups.'],
      highlights: [
        'Room 1 is still a 3-choice boon pick; the early power rebalance remains otherwise intact.',
      ]
    },
  {
      version: '1.3.3',
      label: 'EARLY POWER FOLLOW-UP',
      summary: ['Fixed a bug that could end a run immediately after starting.'],
      highlights: [
        'The room-1 boon picker is back to 3 choices, while the rest of the early power rebalance stays in place.',
      ]
    },
  {
      version: '1.3.2',
      label: 'EARLY POWER REBALANCE',
      summary: ['The opening stretch of a run should feel stronger and more flexible now. Early rooms are a little softer, your first boon pick gives you more options, and several survival picks have been retuned to create clearer build identities.'],
      highlights: [
        'Room 1 now offers 4 boon cards, rooms 1-8 are a bit less tanky, Titan Heart is less of an automatic best pick, MINI now boosts shot speed and crits, and Extra Life gives a much bigger HP jump in exchange for a slight speed loss.',
        'New build splitters: Glass Cannon, Adrenal Surge, Tether Orbit, and CONDUIT.',
      ]
    },
  {
      version: '1.3.1',
      label: 'PROJECTILE FIXES',
      summary: ['Fixed Volatile Rounds child bullets re-hitting the enemy that triggered the split.'],
      highlights: [
        'Kept triangle burst projectiles dangerous after wall-adjacent splits instead of immediately turning into grey pickups.',
      ]
    },
  {
      version: '1.3.0',
      label: 'CO-OP MODE',
      summary: ['MAJOR UPDATE: Full co-op multiplayer implementation. Play with a partner over the internet in real-time. Hosts create rooms via Supabase; guests join via code. All game features (boons, enemies, rooms, bosses, scoring) now support 2-player simultaneous gameplay with low-latency synchronization.'],
      highlights: [
        'Supabase real-time sessions: host creates runId via postCoopRun(); guests join via joinCoopRun(runId). Automatic cleanup and state tracking.',
        'H1+H2 hybrid authority: host runs full simulation and broadcasts snapshots at 10Hz. Guest runs local prediction for movement + cosmetics; receives authoritative state from host for collision/damage/room events.',
        'Smooth 60fps rendering on guest: per-frame interpolation sweeps between 10Hz snapshots; no jitter or frame freezing.',
        'Network-resilient architecture: guest auto-syncs on snapshot arrival; room phase advances independently of snapshot timing; automatic peer-to-peer input relay via Supabase.',
        'Full feature parity: all 50+ boons, all enemy types and room progressions, boss mechanics, shields, orbs, legendary sequences — all work seamlessly in co-op.',
        'Visual sync: partner colors override (guest sees host in correct color), cosmetic sync (shields, orbs, hats, damage numbers), charge ring animation, enemy windup rings, shockwave effects.',
        'Spectator mode: defeated players spectate their partner at 30% opacity with frown expression while the partner continues playing.',
        'Score tracking: per-player room scores, combo chains, boon selections, and run statistics synced across peers and persisted to Supabase.',
      ]
    },
];

const PATCH_NOTES = PATCH_NOTES_RECENT.slice(0, 50);

const PATCH_NOTES_ARCHIVE_MESSAGE = 'In-client notes show the 50 most recent updates. Older builds were not archived in this panel.';

export { PATCH_NOTES, PATCH_NOTES_ARCHIVE_MESSAGE };
