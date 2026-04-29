# Co-op Multiplayer — Gameplan

Status: **Planning** (no code yet). Target: online 2-player co-op with deterministic lockstep, shared arena, per-player boons, downed/revive mechanic, Supabase Realtime transport, team leaderboard.

Locked-in design decisions (user confirmed, session 2026-04-23):

| Decision | Choice |
|---|---|
| Networking backend | Supabase Realtime (WebSocket broadcast) |
| Simulation authority | Deterministic lockstep (seeded RNG) |
| Boon sync | Both pick simultaneously; next room starts when both are locked in |
| Death behavior | Downed → partner can revive by standing near 3s; if both down, run ends |
| Disconnect | 30s grace period to reconnect; otherwise remaining player banks score and run ends |
| Leaderboard | Individual scores on a dedicated co-op board (each player banks their own score; entries tagged with partner's name) |
| Room join | 6-char alphanumeric code **AND** shareable URL (`?room=XXXXXX`) |
| Scope | Full (revive, spectator cam, reconnect, polish) — shipped in phases |

---

## 1. Goals & non-goals

### Goals
- Two players, each on their own device, play the same arena simultaneously.
- Each player picks **their own** boons; their upgrades only affect their own character.
- Each client renders enemies tinted to the **local** player's color (purely cosmetic).
- Enemies have **2× HP** in co-op to keep room difficulty meaningful with two damage sources.
- Friendly fire is **off**: a player's bullets pass through their partner.
- Scoring is **per-player** on screen; **each player's individual score** is what banks to the co-op leaderboard. Entries are tagged with the partner's name so co-op runs are identifiable but each player's achievement is their own.
- Downed state + revive creates tension and incentivizes staying near your partner.
- Disconnect is recoverable within a 30s window.

### Non-goals (for v1)
- 3+ player lobbies.
- Text/voice chat (emotes only if any social layer at all).
- Cross-progression with solo runs (co-op is a separate mode tree).
- Matchmaking / random pairing — invite-only via code/URL.
- Mobile↔desktop guaranteed parity (best effort; desktop-host recommended).
- Spectator mode for non-playing friends.

---

## 2. Architecture — deterministic lockstep over Supabase Realtime

### 2.1 Why lockstep
Lockstep means both clients run the **identical** simulation from the same seed and the same sequence of inputs. The only thing sent over the wire is:
- **Per-tick inputs** (move vector, fire state, ability presses) for both players.
- **Control messages** (room join, boon choice commit, pause, revive request, disconnect).

No enemy positions, no bullet positions, no HP values — those are derived identically on both sides. This is ~100× less bandwidth than state-sync and naturally cheat-proof (but requires strict determinism).

### 2.2 Cost of lockstep: the determinism refactor
All simulation randomness must come from a **seeded PRNG**, not `Math.random()`. Current `Math.random()` call sites to replace:

| File | Count | Notes |
|---|---|---|
| `script.js` | 7 | Room progression, effects |
| `src/entities/enemyTypes.js` | 7 | Enemy variant rolls, stat jitter |
| `src/entities/enemyRuntime.js` | 1 | AI decision |
| `src/entities/projectiles.js` | 1 | Spread |
| `src/entities/playerFire.js` | 1 | Spread |
| `src/entities/playerProjectiles.js` | 1 | Spread |
| `src/systems/boonLogic.js` | 6 | Boon rolls |
| `src/systems/killRewards.js` | 1 | Drop rolls |
| `src/systems/spawnBudget.js` | 2 | Spawn composition |
| `src/systems/damageNumbers.js` | 1 | Cosmetic jitter — can stay Math.random |
| `src/systems/particles.js` | 21 | Cosmetic — can stay Math.random |

**~28 simulation-critical call sites** need seeded PRNG. The ~22 cosmetic ones (particles, damage number jitter) can keep `Math.random()` because they don't affect gameplay state.

### 2.3 Input pipeline
Single fixed timestep (already 60 Hz via `requestAnimationFrame` + dt cap). For lockstep:
- Both clients run on a **fixed 60 Hz tick** (already close, needs to become strict — tick on ms boundary, no variable dt).
- Each client samples its own input into a frame buffer, broadcasts to peer, and **buffers peer's input**.
- Simulation only advances when both inputs for tick `N` are in hand — **input delay** of ~2-3 ticks (33–50ms) smooths over jitter.
- If peer input is late beyond a threshold, pause simulation briefly and show a "waiting for partner" indicator.

### 2.4 Transport: Supabase Realtime channels
- Channel name: `coop:<ROOMCODE>` (e.g. `coop:ABC123`).
- Message types:
  - `hello` — join, carries player identity (name, hat, color).
  - `ready` — both players present and agreed on seed.
  - `input` — per-tick: `{ tick, moveX, moveY, fire, special, seq }` (small, broadcast ~20-60×/sec).
  - `boon-pick` — `{ boonId, tick }` committed at end-of-room.
  - `revive-req` / `revive-progress` — revive coordination.
  - `pause` / `resume` — either player can pause.
  - `bye` — graceful disconnect.
- Messages use Supabase `channel.broadcast` with `ack: false` for input (fire-and-forget, we tolerate drops via re-send window).

### 2.5 Authority edge cases
Even with lockstep, **one player is the "host"** for tie-breaking and final scoring:
- Host assigns the seed on run start.
- Host writes the final team score to the leaderboard (guest doesn't submit).
- If clients desync (checksum mismatch every N ticks), host's state wins and we re-snap guest (rare, but a safety net).

---

## 3. Gameplay specifics

### 3.1 Per-player state (owned by each client, synced via inputs)
- Position, velocity, facing, charge, HP, maxHp.
- UPG (boons) — completely independent per player.
- Score, kills, telemetry.
- Hat/color (cosmetic; sent once at join).

### 3.2 Shared/derived state (identical on both clients via lockstep)
- Enemy array (positions, HP, AI state).
- Bullet array (both players' + enemies').
- Room index, room timer, spawn queue.
- Obstacles, shockwaves, particles that affect gameplay.

### 3.3 Enemy HP scaling
`enemyBaseHp * 2` in co-op. Controlled by a `coopMode` flag passed into `createEnemy()` in `src/entities/enemyTypes.js`.

### 3.4 Friendly fire
In collision tests, bullets have an `ownerId` (0 = local player, 1 = partner, 2+ = enemy). Player vs bullet check skips bullets where `ownerId === playerId`. Simple.

### 3.5 Enemy tint per-client
Renderer only. Each client has its own `localPlayerColor`; the enemy draw path uses it for enemy fills. The network and simulation have no concept of color. This is a pure render-layer change in `src/renderers/*`.

### 3.6 Boon selection flow
- Room clear → each player sees their **own** boon screen, picks independently.
- A "partner picking…" indicator shows while the other player is still choosing.
- When both picks arrive (via `boon-pick` message), both clients apply both boons and start the next room at the agreed tick.
- Legendary boons: independent per player, same logic but each player's `boonHistory` is tracked separately.

### 3.7 Downed / revive mechanic
- HP hits 0 → enter `downed` state (not dead). Player becomes stationary, cannot fire, takes no further damage from enemies, visual: translucent + prone.
- A countdown-style radial fills when partner is within revive radius (~60px). After 3s of continuous proximity, downed player revives at **50% max HP**.
- If partner is hit while reviving, progress resets.
- If **both** players are downed simultaneously, run ends (game over).
- 60s bleed-out timer on downed state — if timer expires, becomes permanent KO (which, if partner is alive, keeps run going but player is locked out; if partner is also down/dies, run ends).

### 3.8 Pause
Either player can pause. Pause broadcasts to partner; both clients pause. Either can resume, which also broadcasts. Confirm dialog only on the player who hit pause.

### 3.9 Disconnect / reconnect
- Missing `input` beyond 3s → show "partner disconnected" overlay on remaining client; local sim pauses.
- Partner has 30s to rejoin the same `coop:<ROOMCODE>` channel. On rejoin, host sends a **state snapshot** (positions + inputs from last N ticks) so rejoining client can catch up.
- After 30s: run ends, remaining player's **solo score** (half the team total) banks to solo leaderboard with a `[co-op abandoned]` tag.

---

## 4. UI / flow changes

### 4.1 Start menu
Current: **Start Run** button → straight into gameplay.
New:
```
Start Run
  ├─ Solo
  └─ Co-op
        ├─ Create Room      (generates code, shows code + shareable link + QR code)
        └─ Join Room        (enter code OR paste URL)
```
URL param `?room=ABC123` skips the menu and goes directly to join.

### 4.2 In-game HUD
- Second HP bar for partner (smaller, beside own bar).
- Partner score counter.
- Connection indicator (green/yellow/red) showing ping / jitter.
- Partner's name + color dot.

### 4.3 Boon screen
Add a "PARTNER: picking…" / "PARTNER: locked in (Long Reach)" footer. Next-room button grays out until both locked.

### 4.4 Game over
Shows both players' individual scores. Each player's own score submits to the co-op leaderboard as a separate entry, with the partner's name attached for context.

### 4.5 Co-op leaderboard
New board tab alongside existing Global/Friends. Entry shape:
```
{ playerName, score, partnerName, room, duration, submittedBy }
```
Both players produce one entry each per run.

---

## 5. File / module plan

### 5.1 New modules
| File | Purpose |
|---|---|
| `src/net/coopTransport.js` | Supabase Realtime channel wrapper — join, leave, send, on(type, handler). |
| `src/net/coopSession.js` | Lifecycle: create/join room, seed negotiation, ready handshake, state snapshot, disconnect/reconnect. |
| `src/net/inputSync.js` | Per-tick input buffering, send/receive, waiting-for-peer stall. |
| `src/systems/seededRng.js` | Seeded PRNG (mulberry32 or xoroshiro). Exposes `.next()`, `.range(min,max)`, `.pick(arr)`, `.fork(name)`. |
| `src/systems/coopMode.js` | Mode flag + helpers: `isCoop()`, `getLocalPlayerId()`, `getPartnerState()`. |
| `src/entities/playerPartner.js` | Partner-player rendering + state application from their input stream. |
| `src/systems/reviveSystem.js` | Downed state, proximity check, revive progress. |
| `src/ui/coopLobby.js` | Start-menu co-op sub-flow (create/join/code display). |
| `src/ui/coopHud.js` | Partner HP bar, score, connection indicator. |

### 5.2 Touched modules (determinism refactor)
All files listed in §2.2 — replace simulation `Math.random()` calls with `rng.next()` threaded through or pulled from a module-level `getSimRng()`.

### 5.3 Touched modules (co-op integration)
- `script.js` — mode branching: coop vs solo init, main loop tick gating on peer input, HUD additions.
- `src/entities/enemyTypes.js` — accept `coopMode` flag for 2× HP.
- `src/entities/playerFire.js` / `playerProjectiles.js` — tag bullets with `ownerId`.
- `src/systems/collision.js` (if exists, or inline) — `ownerId` check for friendly-fire skip.
- `src/renderers/*` — `localPlayerColor` threading for enemy tint.
- `src/data/leaderboardConfig.js` — co-op board type + scope.
- `supabase/leaderboard.sql` — new `coop_scores` table (schema parallel to `scores` with team fields).

### 5.4 Supabase schema addition
```sql
create table coop_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score int not null,
  partner_name text not null,
  room int not null,
  duration_ms int not null,
  version text not null,
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz default now()
);
-- + RLS + submit_coop_score() RPC parallel to existing submit_score().
-- Each player in a co-op run writes their own row.
```

---

## 6. Phased delivery

User asked for **full scope**. That can't ship in one slice safely. Here's the phased route — each phase is independently testable and shippable:

### Phase A — Determinism foundation (no multiplayer yet)
- Build `src/systems/seededRng.js`.
- Thread it through all simulation call sites.
- Add `?seed=12345` URL param that replays an identical solo run from a seed.
- Verify: same seed + same inputs → same enemies, same room outcomes.
- **Ship as**: v1.20.x "DETERMINISM PASS". Zero visible gameplay change; replay harness as proof.
- **Risk**: medium. Miss a call site → desync bug in multiplayer later.

### Phase B — Transport & lobby
- Build `coopTransport.js` + `coopSession.js` (no game sim yet — just connect, echo messages).
- Build start-menu Solo/Co-op split + Create Room / Join Room UI (functional, not gameplay).
- Two browsers can connect and see each other's "hello" messages.
- **Ship as**: v1.20.x "CO-OP LOBBY (WIP)" behind a feature flag.

### Phase C — Lockstep simulation
- Integrate input sync into main loop.
- Render partner player on screen (cosmetic-only, driven by their input stream).
- Enemies 2× HP in co-op mode.
- Friendly-fire off.
- No boons yet, no revive, no leaderboard — raw arena co-op.
- **Ship as**: v1.20.x "CO-OP LOCKSTEP (beta)".
- **This is the hardest phase** — expect 2-3 iterations to stabilize.

### Phase D — Co-op gameplay features
- Per-player boon screens with sync gate.
- Downed / revive system.
- Per-client enemy tint.
- Partner HUD.
- Co-op pause.
- **Ship as**: v1.20.x "CO-OP COMPLETE".

### Phase E — Robustness & polish
- Reconnect with 30s grace + state snapshot.
- Co-op leaderboard + Supabase schema.
- Spectator cam when your player is fully KO'd but run continues.
- In-game tutorial prompts (first co-op run).
- Connection quality indicator.
- **Ship as**: v1.21.0 — co-op officially GA.

---

## 7. Testing strategy

### 7.1 Determinism tests (Phase A)
- Unit: seeded RNG produces identical sequences from identical seeds.
- Integration: run 1000-tick headless sim with `seed=X` + fixed inputs, compare final state hash across runs. Must match byte-for-byte.
- Add to `scripts/test-systems.mjs`.

### 7.2 Lockstep tests (Phase C)
- Two headless playwright clients on same room, feed synthetic input streams, assert final state hashes match every 60 ticks.
- Artificial packet-drop / reorder test: ensure input buffer logic handles it.

### 7.3 Manual playtests
- Two real browsers on localhost.
- Same WiFi, different devices.
- Different networks (mobile hotspot vs home WiFi) — real latency.
- Deliberate tab-backgrounding to test input stall recovery.

---

## 8. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Desync from missed `Math.random` call | High | Phase A replay test — literally won't pass if a site is missed. |
| Floating-point non-determinism across CPU/browser | Medium | Test matrix: Chrome+Firefox on Win/Mac/Android. If it bites, use integer-only physics or quantize positions. |
| Input lag perceptible to players | Medium | 2-tick input delay (~33ms) + client-side input prediction for local player movement (rendering only, not state). |
| Supabase Realtime message rate limits | Low-Med | 20-60 msgs/sec per channel is within free-tier limits for a single room. Pool inputs per frame, not per event. |
| Reconnect state-snapshot is large | Low | Snapshot ≈ last 180 ticks' inputs (~4KB). Use `channel.broadcast` with compression. |
| Determinism refactor regresses solo play | Medium | Phase A ships with equivalent tests passing at every commit; solo is the primary test bed before multiplayer lands. |
| Two players with wildly different frame rates | Medium | Fixed-timestep sim means visual FPS is decoupled from sim FPS. Lower-FPS client just renders fewer frames, sim stays locked. |
| Desktop vs mobile input scheme parity | Low | Already abstracted — joystick state + fire button translate the same regardless of source. |

---

## 9. Open questions (for later phases — not blockers now)

1. Should co-op have its own boon pool (e.g., "Revive Zone" legendary, team-synergy boons)? **Default**: same pool, phase F if we add co-op specifics.
2. If one player has a legendary-chain primed and the room ends before partner locks their boon, does the legendary still count? **Default**: yes, independent per player.
3. Should the charge orb mechanic be shared (either player can shoot charged shots) or per-player? **Default**: per-player (matches boon independence).
4. Do daily challenges include a co-op variant? **Default**: no for v1; consider later.
5. What's the exact reconnect UX — auto-retry loop or manual "Reconnect" button? **Default**: auto-retry every 2s for the full 30s.

---

## 10. Rough scope signal (no time estimates, just effort tiers)

- Phase A: **Large** (touches ~12 files, new RNG system, full replay-test harness).
- Phase B: **Medium** (new UI + thin transport layer, no sim changes).
- Phase C: **Extra-large** (hardest — the actual lockstep wiring; expect multiple iterations).
- Phase D: **Medium-large** (several features, mostly additive).
- Phase E: **Medium** (polish, reconnect, leaderboard SQL).

Total: this is the biggest single feature in the game's history. Worth the effort — co-op dramatically multiplies retention — but should be planned as a multi-release arc, not a single push.

---

## 11. Immediate next step

Phase A — determinism foundation. Specifically:
1. Create `src/systems/seededRng.js` with mulberry32.
2. Add `getSimRng()` accessor (module-level instance seeded on run start).
3. Replace all 28 simulation `Math.random()` call sites.
4. Add `?seed=N` URL param that seeds runs from it (solo).
5. Build a replay-test harness in `scripts/test-determinism.mjs` that runs a scripted run twice and hashes final state.
6. Ship as v1.20.0.

Nothing about multiplayer is visible to users in Phase A — but without it, Phase C is a minefield.
