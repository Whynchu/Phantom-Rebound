import { PATCH_NOTES_ARCHIVE } from './patchNotesArchive.js';

const PATCH_NOTES_RECENT = [
  {
      version: '1.20.5',
      label: 'COOP PHASE C2A: PLAYER SLOTS',
      summary: ['Internal refactor: new player-slot bundle abstraction lays the groundwork for a second in-world player. Invisible to solo players.'],
      highlights: [
        'New src/core/playerSlot.js: createPlayerSlot() returns a frozen {id, body, upg, metrics, timers, aim, input} bundle. body/upg expose live getters so slot 0 stays valid across the player = createInitialPlayerState() reassignment that happens on every new run.',
        'Slot 0 (host) is installed in script.js at init() and at restoreRun(). metrics/timers/aim are bridge objects backed by the existing module-scope let bindings (score, kills, charge, hp, slipCooldown, echoCounter, colossusShockwaveCd, aim angle, etc.) — zero behavior change, but future slot-aware code can now route through slot.metrics.score instead of the globals.',
        'New scripts/test-player-slot.mjs adds 8 contract tests (reassignment-safety, bridge round-trip, registry helpers). 97 tests total across 4 suites.',
        'No new user-visible gameplay; this is scaffolding for Phase C2b-C2f (slot-aware loop, debug second player, enemy targeting, per-player boons).',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.4',
      label: 'COOP PHASE C1B: FIXED STEP',
      summary: ['Internal refactor: simulation now runs at a deterministic 60 Hz fixed timestep, independent of display refresh rate. Invisible to solo players; required groundwork for lockstep co-op.'],
      highlights: [
        'Main loop converted from variable-dt to a fixed-step accumulator (SIM_STEP_MS = 1000/60). Display refresh drives the render rate; sim always advances in exact 16.667ms chunks.',
        'Spiral-of-death guard: max 5 sim steps per rAF frame, max 250ms accumulated frame time. Background-throttled tabs drop their backlog on return instead of locking up.',
        'Accumulator is zeroed on every loop re-entry point (room start, boss intro, upgrade return, restart) so paused/stale fragments never leak into the next run.',
        'All update() callsites now receive the same dt every tick, which makes physics/AI reproducible across machines — a prerequisite for lockstep determinism in Phase C3.',
        'Render continues once per rAF with the latest simNowMs (no interpolation yet; step is small enough that jitter is imperceptible on 60+ Hz displays).',
        'Determinism replay + lobby + systems suites (89 tests) all green. Browser smoke test clean.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.3',
      label: 'COOP PHASE C1A: SIM CLOCK',
      summary: ['Internal refactor: simulation now runs on its own clock, decoupled from the browser wall clock. Invisible to solo players; required groundwork for lockstep co-op.'],
      highlights: [
        'New simNowMs module-scope sim clock in script.js — advances by accumulated dt inside the main loop, freezes during pause naturally.',
        'All sim-critical timers (projectile expireAt/decayStart, death animation, volley cadence, shield burst / mirror tide / reflection / shockwave / volatile burst spawn times, sustained-fire streak, void-zone window, orbit/shield rotation visuals) now read simNowMs — not performance.now().',
        'Pause controller no longer shifts bullet expireAt / decayStart on resume. With the sim clock frozen during pause, timestamps are already correct on resume (no more timer-offset drift bugs).',
        'Render-only timers (menu ghost preview pulse, damage-number jitter, HUD reads, leaderboard timestamps) stay on wall-clock as intended.',
        'Determinism replay + lobby + systems suites (89 tests) all green.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.2',
      label: 'COOP LOBBY: MOBILE SHARE',
      summary: ['Mobile UX fix: sharing a co-op room no longer drops the host when they leave the tab to message a friend.'],
      highlights: [
        'Share button now uses the native share sheet (navigator.share) when available — keeps the browser foregrounded instead of fully context-switching.',
        'Supabase transport no longer treats CLOSED / TIMED_OUT as fatal post-subscribe. Those are recoverable disconnects and supabase-js auto-reconnects. Only CHANNEL_ERROR tears down the room now.',
        'Desktop clipboard fallback unchanged.',
      ]
    },
  {
      version: '1.20.1',
      label: 'COOP PHASE B: LOBBY (WIP)',
      summary: ['Experimental co-op lobby: host/join a 6-character room code, shareable URL, matches to shared seed. Gameplay launch lands in the next build.'],
      highlights: [
        'Enable with ?coop=1 or visit a ?room=XXXXXX share URL — a Co-op button appears on the start screen.',
        'Supabase Realtime broadcast adapter (lazy-loaded from pinned CDN) — no DB schema changes needed.',
        'Host creates room, guest joins, handshake exchanges identities and locks in a simulation seed (32-bit crypto-random).',
        'Room-full rejection, hello-ack timeout, subscribe timeout, protocol version gating — all covered by 11 lobby tests.',
        'Lobby only; actual two-player gameplay arrives in Phase C (lockstep simulation wiring).',
        'Shipping to Experimental repo only; zero gameplay change for live players.',
      ]
    },
  {
      version: '1.20.0',
      label: 'COOP PHASE A: SEEDED SIM',
      summary: ['Foundation for online co-op: simulation now runs on a seeded PRNG so two clients with the same seed walk identical sim paths.'],
      highlights: [
        'New src/systems/seededRng.js — mulberry32 PRNG with reseed/fork/pick helpers, singleton simRng used across all sim modules.',
        'Migrated 28 Math.random call sites to simRng: enemy spawns, projectile jitter, boon rolls, kill-reward drops, spawn weighting, legendary picks, shuffles.',
        'Runs accept ?seed=N (int or string) URL param — same seed replays the same enemy waves, boon choices, and spawn layouts.',
        'Cosmetic randomness (particles, damage-number jitter) intentionally stays on Math.random.',
        'New determinism replay harness (scripts/test-determinism.mjs) with 11 tests including a compound 50-room replay byte-identical across runs.',
        'Shipping to Experimental repo only; no gameplay change vs v1.19.32 for live players.',
      ]
    },
  {
      version: '1.19.32',
      label: 'PATCH NOTES HOTFIX',
      summary: ['Hotfix: re-declare module-level pausePanel/pauseBoonsPanel refs in script.js.'],
      highlights: [
        'The panelManager patchNotes beforeOpen/beforeClose callbacks referenced these refs, but p4-pause extraction moved them into pauseController\'s closure, so clicking the Patch Notes button threw ReferenceError and the panel never opened.',
      ]
    },
  {
      version: '1.19.31',
      label: 'PAUSE BTN HOTFIX',
      summary: ['Hotfix: re-declare module-level btnPause/btnPatchNotes refs in script.js.'],
      highlights: [
        'p4-pause extraction removed them from script.js scope but legacy game-state paths (boon apply, legendary, init) still referenced them directly, crashing the run start with ReferenceError.',
      ]
    },
  {
      version: '1.19.30',
      label: 'EXTRACT TELEMETRY',
      summary: ['Decomposition: run telemetry + per-room recorders now live in src/systems/runTelemetryController.js.'],
      highlights: [
        'script.js trimmed another 115 lines (3755 to 3640).',
      ]
    },
  {
      version: '1.19.29',
      label: 'EXTRACT PAUSE',
      summary: ['Decomposition: pause overlay + Escape toggle + confirm dialog now live in src/ui/pauseController.js.'],
      highlights: [
        'script.js trimmed another 113 lines (3868 → 3755).',
      ]
    },
  {
      version: '1.19.28',
      label: 'EXTRACT OBSTACLES',
      summary: ['Refactor — no gameplay changes.'],
      highlights: [
        'Extracted 8 obstacle/collision functions (createRoomObstacles, getCircleRectContactNormal, resolveEntityObstacleCollisions, isEntityOverlappingObstacle, ejectEntityFromObstacles, resolveBulletObstacleCollision, segmentIntersectsRect, hasObstacleLineBlock) from script.js into src/systems/obstacles.js.',
        'script.js is now 98 lines smaller (3705 → 3607). The obstacle module takes the obstacles array as an argument so it has no hidden globals — easy to test and reason about.',
      ]
    },
  {
      version: '1.19.27',
      label: 'AGENT FRIENDLINESS',
      summary: ['Internal / docs only — no gameplay changes.'],
      highlights: [
        'Rewrote agents.md into a real onboarding doc (file map, symbol cheatsheet, boon hook reference, release checklist).',
        'Added scripts/bump-version.mjs: one command now updates all five version-sync points (was 5 manual edits).',
        'Split src/data/patchNotes.js: recent entries stay in patchNotes.js, older entries moved to patchNotesArchive.js so agents can view/edit release notes without hitting the view-tool truncation limit.',
        'Added a TOC header to script.js so agents can jump around the 4500-line file by grepping section dividers.',
      ]
    },
  {
      version: '1.19.26',
      label: 'ROOM CLEAR DEDUPE + JANITOR',
      summary: ['Internal refactor — no gameplay changes.'],
      highlights: [
        'Collapsed the two duplicated room-clear transition blocks into a single finalizeRoomClearState() helper so any future addition to the room-clear sequence happens in exactly one spot.',
        'Janitor pass: removed five stale .gitkeep placeholder files from directories that now hold real source (assets/, example.assets/, src/core/, src/entities/, src/input/).',
      ]
    },
    {
      version: '1.19.25',
      label: 'BOON HOOKS: ROOM START',
      summary: ['Internal refactor — boon registry phase wraps up.'],
      highlights: [
        'Migrated room-start boon inits (predator kill streak reset, mirror tide + phase dash seeding) onto a new onRoomStart hook.',
        'That closes the clean batch of boon-hook migrations: room-start/room-clear/per-frame tick/pause-adjust are now pluggable. Remaining UPG.* references live inside the fire, hit, and damage paths where the local context makes hook indirection higher cost than reward.',
      ]
    },
    {
      version: '1.19.24',
      label: 'BOON HOOKS: TICK + PAUSE',
      summary: ['Internal refactor — no gameplay changes.'],
      highlights: [
        'Migrated per-frame cooldown ticks (shockwave, refraction, mirror tide, overload, phase dash, void walker, predator instinct, blood rush) onto the onTick boon hook. Main loop now fires a single runBoonHook(\'onTick\') instead of eight inline UPG.* gates.',
        'Migrated pause-time timer adjustments (predator/blood rush/void zone/sustained fire/aegis) onto a new onPauseAdjust hook, so when pause shifts absolute timestamps forward, each boon owns its own set of timers.',
      ]
    },
    {
      version: '1.19.23',
      label: 'BOON HOOK REGISTRY',
      summary: ['Internal refactor — no gameplay changes.'],
      highlights: [
        'Introduced a lightweight boon hook registry in src/systems/boonHooks.js so boon effects can register tick/room-clear/kill/fire/damage callbacks instead of being hand-gated inside script.js.',
        'Migrated the regen-on-clear, escalation reset, and EMP-burst reset effects onto the onRoomClear hook as the pilot pattern. Behavior is identical; the two duplicated room-clear blocks collapse into a single hook fire.',
      ]
    },
    {
      version: '1.19.22',
      label: 'LEADERBOARD TIME DISPLAY',
      summary: ['Remote leaderboard rows now show run time.'],
      highlights: [
        'Once 1.19.20\'s duration_seconds column is flowing, leaderboard rows will display each run\'s duration alongside the score — even if the row has no telemetry attached.',
      ]
    },
    {
      version: '1.19.21',
      label: 'SCORE BREAKDOWN ENCAPSULATION',
      summary: ['Internal refactor — no gameplay changes.'],
      highlights: [
        'Moved the score breakdown object (kills, pace, flawless, clutch, and friends) into src/core/gameState.js alongside the entity arrays. One more chunk of global state now lives in a dedicated module.',
      ]
    },
    {
      version: '1.19.20',
      label: 'LEADERBOARD DURATION',
      summary: ['Run length is now recorded alongside scores.'],
      highlights: [
        'Remote leaderboard submissions now include duration_seconds so future views/analytics can sort by time-to-finish, show pace, or split fast vs. slow runs.',
        'Schema migration: added duration_seconds column to leaderboard_scores and a new p_duration_seconds parameter on the submit_score RPC (both optional/nullable, fully backwards-compatible).',
      ]
    },
    {
      version: '1.19.19',
      label: 'STATE ENCAPSULATION',
      summary: ['Under-the-hood refactor — no gameplay changes.'],
      highlights: [
        'Moved the live entity arrays (bullets, enemies, shockwaves, spawn queue) into a dedicated src/core/gameState.js module so future systems can import them directly instead of reaching into script.js.',
        'Room/wave reset paths now clear arrays in place instead of reassigning, keeping every module\'s reference stable.',
      ]
    },
    {
      version: '1.19.18',
      label: 'GAME OVER POLISH',
      summary: ['Tighter Game Over screen — the full breakdown fits without fighting you.'],
      highlights: [
        'Final score heading is smaller so the breakdown (now 11 categories) fits on phone screens without dominating the view.',
        'Removed the redundant "Room X · N enemies eliminated" caption; that info already appears once below the breakdown alongside run time.',
        'Tightened spacing between breakdown rows.',
      ]
    },
    {
      version: '1.19.17',
      label: 'DYNAMIC SCORING',
      summary: ['Score now reacts to every second and every playstyle.'],
      highlights: [
        'Continuous pace curve: every second shaved off a room now adds score (no more 30s all-or-nothing cutoff). Deep rooms multiply all bonuses via a per-room depth scale.',
        'HP efficiency: partial damage is now rewarded based on % HP kept — flawless still pays the most, but chip damage no longer zeroes you out.',
        'Clutch: finishing a room at ≤25% HP after taking a hit awards a sizeable bonus for risky comebacks.',
        'Combat density: kills-per-second rewards AOE / sweep builds; overkill damage (damage dealt past an enemy\'s HP) awards a small per-kill bonus for burst builds.',
        'Accuracy: kills / shots fired rewards precise builds. Dodge bonus: counts near-misses from enemy projectiles for evasion-focused runs.',
        'End-of-run breakdown now lists all categories so you can see exactly where your score came from.',
      ]
    },
    {
      version: '1.19.16',
      label: 'SCORING REWORK',
      summary: ['Score now rewards how you played, not just what you crit.'],
      highlights: [
        'Crits no longer double your score. Critical hits still do bonus damage — they just stop inflating the leaderboard.',
        'New score sources awarded every cleared room: Room clears (scales with depth), Pace bonus (faster than 30s), Flawless rooms (no damage taken), Boss takedowns.',
        'Existing 5-room streak checkpoint is now labeled "Streak bonus" on the Game Over screen for clarity.',
        'Leaderboard context: scores from 1.19.16+ include these new bonuses, so expect per-run totals to read a bit higher than pre-patch runs.',
      ]
    },
    {
      version: '1.19.15',
      label: 'RUN SCORE BREAKDOWN',
      summary: ['End-of-run screen now shows where your score came from.'],
      highlights: [
        'Game Over: the final score panel now lists a breakdown — kill points, critical bonus, orbit strikes, room bonuses — plus a quick stats line with kills, rooms cleared, run time, and clean rooms.',
        'Scoring is tracked per-category at the source, so the breakdown is exact, not estimated.',
        'No balance changes.',
      ]
    },
    {
      version: '1.19.14',
      label: 'LEADERBOARD BUTTON FIX',
      summary: ['Desktop main menu now expands to fit content — no more clipped Leaderboard button, no scrollbar.'],
      highlights: [
        'Desktop: on the main menu, the start panel now sizes to its own content instead of being trapped inside a fixed-height wrap. The Leaderboard button is always visible, and there is no scrollbar either. Hides the unused background canvas on the main menu so the layout can breathe.',
        'No changes to gameplay, mobile, or iPhone.',
      ]
    },
    {
      version: '1.19.13',
      label: 'ANDROID WEBAPK FIX',
      summary: ['Fix Android "Unsafe app blocked" warning for installed web app users.'],
      highlights: [
        'Android install fix: updated the web app manifest (id, scope, orientation, maskable icons, categories) so Chrome re-mints the WebAPK against a current Android SDK. This clears the "Unsafe app blocked — built for an older version of Android" popup.',
        'If you still see the warning: reopen the game in Chrome once and give it ~24h, or uninstall + reinstall from the home screen for an immediate refresh.',
        'Bonus: maskable icon support means Android now draws the app icon edge-to-edge instead of inside a white rounded box.',
        'iPhone, desktop, and in-browser play are unchanged.',
      ]
    },
    {
      version: '1.19.12',
      label: 'REFACTOR + SCROLLBAR TAKE 3',
      summary: ['More code tidy-up, patch notes now load on demand, another shot at the desktop scrollbar.'],
      highlights: [
        'Desktop scrollbar: targeted fix — hide the main-menu start panel scrollbar on ≥1024px viewports (it was the #s-start panel overflowing, not the page). If it still shows up, it is a browser extension or genuine content overflow, not layout.',
        'Perf: patch notes (73KB) now load only when the panel is opened instead of at startup. Faster first paint, same content.',
        'Refactor (invisible): canvas drawing for the ghost and bullets moved to dedicated renderer modules (src/ui/drawing/). Boon tunables split out to src/data/boonConstants.js. Fixed a stale unit test.',
        'New: docs/ARCHITECTURE.md added for contributors.',
      ]
    },
];

const PATCH_NOTES = [...PATCH_NOTES_RECENT, ...PATCH_NOTES_ARCHIVE];

const PATCH_NOTES_ARCHIVE_MESSAGE = 'In-client notes currently begin at v1.16.1. Older builds were not archived in this panel.';

export { PATCH_NOTES, PATCH_NOTES_ARCHIVE_MESSAGE };
