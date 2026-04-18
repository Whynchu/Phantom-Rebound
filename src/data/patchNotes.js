const PATCH_NOTES = [
  {
    version: '1.16.88',
    label: 'HATS UI POLISH',
    summary: [
      'The hats flow is tighter and more readable now: the menu ghost fills its preview box better, the hats picker is a compact centered modal with mini previews, Patch Notes now links to contributors, and the Viking helm silhouette reads more sharply.'
    ],
    highlights: [
      'The start-menu ghost preview is zoomed in to use more of the preview frame.',
      'The Hats picker is now a small centered modal instead of a full-screen sheet.',
      'Hat rows now include small hat renders next to each option name.',
      'Patch Notes now includes a Contributors button listing current playtesters.',
      'Viking helm horns now use a sharper triangular silhouette with a more upward outward angle.'
    ]
  },
  {
    version: '1.16.87',
    label: 'HAT PREVIEW HOTFIX',
    summary: [
      'The menu ghost preview now uses the real in-game ghost renderer at an idle baseline, and the Hats button opens a visible overlay instead of only dropping menu chrome.'
    ],
    highlights: [
      'The start-screen preview now calls the same ghost draw path used in gameplay instead of a separate stylized preview render.',
      'The preview now starts from the default ghost state instead of looking like a scaled-up late-run build.',
      'The Hats panel now has its own overlay stacking layer so opening it reliably shows the selector.'
    ]
  },
  {
    version: '1.16.86',
    label: 'HATS + GHOST PREVIEW',
    summary: [
      'The main menu now has a live ghost preview and a first-pass hat system, so cosmetics can be selected up front and rendered both in the menu and in live gameplay.'
    ],
    highlights: [
      'Added a new live ghost preview under the title on the main menu.',
      'Added a dedicated Hats panel with saved local selection state.',
      'The old bunny ears are now a real hat option instead of a seasonal hardcoded layer.',
      'Added first-pass Viking Helm cosmetic rendering for both menu preview and gameplay.'
    ]
  },
  {
    version: '1.16.85',
    label: 'PAYLOAD BLAST RETUNE',
    summary: [
      'Payload explosions now start much wider and read far more clearly in combat, so the boon immediately feels like splash damage instead of a tiny impact pop.'
    ],
    highlights: [
      'Payload base blast radius was increased substantially, with much larger gains from Payload Bloom tiers.',
      'The payload radius cap was raised so larger builds can keep scaling into visibly large explosions.',
      'Impact feedback now uses a dedicated explosion burst instead of only a small spark puff, making the blast obvious on contact.'
    ]
  },
  {
    version: '1.16.84',
    label: 'TELEMETRY + CHARGE TUNING',
    summary: [
      'This balance-and-analysis pass makes generated room layouts visible in exported telemetry, lowers base Zoner room cost so it can appear in more mixed waves, gives Capacity Boost real early impact, and reworks Dense Core into a four-tier high-risk curve.'
    ],
    highlights: [
      'Room telemetry now records each room layout source, a compact composition summary, and the raw wave entries chosen by generation.',
      'Telemetry snapshots now capture charge-cap state every room, including current charge, cap boon tiers, and Dense Core state.',
      'Base Zoner spawn budget cost was lowered so generated rooms can fit it into more compositions.',
      'Capacity Boost now gives +16% base charge cap per pick with a minimum +2 charge floor per pick before flat reserve bonuses.',
      'Dense Core now runs on explicit four-tier targets: x1.45 / x2.00 / x2.50 / x2.85 damage with 75% / 50% / 25% / 5% max-charge scales.'
    ]
  },
  {
    version: '1.16.83',
    label: 'SCREENSHOT ICON UPDATE',
    summary: [
      'The Safari/Home Screen icon set now derives from a direct in-game screenshot instead of a reconstructed ghost illustration, with a light contrast pass to keep the background darker.'
    ],
    highlights: [
      'Web-app icons now use `assets/icons/new_icon.jpg` as the source image.',
      'The icon generator applies a mild tonal adjustment so the background drops darker while preserving the captured ghost.',
      'The screenshot source is now intended to live alongside the generated icon outputs for future refreshes.'
    ]
  },
  {
    version: '1.16.82',
    label: 'SETTINGS RING PREVIEW FIX',
    summary: [
      'The settings preview now composes Phase and Omega as a smaller filled center plus visible ring layers inside one fixed buster-sized circle instead of collapsing the rings into the fill.'
    ],
    highlights: [
      'Phase and Omega preview swatches now use a separate inner body element rather than a full-size solid fill.',
      'The preview ring layers now occupy the rest of the same outer circle size, matching the intended read of center-plus-rings.',
      'This fixes the missing-ring look in the settings menu without changing the actual gameplay sizing.'
    ]
  },
  {
    version: '1.16.81',
    label: 'ICON + RING GEOMETRY',
    summary: [
      'Phase and Omega now visibly partition their fixed-size circle into a smaller center plus ring layers, and the Safari/Home Screen icon set has been regenerated from the same ghost construction the game actually draws.'
    ],
    highlights: [
      'Ringed busters and ringed bullets now reserve explicit interior space for the center fill, so the ring layers are clearly visible inside the same outer diameter.',
      'The runtime ring geometry now behaves as center-plus-rings instead of a nearly full-size core with rings competing on top.',
      'Web-app icons were regenerated from the in-game ghost body shape and palette logic instead of a separate icon illustration.',
      'Added a local icon generator script so future icon updates stay tied to the game art language.'
    ]
  },
  {
    version: '1.16.80',
    label: 'WEB APP ICONS',
    summary: [
      'Added proper Home Screen / web-app icon metadata and a new ghost-on-dark icon set so Safari-installed builds stop falling back to the generic letter tile.'
    ],
    highlights: [
      'Added Apple touch icon metadata and standalone web-app tags in the document head.',
      'Added a site manifest with 192px and 512px app icons.',
      'Added a new ghost-on-dark icon set for Safari Home Screen and browser favicon usage.',
      'Icon URLs are cache-busted with the current build number so refreshed installs pick up the new assets more reliably.'
    ]
  },
  {
    version: '1.16.79',
    label: 'RING ART HOTFIX',
    summary: [
      'Phase and Omega ring art now stays inside the normal buster silhouette and uses the same color as the enemy or bullet body instead of expanding outward with a separate white ring treatment.'
    ],
    highlights: [
      'Ringed busters now keep the same overall outer circle size as the regular buster.',
      'Ring markers now use the same color as the rest of the enemy body and bullet body.',
      'The solid center shrinks inward to make room for rings instead of making the sprite larger.',
      'Settings preview now reflects the same in-body ring treatment.'
    ]
  },
  {
    version: '1.16.78',
    label: 'OVERLOAD + THREAT TUNE',
    summary: [
      'Overload now converts the full stored bank into a properly scaled giant volley, threat ring counts now match remaining active wall bounces exactly, and the settings preview shows the newer enemy and harvest-shot artwork.'
    ],
    highlights: [
      'Overload damage now scales from the real charge it consumes instead of spending a full bank for near-normal output.',
      'Overload projectile size now scales from 2x to 4x depending on how large the consumed full-charge bank is.',
      'Phase-family enemies and bullets now show one ring, Omega shows two, and the ring count drops based on remaining live bounces rather than total lifetime bounces.',
      'Settings preview now includes the updated Phase/Omega enemy ring treatment and a hollow harvest bullet preview.',
      'Room 11 now guarantees at least one Phase Buster so that threat family appears on time.'
    ]
  },
  {
    version: '1.16.77',
    label: 'THREAT READABILITY + SCROLL FIX',
    summary: [
      'Danger and harvest projectile states now read more clearly in motion, bounce-cap enemies expose their ricochet tier with ring markers, and vertically scrollable run/leaderboard panels work again on touch devices.'
    ],
    highlights: [
      'Harvest bullets now render as hollow circles instead of filled dots so inactive pickup states separate more cleanly from live danger shots.',
      'Live danger bullets got a stronger glow pass, while bounce-cap bullets now draw ring markers that count down as wall bounces are spent.',
      'Bounce-cap circle enemies now mirror that ring language so Buster variants communicate their ricochet tier before they fire.',
      'Gesture guards now allow native vertical scrolling inside leaderboard, patch notes, and boon list panels instead of suppressing all touch-drag input.'
    ]
  },
  {
    version: '1.16.76',
    label: 'COLOR ASSIST SETTINGS',
    summary: [
      'Added a first-pass accessibility settings panel with standard color assist modes that remap the live gameplay palette instead of applying a screen filter.'
    ],
    highlights: [
      'Main menu now includes a dedicated settings button that opens a menu overlay for accessibility controls.',
      'Added standard color assist presets for Protanopia, Deuteranopia, and Tritanopia, plus Off.',
      'Color assist now flows through the shared gameplay palette so player theme, enemy tiers, hostile bullets, and UI accents stay in sync.',
      'Added a live comparison preview in settings for the player, core enemy families, elite threat color, and danger-shot color.',
      'Documented the broader accessibility follow-up roadmap for contrast, non-color identity cues, and QA.'
    ]
  },
  {
    version: '1.16.75',
    label: 'LATE ROOM TUNING',
    summary: [
      'Phase Walk no longer supports indefinite wall camping, and room 40+ pacing has been shifted modestly away from cheap enemy floods toward sturdier premium threats.'
    ],
    highlights: [
      'Phase Walk now behaves as a short wall breach: lingering inside cover for too long or idling inside it forces an eject back into legal space.',
      'Initial room spawns now respect the intended on-screen enemy cap instead of front-loading oversized first waves.',
      'Post-40 wave budget growth has been softened and spawn weighting now leans a bit less toward cheap enemies, without overcorrecting room density.',
      'Triangles and double-bounce late threats now get extra HP scaling so fewer enemies can carry more of the room difficulty.'
    ]
  },
  {
    version: '1.16.74',
    label: 'PATHING + UX HOTFIX',
    summary: [
      'Enemy wall movement has been normalized and stabilized, gravity well now behaves like a temporary field slow instead of a permanent projectile shred, and several UI/UX edge cases were cleaned up.'
    ],
    highlights: [
      'Blocked enemies now move from a single normalized intent vector instead of stacking chase, strafe, and obstacle pushes into accidental speed boosts.',
      'Wall pathing now holds a side decision briefly so enemies route more smoothly toward line-of-sight or melee contact around center cover.',
      'Gravity well now slows danger bullets only while they remain in range, then smoothly restores them toward their original speed after they leave the field.',
      'Hardened iOS gesture guards against remaining loupe/selection edge cases by clearing stray selections and suppressing non-input touch-move gestures.',
      'Removed duplicate Gravity Well and Blood Moon entries from active boon lists.'
    ]
  },
  {
    version: '1.16.73',
    label: 'HOMING SPEED HOTFIX',
    summary: [
      'Fixed a projectile-speed mismatch where homing output bullets could lose Faster Bullets and Snipe-derived speed while tracking targets.'
    ],
    highlights: [
      'Homing speed clamp now uses the same launch-speed basis as fired player shots.',
      'The clamp now includes global speed lift, Faster Bullets scaling, and Snipe speed scaling.',
      'This should remove the false impression that higher Pierce tiers are disabling Faster Bullets on surviving shots.'
    ]
  },
  {
    version: '1.16.72',
    label: 'RANGED FIRE HOTFIX',
    summary: [
      'Ranged enemies now keep their firing cadence while afraid, so close-pressure chases and wall pins no longer suppress shots.'
    ],
    highlights: [
      'Removed fear-based fire timer clamp that could prevent ranged enemies from reaching windup/fire thresholds.',
      'Removed fear-range fire gate so ranged units shoot as soon as their timer and lane conditions are ready.',
      'Fear behavior now affects movement only; firing reliability remains consistent under pressure.'
    ]
  },
  {
    version: '1.16.71',
    label: 'POINTER POLISH',
    summary: [
      'The live aim marker is now a clean equilateral triangle that matches the selected player theme color at 60% opacity for better visual consistency.'
    ],
    highlights: [
      'Replaced the previous pointer shape with an equilateral triangle aim indicator.',
      'Aim marker color now uses the active player theme (`C.green`) so it always matches the selected color.',
      'Pointer opacity tuned to 60% for subtle readability without clutter.'
    ]
  },
  {
    version: '1.16.70',
    label: 'AIM CLARITY PASS',
    summary: [
      'Auto-targeting now softly prefers clear line-of-sight targets when wall cover creates near-tie distance cases, and the ghost now shows a subtle live aim arrow for better shot readability.'
    ],
    highlights: [
      'Added a soft LOS penalty to auto-target scoring so blocked targets can lose to nearby hittable targets without forcing strict LOS priority.',
      'Player aim direction is now tracked continuously in combat based on the selected auto-target.',
      'Added a small animated aim arrow near the ghost to show current aim direction at a glance.'
    ]
  },
  {
    version: '1.16.69',
    label: 'TESTER PASS',
    summary: [
      'This pass addresses the latest tester batch: hardened wall interactions, Titan sizing constraints, Spread Shot viability, wall-pathing behavior, and enemy naming display consistency.'
    ],
    highlights: [
      'Player wall collision now uses sub-stepped movement to prevent high-speed clipping; wall cubes now occupy full grid cells.',
      'Added Phase Walk boon for legal wall passage, and capped Titan Heart size growth to preserve center-window traversal.',
      'Spread Shot reworked: lower shot tax, higher spread pellet damage, and extra spread pierce so it can compete with Twin Lance.',
      'Rusher/disruptor LOS-blocked flanking pressure increased to reduce wall sticking around center cover.',
      'Enemy nameplates now prefer defined labels (for example Buster) instead of raw type ids.',
      'Added a tester feedback tracker document in docs for this review pass.'
    ]
  },
  {
    version: '1.16.68',
    label: 'FEAR HOTFIX',
    summary: [
      'Fixes a close-range ranged-enemy freeze where units caught near firing threshold could lock up and neither fire nor move until distance reopened.'
    ],
    highlights: [
      'Fear-range logic now suppresses windup state so close-pressure enemies remain mobile.',
      'Ranged fire timers are clamped under fear conditions to prevent windup lock at point-blank distance.',
      'LOS + fear behavior now transitions cleanly between evasive movement and firing prep.'
    ]
  },
  {
    version: '1.16.67',
    label: 'FLANK HOTFIX',
    summary: [
      'Enemy lane-hunting now pushes harder around cover, and aimed shooters bias toward clearer firing angles so wall cubes are harder to cheese.'
    ],
    highlights: [
      'LOS-blocked ranged enemies now build flank pressure over time and commit harder to angle-chasing.',
      'Aimed enemy shots now search nearby aim offsets and prefer trajectories less likely to clip wall cubes.',
      'Double-bounce and standard aimed shots both use the clear-lane angle solver before spread is applied.'
    ]
  },
  {
    version: '1.16.66',
    label: 'LOS HOTFIX',
    summary: [
      'Fixes a wall-awareness regression where LOS-blocked enemies could lock into windup behavior and visually scale forever instead of repositioning.'
    ],
    highlights: [
      'Ranged enemies no longer enter persistent windup when they do not have a firing lane.',
      'LOS-blocked fire timers are clamped to keep enemies in reposition behavior.',
      'Enemy windup swell visuals are now hard-clamped to prevent runaway size growth.'
    ]
  },
  {
    version: '1.16.65',
    label: 'HUNT LINES',
    summary: [
      'Enemies now respond to wall geometry instead of blindly pathing, with non-melee units showing stronger fear behavior when the ghost closes in.'
    ],
    highlights: [
      'Ranged enemies now evaluate line-of-sight around obstacle cubes and reposition to find firing lanes.',
      'Non-melee enemies enter a stronger close-range fear state and disengage until they regain distance.',
      'Obstacle steering was added so enemies slide around walls instead of stalling into them.'
    ]
  },
  {
    version: '1.16.64',
    label: 'GRID COVER',
    summary: [
      'Rooms now include subtle grid-aligned wall cubes from room 1 onward, adding hard cover and lane control so combat has more spatial texture.'
    ],
    highlights: [
      'Added obstacle cubes that block movement for players and enemies.',
      'Projectiles now collide with obstacle cubes and bounce using the core bounce runtime.',
      'Bullet motion now sub-steps during long frames to prevent tunneling through wall cubes.'
    ]
  },
  {
    version: '1.16.63',
    label: 'PAYLOAD BLOOM',
    summary: [
      'Payload now has a larger default blast radius, and a new Payload Bloom boon can push that area wider in tiers so the payoff feels like an explosion instead of a point-blank pop.'
    ],
    highlights: [
      'Payload explosions now use a larger default AoE and scale with bullet size.',
      'Added Payload Bloom as a tiered follow-up boon for bigger blasts.',
      'Explosion feedback now scales a bit with the blast so larger payloads read better in combat.'
    ]
  },
  {
    version: '1.16.62',
    label: 'ROOM PREVIEW',
    summary: [
      'Room openers now expose enemy layout during READY so players can parse the map before combat starts. The first wave is pre-placed for readability, but no combat actions occur until the intro completes.'
    ],
    highlights: [
      'First-wave enemies now spawn during READY/BOSS intro instead of appearing only at GO.',
      'Enemy AI and firing remain inactive during intro, preserving a true read phase.',
      'Player auto-fire and orb offensive systems are also gated until combat starts.'
    ]
  },
  {
    version: '1.16.61',
    label: 'SURVIVAL READABILITY',
    summary: [
      'This pass improves survival readability and progression clarity. MINI is now a tiered path instead of a one-time binary pick, and the ghost HP bar now scales with max HP so tankier builds read correctly in combat.'
    ],
    highlights: [
      'MINI now has 3 stages (max tier 3) instead of a single one-time pickup.',
      'Each MINI tier now applies -20% size and -10% max HP, with tier shown in active boons.',
      'Player HP bar length now scales with max HP so high-HP builds visibly carry a larger bar.'
    ]
  },
  {
    version: '1.16.60',
    label: 'READABILITY PASS',
    summary: [
      'This pass improves combat readability by preventing enemy bodies from stacking into a single unreadable blob. Enemy and boss units now resolve overlap continuously so threat count and spacing stay legible during dense rooms.'
    ],
    highlights: [
      'Added enemy-to-enemy collision separation so standard mobs no longer overlap each other.',
      'Bosses and escorts now also separate instead of occupying the same visual space.',
      'Separation is resolved during combat updates to keep spacing clear as waves evolve.'
    ]
  },
  {
    version: '1.16.58',
    label: 'ENGINEERING STABILIZATION',
    summary: [
      'This follow-up targets iOS interaction reliability. Double-tap/selection gesture guards were hardened to suppress the native loupe behavior during gameplay, and keyboard-open viewport handling was stabilized to reduce layout jumps and black overlay artifacts when entering callsigns.'
    ],
    highlights: [
      'Added stronger double-tap and selection suppression outside form fields for iOS Safari gameplay interactions.',
      'Added keyboard-open viewport handling to avoid aggressive resize recalc while text inputs are focused.',
      'Disabled heavy backdrop effects while keyboard is open to avoid visual artifacts during callsign entry.'
    ]
  },
  {
    version: '1.16.57',
    label: 'ENGINEERING STABILIZATION',
    summary: [
      'This experimental-channel build continues the architecture audit work so future gameplay changes are safer to ship. Combat side effects were further split out of the main loop, and player-color persistence was moved out of data modules so core imports stay Node-safe for tooling and tests.'
    ],
    highlights: [
      'Extracted output-kill reward action derivation into systems helpers, reducing one of the largest inline side-effect blocks in `script.js`.',
      'Extracted mirror-shield reflection and shield-burst projectile spec builders into defense runtime helpers.',
      'Removed player-color localStorage coupling from data modules; color persistence now initializes and saves through runtime/platform storage flow.'
    ]
  },
  {
    version: '1.16.51',
    label: 'ENGINEERING STABILIZATION',
    summary: [
      'This release is an architecture checkpoint focused on long-term development velocity. Core gameplay math and runtime state handling were split into dedicated system modules, UI rendering responsibilities were moved out of the main entrypoint, and platform concerns are now routed through explicit adapters.'
    ],
    highlights: [
      'Added dedicated systems modules for sustain, scoring, projectile damage, and spawn-budget generation.',
      'Moved HUD and leaderboard rendering into isolated UI modules to reduce `script.js` blast radius.',
      'Added release verification scripts and centralized storage/leaderboard controller adapters for safer pushes.'
    ]
  },
  {
    version: '1.16.50',
    label: 'SUSTAIN BRAKE',
    summary: [
      'This pass hits lifesteal much harder and raises the overall arena tempo again. The shared room sustain budget is substantially tighter now, Blood Pact is brought under that same cap instead of bypassing it, and the global gameplay lift is pushed up to 145%.'
    ],
    highlights: [
      'Global gameplay speed increased from 120% to 145%.',
      'Vampiric/Blood Moon room sustain cap is cut much lower than before.',
      'Blood Pact healing now also consumes the same room sustain budget.'
    ]
  },
  {
    version: '1.16.49',
    label: 'LATE HP LIFT',
    summary: [
      'Enemy health is now pushed harder from room 40 onward. This is layered on top of the 120% speed lift and the deep-run sustain brake so late rooms stop evaporating under low-charge high-damage builds that were still overperforming deep into endless progression.'
    ],
    highlights: [
      'Enemy HP scaling is increased specifically for rooms 40+.',
      'Rooms 60, 80, 100, 120, and 160+ all get a stronger late-health multiplier than before.',
      'This ships together with the unpushed deep-run sustain cap, late boss structure pass, and 120% gameplay speed lift.'
    ]
  },
  {
    version: '1.16.48',
    label: 'SPEED LIFT',
    summary: [
      'Global gameplay speed is now lifted to 120%. This raises the overall tempo of movement, bullet travel, and encounter flow on top of the deep-run sustain and boss-room corrections.'
    ],
    highlights: [
      'Global gameplay speed increased from 107% to 120%.',
      'Player movement, enemy motion, and projectile pacing all inherit the faster lift.',
      'This ships together with the unpushed deep-run sustain cap and late-boss structure pass.'
    ]
  },
  {
    version: '1.16.47',
    label: 'DEEP RUN BRAKE',
    summary: [
      'This pass targets the late-run runaway you described: kill-heal sustain is now room-capped so giant HP pools cannot refill indefinitely, and post-50 boss rooms are rebuilt as single dense set-pieces instead of staged wave chains. Room 100 is now a special double-boss spike with doubled boss stats and damage.'
    ],
    highlights: [
      'Vampiric and Blood Moon kill-heal now share a per-room sustain cap.',
      'Boss rooms now land at 50, 70, 90, 100, then every 20 rooms from 120 onward.',
      'Room 100 now spawns two bosses at once with double boss health, double fire speed, and double projectile damage.'
    ]
  },
  {
    version: '1.16.46',
    label: 'RUN CLOCK FIX',
    summary: [
      'This hotfix corrects the new run clock so it actually advances during play. The HUD and leaderboard time display were wired correctly, but the live elapsed-time counter was not ticking in the main update loop.'
    ],
    highlights: [
      'Live run timer now increments during gameplay as intended.',
      'Top HUD room/time display now updates in real time.',
      'Leaderboard runtime entries continue to use the same stored timer field.'
    ]
  },
  {
    version: '1.16.45',
    label: 'RUN CLOCK',
    summary: [
      'The run timer is now surfaced wherever it helps compare pacing. The top HUD shows live elapsed time beside the room number, and leaderboard rows now show run duration when that data exists on the entry.'
    ],
    highlights: [
      'Top HUD now shows room and live run time together.',
      'Leaderboard entries now display recorded run time when available.',
      'Older leaderboard rows remain compatible and simply omit the time if it was never stored.'
    ]
  },
  {
    version: '1.16.44',
    label: 'SCORE CADENCE',
    summary: [
      'Scoring now rewards progression with cadence-based bonuses instead of only raw kill value. Every five cleared rooms grants a checkpoint bonus that blends pace and damage avoidance, and the top HUD now shows live run time beside the current room.'
    ],
    highlights: [
      'Every 5-room checkpoint now grants a score bonus based on clear speed and avoided damage.',
      'Damageless rooms inside that 5-room block add extra consistency score.',
      'The top HUD now shows room number and live run time together.'
    ]
  },
  {
    version: '1.16.43',
    label: 'BOSS SCAR TUNING',
    summary: [
      'Boss clears now permanently tighten the ghost’s post-hit invulnerability for the rest of the run. The intent is to let early survivability stay forgiving while making deep runs feel sharper and less reset-heavy after repeated boss wins.'
    ],
    highlights: [
      'Each boss clear reduces post-hit invulnerability for the rest of the run.',
      'Contact-hit invulnerability shrinks from 1.0s toward a 0.45s floor.',
      'Projectile-hit invulnerability shrinks from 1.2s toward a 0.6s floor.'
    ]
  },
  {
    version: '1.16.42',
    label: 'BERSERKER FLOOR',
    summary: [
      'This cleanup pass retunes the remaining survival outliers after the HP-floor and wave-staging changes. Berserker stays an extreme glass-cannon path, but it is no longer pinned to the old 10-HP world, and Recover now returns enough HP to matter on the larger health pools.'
    ],
    highlights: [
      'Berserker now sets max HP to 50 instead of 10.',
      'Recover now heals 100%, then 66%, then 66% of max HP.',
      'These are cleanup changes on top of the recent survivability floor and projectile-curve work.'
    ]
  },
  {
    version: '1.16.40',
    label: 'SURVIVABILITY STAGING',
    summary: [
      'This follow-up pass keeps the higher player HP floor in place while smoothing the early-mid projectile damage curve and turning extra-wave rooms into real wave transitions. Follow-up packets now reset the player to center and replay the intro treatment instead of quietly spilling in on top of solved positioning.'
    ],
    highlights: [
      'Projectile damage is softened through the early-mid rooms, then returns to full scaling by room 30.',
      'Later waves now recenter the player and clear stray bullets before the next packet starts.',
      'Queued spawns no longer leak the next wave into the current one before the wave transition happens.'
    ]
  },
  {
    version: '1.16.39',
    label: 'SURVIVABILITY FLOOR',
    summary: [
      'This pass raises the player survivability floor instead of only chasing faster clears. Base HP is now much higher, Extra Life is front-loaded so early defense picks actually change a run, and Room Regen scales high enough to matter on the new baseline.'
    ],
    highlights: [
      'Base HP increased from 120 to 200.',
      'Extra Life now grants +40, +34, +28, +22, +18, then +14 max HP.',
      'Room Regen now grants +18 HP per pick and caps at 54 HP per room.'
    ]
  },
  {
    version: '1.16.38',
    label: 'DANGER OVERLAY',
    summary: [
      'Enemy bullets now render on a top pass above the ghost and orbit visuals. This is a readability change only, but it should make live threats much easier to track during dense rooms and boss patterns.'
    ],
    highlights: [
      'Danger bullets now draw above the player sprite.',
      'Orbit spheres and shields no longer visually bury live hostile projectiles.',
      'No gameplay balance values changed in this patch.'
    ]
  },
  {
    version: '1.16.37',
    label: 'MIDCURVE EASE',
    summary: [
      'Rooms 10-20 were still asking for too much damage unless a run spiked early. This pass eases enemy HP in that middle band while keeping the post-20 pressure curve intact, and fixes triangle burst shots so their split danger balls only need one wall hit before turning grey.'
    ],
    highlights: [
      'Enemy HP is softened specifically through rooms 10-20.',
      'Room 21+ keeps the stronger late-pressure scaling from the previous pass.',
      'Triangle boss split shots now grey out on the first wall bounce consistently.'
    ]
  },
  {
    version: '1.16.36',
    label: 'PLAYER FIRE PRIORITY',
    summary: [
      'Charged Orbs now reserve charge for the ghost before spending any overflow. This keeps the main weapon responsive on still-fire builds instead of letting orbit timers steal the last usable shot.'
    ],
    highlights: [
      'Still-fire now reserves the player weapon charge budget before Charged Orbs can spend reserve.',
      'Orb shots only consume overflow charge after the ghost has enough banked to fire.',
      'This mainly affects orbit builds with low charge caps or wide player shot patterns.'
    ]
  },
  {
    version: '1.16.35',
    label: 'BOSS CADENCE PASS',
    summary: [
      'Generated room composition and post-50 boss pacing both needed cleanup. This pass removes the dead-feeling siphon-only room shape, favors more versatile mixed packs, and changes deep-run bosses to arrive every 20 rooms with layered escort waves instead of the old every-10 cadence.'
    ],
    highlights: [
      'Generated waves now heavily downweight siphon spam and inject more versatile enemy mixes when siphons appear.',
      'Spawn queue timing now respects delayed wave entries, enabling actual multi-wave boss rooms.',
      'After room 50, bosses now appear every 20 rooms and bring larger, more complex escort waves.'
    ]
  },
  {
    version: '1.16.34',
    label: 'LATE PRESSURE PASS',
    summary: [
      'Follow-up telemetry made it clear that late rooms were not compounding threat hard enough, even after the orb and vampiric fixes. This pass raises enemy health density earlier, expands generated wave budgets, and increases sustained concurrency so deep runs stop flattening into low-risk sustain loops.'
    ],
    highlights: [
      'Enemy HP scaling now ramps much harder from room 20 onward and accelerates again in deep rooms.',
      'Generated non-boss waves gain more budget and more enemy-type variety as rooms climb.',
      'Late-room reinforcements, on-screen caps, and boss escort respawns all tighten to keep pressure active.'
    ]
  },
  {
    version: '1.16.33',
    label: 'ORB DRAIN HOTFIX',
    summary: [
      'This telemetry fix closes two runaway sustain loops and hardens the live run update path. Charged Orbs now spend reserve before firing, Blood Pact can only restore a limited amount per projectile, and malformed bullet entries are pruned before they can crash the frame update.'
    ],
    highlights: [
      'Charged Orbs now require available charge and log their reserve spend into telemetry.',
      'Blood Pact is capped at 1 heal per piercing bullet, with Blood Moon raising that cap to 2.',
      'The bullet update loop now removes invalid entries instead of crashing on `b.state` access.'
    ]
  },
  {
    version: '1.16.32',
    label: 'ORB SHOT LINE',
    summary: [
      'Charged Orbs now have a small dedicated modifier line instead of depending entirely on their base shot. This gives orbit builds a clearer late-game growth path without handing orbs the full player gun package.'
    ],
    highlights: [
      'Added Orb Twin for a 2-shot orb fork with controlled total-damage scaling.',
      'Added Orb Pierce so charged orb shots can pass through one extra enemy.',
      'Added Orb Overcharge so orb-shot damage scales much harder from current charge state.'
    ]
  },
  {
    version: '1.16.31',
    label: 'BUILD DIVERSITY PASS',
    summary: [
      'This systems pass attacks the run-shape problems exposed by recent telemetry. Multi-shot bullet builds now have a capped total-damage curve, Kinetic Harvest refills the front of the bar quickly instead of collapsing under reserve, early first-boss pressure is smoother, and orbit/shield archetypes gained their first real offensive payoffs.'
    ],
    highlights: [
      'Shot-count damage is now normalized by emitted volley size, and Spread Shot no longer overproduces bullets with Twin Lance.',
      'Charge Cap Up and Deep Reserve were rebuilt so reserve adds after scaling, while Kinetic Harvest now uses a front-loaded fast-fill window that shrinks on larger pools.',
      'Room 10-15 pressure was softened, Orbital Focus boosts orbit damage from charge state, and Aegis Battery turns ready shields into stronger retaliation plus periodic offensive bolts.'
    ]
  },
  {
    version: '1.16.30',
    label: 'BLOOM START 15',
    summary: [
      'Bloom variants now begin scaling earlier in runs. The growth curve starts at room 15 instead of room 30 so bloom choices matter sooner while keeping the same soft-cap shape.'
    ],
    highlights: [
      'Late Bloom and Swift Bloom now scale from room 15-45, then 45-75, then 75+.',
      'Guard Bloom uses the same earlier curve and now starts defensive scaling at room 15.',
      'Boon descriptions were updated to match the new room breakpoints.'
    ]
  },
  {
    version: '1.16.29',
    label: 'LOW CAP KINETIC',
    summary: [
      'Kinetic Harvest now helps low-cap builds more directly. Its movement charge gain scales up when the current max charge only holds a small number of volleys, then fades back to the base rate for large reserve builds.'
    ],
    highlights: [
      'Kinetic Harvest can reach up to 1.75x movement charge gain when the charge cap is tight.',
      'The bonus scales from the current max charge relative to required shots, so wide or Dense Core-style low-cap builds benefit most.',
      'Telemetry snapshots now record the effective Kinetic Harvest rate, including the low-cap bonus and Flux State multiplier.'
    ]
  },
  {
    version: '1.16.28',
    label: 'PHASE DASH GRAZE',
    summary: [
      'Phase Dash now behaves like an emergency graze instead of a full damage delete. It still moves the player out of danger, but the triggering hit now deals a small amount of damage so repeated dashes cannot erase pressure entirely.'
    ],
    highlights: [
      'Phase Dash now takes 5% of the normal projectile hit damage when it triggers.',
      'The dash still moves the player away, consumes a room use, and grants its brief invincibility window.',
      'Titan Heart HP growth was restored to the previous curve; the size tradeoff remains the balancing cost.'
    ]
  },
  {
    version: '1.16.27',
    label: 'SWEEP ECONOMY TUNE',
    summary: [
      'This balance pass responds to room-108 telemetry from v1.16.26 where a wide-shot sustain build could keep clearing while wasting thousands of charge. The main fix limits enemy death drops so one kill cannot refund an entire late-game volley.'
    ],
    highlights: [
      'Enemy death grey drops now scale more gently with shot count and cap at 5.',
      'Charge reserve growth, Quick Harvest, Kinetic Harvest, and Vampiric Return were tightened.',
      'Rooms 80+ and 100+ add slightly more reinforcement pressure and late enemy scaling.'
    ]
  },
  {
    version: '1.16.26',
    label: 'SCORE SUBMIT HOTFIX',
    summary: [
      'This hotfix restores normal death score submission after the diagnostics split. The death path was building a valid score entry, but the remote submit call referenced a stale player-color variable name and was being caught as a diagnostic crash.'
    ],
    highlights: [
      'Death score submissions now send the player color from the completed score entry.',
      'Normal deaths should return to the leaderboard path instead of the crash-diagnostic path.',
      'No gameplay balance values changed in this hotfix.'
    ]
  },
  {
    version: '1.16.25',
    label: 'MOBILE LOAD HOTFIX',
    summary: [
      'This hotfix addresses a mobile black-screen load caused by a newly added diagnostic export living in a child module that some mobile browsers could keep cached across deploys.'
    ],
    highlights: [
      'Crash diagnostics no longer require a new named import from the leaderboard service module.',
      'The top-level cache-busted game script now owns the diagnostic upload path, avoiding stale child-module import failures.',
      'No gameplay balance values changed in this hotfix.'
    ]
  },
  {
    version: '1.16.24',
    label: 'CRASH DIAGNOSTICS',
    summary: [
      'This follow-up removes the unfinished-run recovery loophole from the prior stability pass. Refreshing, backgrounding, or closing the browser no longer banks a live run, and crash data now uses a separate diagnostics path instead of the leaderboard score path.'
    ],
    highlights: [
      'Removed active-run autosave and startup autosubmit so refresh cannot preserve or bank an unfinished run.',
      'Game-loop crashes now capture a local diagnostic report and attempt to upload it to a separate Supabase diagnostics table.',
      'Only actual deaths submit leaderboard scores.'
    ]
  },
  {
    version: '1.16.23',
    label: 'RUN RECOVERY',
    summary: [
      'This stability pass protects mobile runs from silent canvas-loop freezes. Active runs now save a lightweight local recovery snapshot during play and on page hide, and the game loop now catches runtime failures so a frozen run can still be preserved with score, room, boons, and telemetry.'
    ],
    highlights: [
      'Active runs now save local recovery snapshots every few seconds.',
      'If the game loop crashes while the page UI still works, the run is converted into a recovered score entry instead of disappearing.',
      'Recovery payloads include the active room telemetry snapshot when the freeze happens.'
    ]
  },
  {
    version: '1.16.22',
    label: 'GLOBAL SPEED LIFT',
    summary: [
      'This balance-feel pass keeps the new arena size and enemy density intact, but raises the overall game tempo slightly. Player movement, enemy movement, hostile bullets, and player output projectiles all move about 7% faster, making rooms feel more active without adding more bodies to the arena.'
    ],
    highlights: [
      'Applied a 7% global speed lift across movement and projectile travel.',
      'Enemy density and reinforcement counts were intentionally left unchanged.',
      'No direct boon power reductions were applied in this patch.'
    ]
  },
  {
    version: '1.16.21',
    label: 'OFFENSE TELEMETRY',
    summary: [
      'This telemetry follow-up adds the missing context needed to identify intentionally suppressed offense and passive-clear loops. Runs now record shots fired, charge spent and wasted, kill source, and movement time while enemies are alive and charge is available.'
    ],
    highlights: [
      'Room telemetry now records shots fired, charge spent, charge wasted at cap, output kills, and orbit kills.',
      'Room telemetry now records movement/no-fire time so balance analysis can spot runs where the player is trying not to attack.',
      'No gameplay balance values changed in this patch.'
    ]
  },
  {
    version: '1.16.20',
    label: 'TELEMETRY TIMER FIX',
    summary: [
      'This hotfix corrects the room telemetry timer units. Room timers were already tracked in milliseconds, but the telemetry finalizer multiplied them again, making exported clear times read 1000x too large.'
    ],
    highlights: [
      'Room telemetry clearMs now stores actual milliseconds.',
      'No gameplay balance values changed in this hotfix.'
    ]
  },
  {
    version: '1.16.19',
    label: 'TELEMETRY HOTFIX',
    summary: [
      'This is a small stability fix for the new room-telemetry build. A snapshot hook was reading required shot count without the active upgrade state attached, which could break run start on Initiate Run.'
    ],
    highlights: [
      'Fixed the room-telemetry snapshot call so new runs start correctly again.',
      'No balance values changed in this hotfix.'
    ]
  },
  {
    version: '1.16.18',
    label: 'ROOM TELEMETRY',
    summary: [
      'This build starts the new balance-analysis pass by upgrading the leaderboard payload itself. End-of-run submissions now carry compact room-by-room telemetry so exported score files can explain why a run stabilized, snowballed, or collapsed instead of only listing its final room and boon loadout.'
    ],
    highlights: [
      'Each run now records per-room pressure, damage taken, healing by source, charge gain by source, safety proc counts, and room clear time.',
      'Periodic deep-run snapshots now capture build state like SPS, max charge, required shot count, shields, orbit count, and viewport/canvas size.',
      'This is instrumentation only: no direct balance reductions were applied in this patch.'
    ]
  },
  {
    version: '1.16.17',
    label: 'VERTICAL ARENA EXPANSION',
    summary: [
      'This follow-up takes advantage of the height freed up by the recent mobile UI cleanup. Instead of holding the arena to one fixed shape, the game now lets the canvas grow taller when a phone has real vertical headroom, so that reclaimed shell space turns into actual play space.'
    ],
    highlights: [
      'The arena can now extend vertically on phones that have spare height instead of leaving dead space under the playfield.',
      'Resize math now counts only visible shell chrome, so hidden menu-only UI no longer steals gameplay budget.'
    ]
  },
  {
    version: '1.16.16',
    label: 'ROOM BADGE RETIRED',
    summary: [
      'This cleanup removes the old bottom room-name badge entirely now that the current room is already shown in the top HUD. That extra chrome was just burning vertical space on smaller phones, so the shell no longer reserves room for it.'
    ],
    highlights: [
      'Removed the redundant bottom room badge from the interface.',
      'Canvas sizing no longer budgets height for the retired badge, giving a little more room back to gameplay.'
    ]
  },
  {
    version: '1.16.15',
    label: 'GAME VIEW RECLAIM',
    summary: [
      'This follow-up removes teaching chrome from active play so shorter phones can give more of the shell to the arena itself. The bottom room badge and threat legend now stay on the main menu where they are useful for onboarding, then step out of the way once a run begins.'
    ],
    highlights: [
      'Room badge and danger legend now show on the main menu only, freeing more vertical space for gameplay and post-run screens.',
      'Run-over flow now includes a direct Main Menu button instead of forcing a restart before returning to the front screen.'
    ]
  },
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
