# Agent Onboarding — Phantom Rebound

This repo is a canvas-based JS game (mobile-first). The goal of this doc is to let any agent ship a correct, behavior-preserving change without re-exploring the codebase every time.

**Read this whole file before editing.** It's short on purpose.

---

## 1. Test & verify

One command runs everything:

```
node scripts\test-systems.mjs
```

- 59+ tests. All must pass before push.
- There is no build step — edit, reload the browser, done.
- No linter, no bundler. Keep code ES-module clean.

To smoke-test visually: open `index.html` in a browser (or via the local dev server the user already has running). Hard-refresh to defeat cache.

---

## 2. Version bump — hard gate on every push

Every push **must** bump the version. Use the script (single command, idempotent):

```
node scripts\bump-version.mjs 1.19.27 "SHORT LABEL"
```

This updates all five places that must stay in sync:
1. `src/data/version.js` — `VERSION = { num, label }`
2. `version.json` — `{ version, label }`
3. `index.html` — `window.__APP_BUILD__` fallback banner
4. `index.html` — `styles.css?v=…` cache-bust
5. `index.html` — `script.js?v=…` cache-bust

To also stub a patch-notes entry, pass `--note` flags:

```
node scripts\bump-version.mjs 1.19.27 "FEATURE" --note "Summary line." --note "Highlight two."
```

That prepends an entry to `src/data/patchNotes.js` (recent file). You can also edit it by hand after.

**Do not push without bumping.** PWA caches will not invalidate.

---

## 3. File map — where does X live?

### Source (`src/`)

| Directory | What goes here |
| --- | --- |
| `src/data/` | Config, constants, content. Pure data exports. No DOM, no canvas. |
| `src/entities/` | Enemy types, enemy runtime (separation, bullets, orbit contact). |
| `src/systems/` | Gameplay systems: particles, damage numbers, boon hooks, boon logic. |
| `src/ui/` | UI panels (`panelManager.js`), drawing renderers (`ui/drawing/`). |
| `src/ui/drawing/` | Per-entity canvas renderers (ghost, bullet, hat). |
| `src/core/` | Cross-cutting state containers (`gameState.js`). |
| `src/platform/` | Storage keys, device detection, etc. |
| `src/input/` | Input handling (touch/gyro/keyboard). |

### Key files by topic

| Topic | File |
| --- | --- |
| Version number | `src/data/version.js` |
| Player upgrades / boon tier definitions | `src/data/boons.js` (barrel) + `boonDefinitions.js`, `boonLogic.js`, `boonHelpers.js`, `boonConstants.js` |
| Boon hooks registry (tick / room start / room clear / pause adjust) | `src/systems/boonHooks.js` |
| Game constants (magic numbers) | `src/data/constants.js`, `src/data/gameData.js` |
| Enemy types & scaling | `src/entities/enemyTypes.js` |
| Enemy runtime behavior | `src/entities/enemyRuntime.js`, `src/entities/enemyBullets.js` |
| Particles | `src/systems/particles.js` |
| Damage numbers | `src/systems/damageNumbers.js` |
| Hats cosmetic | `src/data/hats.js` + `src/ui/drawing/hatRenderer.js` |
| Ghost sprite | `src/ui/drawing/ghostRenderer.js` |
| Bullet sprite | `src/ui/drawing/bulletRenderer.js` |
| UI panels (open/close/outside-click) | `src/ui/panelManager.js` |
| Leaderboard / Supabase | `src/systems/leaderboard.js`, `supabase/` |
| Patch notes (recent + archive split) | `src/data/patchNotes.js` (recent) + `src/data/patchNotesArchive.js` |
| Architecture overview | `docs/ARCHITECTURE.md` |

### The monolith (`script.js`)

~4,500 lines. Has a TOC block at the top — grep `// ── SECTION ──` dividers to jump. **When adding a new system, extract it to `src/` rather than inflating script.js.**

---

## 4. Symbol cheatsheet

All of these live in `script.js` unless noted. Grep is your friend.

| Symbol | Notes |
| --- | --- |
| `player` | Single object; mutated in place. Anchored reference — do not reassign. |
| `UPG` | Player upgrade flags/tiers. Many `UPG.X` reads; side-effects migrated to hooks. |
| `bullets`, `enemies`, `shockwaves`, `spawnQueue` | Live in `src/core/gameState.js`. Import via `getBullets()`, `getEnemies()`, etc. In-place mutation only — never reassign. |
| `scoreBreakdown` | `src/core/gameState.js`. Breakdown buckets for end-of-run summary. |
| `runTelemetry` | Still in `script.js` (module-level). Reassigned on new run. |
| `roomPhase`, `roomIdx`, `roomClearTimer` | script.js module-level lets. See `finalizeRoomClearState()`. |
| `healPlayer`, `spawnDmgNumber`, `spawnSparks` | Helper fns — grep for home module. |
| `runBoonHook(name, ctx)` | `src/systems/boonHooks.js`. Invoke pluggable boon side-effects. |
| `registerBoonHook(name, fn)` | Register a callback for `onRoomStart` / `onRoomClear` / `onTick` / `onPauseAdjust`. Self-gating on `UPG.X` flags. |

---

## 5. Boon hook registry (`src/systems/boonHooks.js`)

Four hook types are live. Each callback is **self-gating** — it reads `ctx.UPG` and returns early if its flag isn't set.

| Hook | Context object | Called from |
| --- | --- | --- |
| `onRoomStart` | `{ UPG }` | `buildRoom()` after spawn queue is composed |
| `onRoomClear` | `{ UPG }` | inside `finalizeRoomClearState()` |
| `onTick` | `{ UPG, dt, ts }` | every frame in `update()` |
| `onPauseAdjust` | `{ UPG, pauseDuration }` | `offsetAbsoluteTimestamps()` after unpause |

To add a new boon side-effect, prefer registering a hook over inlining in `script.js`.

**Cutline (do not migrate):** fire-path activations (~line 1618-1662, overload/shockwave/echoFire) and hit/damage-path bookkeeping. Those are tightly coupled to local call-site context (`bullets`, `enemies`, `charge`, `availableShots`, etc.) and hook indirection would balloon context objects for no benefit.

---

## 6. Conventions & guardrails

- **State encapsulation** — for state in `src/core/gameState.js`, the import exposes a getter that returns a stable reference. Mutate in place; never reassign the binding. Example: `getBullets().push(b)` ✅, `bullets = bullets.filter(...)` ❌ (use `.splice(i, 1)` or reassign via the module's setter if one exists).
- **No build step** — code runs as-is in the browser. Keep imports relative and `.js`-suffixed.
- **Patch notes per push** — prepend to `PATCH_NOTES_RECENT` array in `src/data/patchNotes.js`. The `bump-version.mjs` script does this with `--note`. Archive entries (older than ~1.19.12) live in `patchNotesArchive.js` and are auto-concatenated.
- **Cache invalidation** — PWA/browser will hold stale JS/CSS if you push without bumping the cache-bust query strings. The bump script handles this. Always verify a hard-refresh pulls your change before declaring done.
- **Never commit secrets.** Supabase anon key is fine (public by design). Service role key is not.
- **Don't rewrite `git` history** on pushed branches.
- **Don't create markdown files** for planning — use the session plan file. Docs go in `docs/`.

---

## 7. Where NOT to edit (parallelism lanes)

When the main agent is mid-release, stay out of:
- `script.js`
- `styles.css`
- `index.html`
- `src/data/version.js`, `version.json`
- `src/data/patchNotes.js` (top entry)

Safe lanes for parallel work: `docs/`, `assets/`, `supabase/` (after migrations land), `src/entities/`, `scripts/`, `src/data/patchNotesArchive.js` (historical only).

---

## 8. Release checklist

1. Change behavior. Run `node scripts\test-systems.mjs`.
2. `node scripts\bump-version.mjs <new-version> "LABEL" --note "summary" --note "highlight" …`
3. Edit the stubbed patch-notes entry if you want to polish the wording.
4. Hard-refresh browser, smoke-test.
5. `git add -A && git commit -m "…" && git push`.

---

## 9. Historical context (scaling checklist, preserved)

These were the original north stars and still apply:

- Target 60 fps on midrange hardware (Android API 31 / iOS 15) with adaptive quality tiers.
- Modular input handling to switch fluidly between touch, gyro, and controller.
- Cloud-synced state + lightweight serialization for quick sessions.
- Prioritize hot-reload-friendly scripts (lean on the `src/` layout).
- Bump the in-game version on every push so mobile stores and QA always see a fresh build signal.
- Treat version bump as a hard gate: do not push without updating `src/data/version.js`, `version.json`, `window.__APP_BUILD__`, and the `script.js` / `styles.css` cache-busting query strings in `index.html` (the `bump-version.mjs` script enforces this).
