import { PATCH_NOTES_ARCHIVE } from './patchNotesArchive.js';

const PATCH_NOTES_RECENT = [
  {
      version: '1.20.61',
      label: 'D18.13: GUEST ROOM-CLEAR OVERLAY + CHARGE LERP JUMP-SNAP',
      summary: ['Two coop guest-side fixes from playtest: (1) the guest never saw the "ROOM CLEAR" or "BOSS DEFEATED" overlay between rooms — only the host did. The host calls showRoomClear() / showBossDefeated() inside its update path (skipped on guest), and the guest\'s snapshot mirror code only synced the room INTRO overlay. (2) The new D18.12 charge lerp blindly interpolated through any prev→curr delta, including discontinuities like room resets and boon-applied charge bumps — playtest reported "weird glitchyness" on the charge ring during the ready/go and end-of-room transitions, which was the lerp showing a fake ramp between two unrelated charge values.'],
      highlights: [
        'Guest snapshot mirror now triggers showRoomClear() (or showBossDefeated() for boss-room indices 9/19/29/39+ via the BOSS_ROOMS map) on the prevRoomPhase!=="clear" → "clear" edge. Same wrapper functions the host uses, just driven from the snapshot transition instead of the host\'s finalizeRoomClearState.',
        'Charge lerp now snaps to curr on big jumps: when |curr - prev| > 50% of maxCharge in a single snapshot, treat it as a discontinuity (room reset, fire-drop on a small maxCharge, boon applied) and skip the lerp. Normal smooth fills (< half maxCharge per snapshot) still lerp at 60Hz visible. Eliminates the visible "ramp through unrelated values" glitch on the charge ring during room transitions.',
        'Determinism canary 11/11; both fixes are coop-guest-only (host/solo paths never enter snapshot applier or guest-mirror branches).',
      ]
    },
  {
      version: '1.20.60',
      label: 'D18.12b: GUEST FIRE-RING MATCHES SOLO PLAYER\'S SLOW-FILL',
      summary: ['Follow-up to D18.12: the partner\'s fire-ready ring on the guest device was capping at the SPS interval the moment the partner started moving, instead of slowly continuing to fill like the solo player\'s own ring does. Solo advances fireT at dt * mobileChargeRate (~10%) while moving — the ring keeps creeping up gradually until you stop. D18.12\'s gating used full dt and an immediate cap, so the ring on guest looked too eager.'],
      highlights: [
        'Guest cosmetic fireT ticker now uses the solo formula verbatim: const mobileChargeMult = isStill ? 1.0 : (slot.upg.mobileChargeRate || 0.10); next = prev + dt * mobileChargeMult; cap at interval while moving; modulo-wrap only when still + has-target. Partner\'s ring now fills at the same gentle pace the solo player\'s own ring fills while running.',
        'Determinism canary 11/11; all coop logic still gated on activeCoopSession.',
      ]
    },
  {
      version: '1.20.59',
      label: 'D18.12: GUEST CHARGE LERP + GUEST REROLLS + RING PARITY',
      summary: ['Three guest-side parity issues from playtest: (1) the charge ring on the guest\'s screen ticked up in visible 15Hz steps instead of filling smoothly, making the SPS pacing feel "off" compared to the host\'s smooth ring. (2) The guest\'s boon picker had no Reroll button at all — only the host could reroll their three options. (3) The host\'s fire-ready ring on the guest\'s screen kept cycling even when the host was clearly moving (host wouldn\'t actually be firing in that state).'],
      highlights: [
        'Snapshot applier now lerps slot.metrics.charge between the previous and current snapshot frame using the same alpha that already drives body x/y/vx/vy. Previously charge was snapped to the latest snapshot value at ~15Hz, producing a stair-step charge ring on the guest device. With lerp the ring fills at render rate (60Hz visible) and matches the host\'s perceived pace. Solo/host paths never hit the applier (null in solo / canary), so determinism is unaffected.',
        'Guest now gets a working Reroll button on the boon picker (1 reroll per fresh coop run, mirroring host\'s starting count). showBoonSelection accepts an onReroll callback that returns a new boon array even when boonsOverride is set — guest\'s callback regenerates a fresh slot1-safe pool locally (same getSlot1SafeBoonPool the host uses to seed slot1BoonIds, just shuffled on the guest device). Final pick still ships via coop-boon-pick so host applies the chosen boon to slot 1\'s authoritative UPG.',
        'Guest\'s local fireT cosmetic ticker now matches host\'s fire logic exactly: fireT advances every frame, but is CAPPED at the SPS interval when isStill=false (slot has nonzero velocity in the latest snapshot) or when noSignal=true (aim.hasTarget=false). Modulo wrap only happens when both still and signal — i.e. when the host would actually be firing. Previously the ring cycled unconditionally whenever charge was full, including while the host was sprinting around. Now the partner ring only "ticks" when the partner is actually shooting.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (charge lerp and fireT gating only run inside the snapshot applier and guest cosmetic ticker — both no-ops on solo/host, both gated on activeCoopSession via the existing applier-null short-circuit).',
      ]
    },
  {
      version: '1.20.58',
      label: 'D18.11: COOP DISCONNECT RESILIENCE (SOFT PAUSE + HARD TIMEOUT)',
      summary: ['Playtest on iPhone: when the guest device suspended the app (home button / lock), the run entered a broken half-state. The guest woke up stuck on a "WAITING FOR HOST" overlay forever; the host kept playing solo and even pushed past room boundaries oblivious to the guest being gone. There was no host-side disconnect detection at all (slot 1\'s remote-input adapter just produced inactive frames when the ring was empty), and the guest\'s 30s watchdog was gated off during boon-phase so a suspend during pick was unrecoverable. Both peers now share a symmetric liveness monitor with quick soft-pause feedback and authoritative hard-timeout teardown.'],
      highlights: [
        'New coop heartbeat: every 2.5s while a coop run is active, both peers send {kind:"coop-heartbeat"} and stamp coopLastInboundAtMs on every inbound packet (any kind — heartbeat, input, snapshot, boon-pick, color, etc.). This decouples liveness from gameplay activity, so a slow boon picker no longer false-trips the watchdog and a suspended peer is detected within seconds even when no input/snapshot would normally be flowing.',
        'Soft-disconnect gate (7s of silence): freezes sim stepping and snapshot broadcasts on host, freezes guest prediction, and shows "PARTNER DISCONNECTED · waiting for reconnect…" overlay. RAF stays alive (rubber-duck blocking issue #2) so recovery + the hard-timeout check keep running. Any inbound packet — heartbeat counts — clears the soft state and resumes the sim with simAccumulatorMs reset to 0 so we don\'t fire a catch-up burst that would jump entities and break guest reconciliation.',
        'Hard-disconnect gate (30s of silence): trips unified teardown via the existing tripCoopDisconnectWatchdog path — cancels RAF, runs teardownCoopRunFully, returns to the start screen with a "CONNECTION LOST" banner. Symmetric on both peers. Runs from BOTH the main-loop gate (covers playing/dying gstate) AND a separate setInterval inside the heartbeat tick (covers boon-phase / upgrade gstate where RAF is cancelled by design — this was the exact case where the iPhone "stuck on WAITING FOR HOST" bug originated).',
        'visibilitychange + pagehide listeners send a best-effort {kind:"coop-bye"} beacon when the local tab goes away (rubber-duck blocking issue #3 — beacon is an accelerator only, never load-bearing). Partner receives it, immediately enters soft-disconnect by rewinding their coopLastInboundAtMs past the soft threshold rather than waiting 7s. On pageshow / visible: if we were hidden longer than the hard timeout, trip teardown immediately so the user doesn\'t race the watchdog from a stale resumed tab.',
        'Determinism canary 11/11 byte-identical: all new logic is gated on activeCoopSession (null in solo / canary), liveness ticking only happens with a live transport, and the new wall-clock branches never mutate sim state outside coop runs. All 24 suites green; the change is purely additive coop-only resilience.',
      ]
    },
  {
      version: '1.20.57',
      label: 'D18.10b: PC END-SCREEN LAYOUT + RING CYCLING + BULLET COLOR',
      summary: ['Three playtest follow-ups from D18.10: (1) bullets fired by the partner rendered in the LOCAL player\'s color instead of the partner\'s — both peers saw all bullets in their own palette. (2) The host\'s fire-ready ring on the GUEST device showed a permanent full fill instead of cycling with SPS — guest had no visual cue when the host was about to shoot. (3) The PC coop end screen had the in-run top HUD (ROOM N, PAUSE, score, STORED CHARGE, SPS) painting on top of the breakdown rows in the middle of the panel; iPhone was clean. Desktop was unusable.'],
      highlights: [
        'showCoopGameOverScreen no longer calls setMenuChromeVisible(true). On non-compact (desktop) viewports, that call activated CSS rules that hid #cv and collapsed #wrap to top-hud height, leaving .screen (inset:0 of #wrap) bound to a tiny area while content overflowed downward. Solo\'s showGameOverScreen has never called setMenuChromeVisible — it overlays the screen on top of the live in-game layout. Coop now matches.',
        'Guest\'s local fireT ticker (used to drive the partner\'s fire-ready ring on the guest screen) now wraps modulo the SPS interval (1 / (sps * 2)) instead of accumulating dt unbounded. Previously, when chargeFrac >= 1 the ticker grew forever and fireProgress saturated at 1 — ring stayed full. Now it cycles: filling, firing, refilling, exactly like the host renders it.',
        'drawBulletSprite gained an optional getOwnerColorScheme dep that resolves the bullet\'s ownerId to a color scheme when the bullet was fired by the remote partner (in coop). Local-owned bullets and solo/host paths default to the existing C.green/C.ghost palette — byte-identical to before. Partner bullets now render in the partner\'s chosen color (matching the body, ring, and aim arrow per D18.7/D18.9).',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (deps default null preserves the C.green/C.ghost path exactly for solo + host slot 0 sim).',
      ]
    },
  {
      version: '1.20.56',
      label: 'D18.10: COOP END-SCREEN BREAKDOWN PARITY',
      summary: ['Playtest screenshots showed the coop end screen looked very different from the solo end screen on the GUEST side: no score breakdown rows, no "X kills · Room N · M:SS" footer. D18.8 had already extended the coop-game-over packet to include breakdown/stats/boonIds and wired renderScoreBreakdown into #s-go-coop, but a guest-side bug in gameOver() was wiping the host-supplied payload before the screen could render it.'],
      highlights: [
        'gameOver() previously called coopGameOverPayload = buildCoopGameOverPayload() unconditionally on both peers. On guest, buildCoopGameOverPayload() builds from local state (scoreBreakdown is empty, kills is 0 — guest doesn\'t run the authoritative sim) so it overwrote the host\'s authoritative breakdown that had been stashed by handleCoopGameOverPacket moments earlier. Guard now: rebuild only when the local peer is host, or as a fallback if no host packet has arrived yet.',
        'handleCoopGameOverPacket also re-renders the end screen if it\'s already visible. Race protection: if the guest\'s local game-over (triggered by its own slot dying) ran before the host\'s coop-game-over packet landed, the screen used to stay blank-breakdown forever; now the late packet refreshes it with the authoritative data.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (changes are guest-side UI plumbing — host sim path untouched).',
      ]
    },
  {
      version: '1.20.55',
      label: 'D18.9: PARTNER AIM RETICLE USES PARTNER COLOR',
      summary: ['Playtest gap from the D18.7 color-sync work: drawGuestSlots was already passing the partner\'s colorScheme to drawGhostSprite (so the body, glow, charge ring, and HP bar render in the partner\'s color), but the aim reticle triangle drawn just below the sprite still hardcoded C.getRgba(C.green, 0.6) — the LOCAL player\'s color. Result: host saw the guest body in the guest\'s color but the guest\'s aim arrow in the host\'s color (and vice versa). The arrow should match the slot it belongs to.'],
      highlights: [
        'drawGuestSlots aim-arrow fillStyle now resolves the partner\'s hex via getColorSchemeForKey(coopPartnerColorKey) and falls back to C.green when the coop-color handshake hasn\'t landed yet (or in COOP_DEBUG split-screen where there\'s no remote partner). Local player\'s own aim arrow (drawn by the host slot-0 path) is unchanged — uses C.green which is already the local player\'s color.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (render-only change, partner color path is online-coop only).',
      ]
    },
  {
      version: '1.20.54',
      label: 'D18.8: COOP END-SCREEN PARITY + WAITING-FOR-PARTNER OVERLAY',
      summary: ['Two playtest gaps: (1) the coop end-of-run panel (#s-go-coop) had only score + roster + room number — no breakdown, no "Run Boons" review, no Leaderboards button — making it feel sparse compared to the solo end panel. Players wanted feature parity with the solo s-go screen. (2) Between boon picks, when the host picked a boon before the guest, the host\'s screen reverted to a frozen frame with no "WAITING FOR PARTNER…" indicator — the wait overlay was guest-only. The guest already showed an overlay when waiting on host, but host saw nothing.'],
      highlights: [
        'Coop end screen now matches solo: added go-coop-breakdown (uses the same renderScoreBreakdown helper as solo, exported from src/ui/gameOver.js), go-coop-note (kept blank by default — empty:hidden via CSS), Run Boons button + go-coop-boons-panel that renders the LOCAL player\'s loadout (host shows slot 0 / global UPG; guest shows slot 1\'s independent UPG per D14.1), and Leaderboards button (btn-lb-open-go-coop wired through the existing bindLeaderboardControls). Host/guest roster cards + Rematch + Leave buttons preserved.',
        'coop-game-over packet extended with breakdown + stats + boonIds so guest mirrors the same breakdown rows + kill/room/duration footer that the host sees. Guest\'s own scoreBreakdown is empty (it doesn\'t sim) — without this, the breakdown panel was always blank on guest\'s end screen.',
        'CSS: #go-score, #go-sub, #go-note, #go-boons-panel, #go-boons-list rules generalized to also match the coop variants (#go-coop-score, #go-coop-sub, #go-coop-note, #go-coop-boons-panel, #go-coop-boons-list). No new selectors fork; visual parity is enforced at the stylesheet level.',
        'Boon-pick wait overlay is now symmetric: when host picks first and guest hasn\'t responded yet, host sees "WAITING FOR PARTNER…" instead of a frozen frame. tryResumeCoopBoonPhase clears the overlay before resumePlayAfterBoons fires; existing handleCoopRoomAdvanceGuest + teardownCoopRunFully paths already clear it on guest. AFK auto-resolve still fires on the existing 30s timer.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (changes are end-screen UI + coop-only overlay logic — no sim-path mutations).',
      ]
    },
  {
      version: '1.20.53',
      label: 'D18.7: GUEST MOVEMENT RESTORE + PARTNER COLOR SYNC',
      summary: ['Two playtest regressions: (1) v1.20.52\'s D18.6 cosmetic-tick refactor accidentally removed the updateOnlineGuestPrediction(dt) call from the guest update gate, so the guest body stopped moving at all on its own screen — only host snapshots could move it (and they only re-anchor on death/respawn, not continuously). (2) Player color choice never crossed the network: each peer rendered both ghosts in its own locally-chosen palette, so the host saw the guest as the host\'s color and vice versa — the user picked pink as host, guest saw the host as the guest\'s color, host saw the guest as pink. Backwards from the intent.'],
      highlights: [
        'Restored updateOnlineGuestPrediction(dt) inside the guest update gate, immediately before the new D18.6 cosmetic-tick block. Prediction runs first (so the joystick adapter advances the local body this frame), then cosmetics decay, then the early-return. Solo / host paths untouched.',
        'New coop-color gameplay message: each peer broadcasts its colorKey on slot install (host on slot 1 install, guest on slot 1 install) and on every local color change via the existing phantom:player-color-change event hook. Receiver stores it on coopPartnerColorKey + auto-echoes back its own key on first receive so a late slot-install doesn\'t miss the handshake. Cleared by teardownCoopRunFully so a new coop run re-handshakes from scratch.',
        'drawGhostSprite gained an optional `colorScheme: { hex, light, dark }` parameter. When passed, all reads that previously hit the global C palette (C.green, C.ghost, C.greenRgb, C.ghostBodyRgb, C.getRgba(C.green,...)) use the override instead — body fill, ghost glow, charge-ring color, eye shimmer, HP-bar color. When omitted (solo / local player), reads from C exactly as before — byte-identical canary preserved.',
        'drawGuestSlots now passes getColorSchemeForKey(coopPartnerColorKey) to drawGhostSprite for the partner ghost. Falls back to null (= legacy C reads) until the handshake completes, so the very first frames after coop start still render something rather than blanking out. Local player\'s drawGhost is unchanged: its own ghost still uses the local C palette which is already the player\'s chosen color.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (color override defaults to null; render math falls through to existing C reads on the solo/canary path).',
      ]
    },
  {
      version: '1.20.52',
      label: 'D18.6: GUEST COSMETIC TICK + CHARGE RING + ORB FADE + AFK 30S RANDOM + WATCHDOG GATING',
      summary: ['Playtester report bundle on the online-coop guest: (1) charge rings around either player never animated on the guest screen even at full charge; (2) collected grey orbs sat at full alpha and never faded out; (3) when the guest was hit by a projectile the bullet + damage number froze in place at the hit location forever; (4) sitting on the boon picker for ~30s booted everyone with a "disconnected" message even when the network was fine. Root causes were a single shared theme: the guest\'s update() early-returns and never ticks particles/dmgNumbers/shockwaves/payloadCooldownMs, the snapshot wire format intentionally omits cosmetic-only fields (fireT, decayStart) which the guest then never re-derived locally, and the disconnect watchdog ticked unconditionally even when the host had legitimately stopped emitting snapshots during the boon picker.'],
      highlights: [
        'Guest cosmetic tick: particles, dmgNumbers, shockwaves, and payloadCooldownMs are now ticked on the guest before its update() early-return — math is byte-identical to the host\'s tick block lower in update(). Result: damage numbers float up and fade, hit sparks dissipate, and bullets no longer freeze at the hit location on the guest screen.',
        'Charge ring animation on guest: the snapshot intentionally omits slot.metrics.fireT (cosmetic-only), so the firing-ring on both slots used to render empty even when fully charged. The guest now ticks fireT locally per slot when its charge is at max, resetting to 0 when charge drops below max. Both the local guest\'s ring (drawGhost) and the partner ring (drawGuestSlots) animate again.',
        'Grey orb fade on guest: snapshots also omit bullet.decayStart. Without it the bullet renderer\'s age math collapses to NaN and the orbs stay at full alpha. Added a guest-only Map<bulletId, simNowMs> that stamps decayStart on first sight of a grey bullet and removes the entry on state transitions or bullet-removal so the map can\'t grow unbounded. Re-stamps if a bullet ever re-enters grey.',
        'Boon AFK auto-resolve is now 30s (was 60s) and picks RANDOMLY from slot 1\'s offered ids (was deterministic [0]). True-disconnect detection is reserved for the watchdog; an inattentive player just gets a random boon and the run continues.',
        'Watchdog timeout 4s → 30s + boon-phase gating: COOP_WATCHDOG_TIMEOUT_MS bumped to 30000 because the previous 4s threshold was too aggressive for any real-world transient stall. More importantly, the watchdog now skips entirely while the boon-phase / upgrade gstate is active, since the host intentionally cancels its RAF and stops emitting snapshots between rooms — that pause is no longer mistaken for a dropped transport.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (all changes are guest-render-only or coop-only constants — no sim-path mutations).',
      ]
    },
  {
      version: '1.20.51',
      label: 'D18.4: DESKTOP CANVAS PINNED TO PHONE WIDTH',
      summary: ['Playtester report: in solo and coop, the PC canvas was visibly wider left-to-right than the phone canvas, making the arena feel "drastically oversized" relative to the phone reference. Cause: the resize() cap was 380→400 wider than typical phone viewports — most phones hit the `viewportWidth - 16` rail (~374-380) while desktops always hit the 400 rail. World size scales with canvas, so the arena itself was larger on PC.'],
      highlights: [
        'Lowered canvas width cap from 400 to 380 in both script.js resize() and styles.css #wrap rule. iPhone 14 Pro Max-class devices (430 CSS px) and desktops now both render at 380 CSS px wide; smaller phones (≤396 CSS px) are unaffected because they hit the `viewportWidth - 16` cap first.',
        'Net effect: desktop canvas is now within ~3 CSS px of typical phone canvas — visually identical. World dimensions match across devices, so entity placement, spawn coords, and HUD spacing render the same regardless of form factor.',
        'Tests: all 24 suites green; determinism canary 11/11 (world size is canvas-derived but the resize() cap is a render-only ceiling, not a sim parameter).',
      ]
    },
  {
      version: '1.20.50',
      label: 'D18.3: COOP UNIFIED TEARDOWN + DISCONNECT WATCHDOG',
      summary: ['Bug class: when a coop run ended abnormally (transport silently dropped, host backgrounded, render error), the guest sat frozen with no signal — and the runtime\'s listeners + timers (snapshot applier, input uplink, rematch session, AFK boon timer) lingered as zombies. Tapping "Main Menu" then trying to start a fresh solo run wedged the start screen because those zombies fought the new run for control of playerSlots[1] and activeCoopSession. The user had to restart the app to recover.'],
      highlights: [
        'Added teardownCoopRunFully(reason) — one always-call function that disposes rematch listener+session, calls teardownCoopInputUplink (applier/broadcaster/slot 1/world pin/wait overlay), clears coopBoonAfkTimer + currentBoonPhaseId + pendingCoopBoonPicks + coopBoonPickBuffer, calls clearCoopRun(), and resets the watchdog. Idempotent — every step is null-guarded so double-calls are safe.',
        'Disconnect watchdog (guest-only): tracks latestRemoteSnapshotRecvAtMs (already populated by the snapshot ingest path). In the RAF loop, if frameStartTs - latestRemoteSnapshotRecvAtMs > 4000ms AND we\'ve received at least one snapshot, fires once: shows a "CONNECTION LOST · returning to menu" overlay, then after a 1.2s read delay cancels RAF, runs unified teardown, and returns the user to the start screen with menu chrome restored (s-start visible, s-up/s-go/s-go-coop/s-coop-lobby hidden, pause button hidden, patch-notes button visible).',
        'Wired exit-to-menu through unified teardown: pauseController accepts a new optional onExitToMenu callback; script.js wires it to teardownCoopRunFully(\'pause-exit-to-menu\'). Now an in-coop pause→Main Menu always cleans up before showing the menu.',
        'Refactored leaveCoopGame to call teardownCoopRunFully instead of the previous disposeCoopRematchSession + clearCoopRun pair, picking up AFK-timer + boon-phase + watchdog cleanup that the old path missed.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical (no sim-path changes).',
      ]
    },
  {
      version: '1.20.49',
      label: 'D18.2: GUEST LOCAL-SLOT AIM TRIANGLE + INVULN BLINK FROM LOCAL DATA',
      summary: ['Bug: on the online guest, the player blink, payload-ring indicator, and aim triangle were all sourced from slot-0 globals (player.x/y, player.invincible, playerAimAngle, playerAimHasTarget). On a guest, slot 0 is the HOST, so the guest saw the host\'s aim arrow anchored to the host\'s body — never their own. The body blink was also gated on the host\'s invuln, so it would flicker when the host was hit instead of when the guest was hit.'],
      highlights: [
        'Refactored the player-render block in draw() to source position, UPG, aim, and invuln from getLocalRenderSlot() instead of slot-0 globals. Solo/host paths are unchanged: slot 0 bridges to the legacy globals via getters/setters, so the determinism canary remains byte-identical (verified 11/11 + all 24 suites green).',
        'Guest now sees their own aim triangle anchored to their own body, using their own slot.aim.angle/hasTarget (already wired via D13.4 snapshot fields), and blinks based on their own invincibility timer.',
        'Payload-ring indicator now uses the local slot\'s body/UPG with a graceful fallback to the global payloadCooldownMs when slot.metrics doesn\'t track it (host slot 0 keeps the global path → byte-identical).',
        'Foundation for the rest of D18 (HUD parity for charge ring, hp bar, etc.) — same routing pattern can be applied as needed.',
        'Tests: all 24 suites green; determinism canary 11/11.',
      ]
    },
  {
      version: '1.20.48',
      label: 'D18.5: PAUSE-FROM-BOON MENU EXIT + BUTTON-STATE LEAK FIX',
      summary: ['Bug: pausing during the upgrade/boon-pick screen and clicking "Main Menu" appeared to do nothing — the s-up boon picker stayed visible over the start screen. Then any subsequent boon click reanimated the in-run UI: pause button replaced the patch-notes button on the menu and the RAF sim restarted behind the chrome.'],
      highlights: [
        'pauseController.exitToMenu now also hides the s-up boon picker before showing s-start, so the user immediately sees the menu instead of an overlaid picker.',
        'resumePlayAfterBoons short-circuits when gstate is "start" or "gameover" — clears coop boon-phase state + AFK timer + s-up panel, then returns without flipping pause-button visibility or restarting the loop. Prevents stale boon clicks (e.g. the user picked a boon after exitToMenu fired) from leaking in-run UI into the menu.',
        'D18 plan document added in session workspace covering 5 active playtest issues: D18.1 guest hit-freeze, D18.2 guest local-slot HUD parity (charge ring + aim triangle), D18.3 unified coop teardown + disconnect watchdog, D18.4 desktop sizing matches phone exactly, D18.5 (this).',
        'Tests: all suites green; determinism canary 11/11.',
      ]
    },
  {
      version: '1.20.47',
      label: 'COOP PHASE D15: DEDICATED END-OF-RUN SCREEN + REMATCH',
      summary: ['Co-op runs were ending on the solo game-over panel, which had no path back into another co-op run together — players had to leave to the lobby and re-pair every time. D15 swaps in a dedicated coop end screen with both runners\' names, the team score, REMATCH (loop straight back into another run on the same lobby) and LEAVE.'],
      highlights: [
        'New screen #s-go-coop with HOST/GUEST roster cards (large name tags), team score, and "Room N reached" meta line. The solo s-go panel is bypassed entirely when coopRematchSession + coopRematchRole are set, so coop runs never see the wrong end UI.',
        'Session preservation: gameOver() now captures activeCoopSession into coopRematchSession BEFORE clearCoopRun + teardownCoopInputUplink fire. After teardown, a separate listener (installCoopRematchListener) is installed on the same session for coop-rematch / coop-leave / coop-rematch-request packets — the realtime channel survives the run-over so peers can talk.',
        'coop-game-over packet extended with hostName/guestName so both peers render the same roster regardless of whether they triggered the death. Guest mirrors score + roomIndex from host\'s payload (already did) plus now the names into coopGameOverPayload.',
        'REMATCH (host): generates a fresh seed, broadcasts coop-rematch { seed }, re-arms the pending coop run with the SAME session+role+code, then runs init() + restarts the loop. installCoopInputUplink internally tears down + re-installs on the same session, so the transport channel is reused.',
        'REMATCH (guest): button reads "Request Rematch" → sends coop-rematch-request to host. Host auto-accepts in v1 (no confirmation prompt), broadcasts coop-rematch with a new seed; both peers call startCoopRematchRun in parallel. Guest\'s button shows "Waiting for host…" until the rematch packet arrives.',
        'LEAVE: broadcasts coop-leave so partner sees "Partner left the run." status, then clearCoopRun + dispose rematch session refs and return to the start screen. Partner\'s rematch button disables on receipt.',
        'Name input on the coop end screen wired to setPlayerName(syncInputs:true) so changes propagate to all name inputs (start screen, solo go screen) and persist to localStorage.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical. D15 is purely a presentation + transport layer change — no sim/seed paths touched.',
        'Known limitations (v1): host pulls all rematch authority (seed gen + start). No version handshake on rematch yet — if the host reloads to a newer build mid-pair, mismatch detection is deferred to a later coop-handshake phase. Score split per peer is still unified team score; per-slot leaderboard is a separate D17 task.',
      ]
    },
  {
      version: '1.20.46',
      label: 'COOP PHASE D14: PER-PEER BOON PICKS (SLOT-1 SAFE WHITELIST)',
      summary: ['Until now coop ran a "team boons" model: only the host saw a picker, and slot 1 inherited host\'s UPG via mirrorHostUpgToSlot1 on every room transition. Players asked for guests to pick their own boons. D14 splits picks per-peer: host picks for slot 0 from the full pool; guest picks for slot 1 from a curated whitelist of boons that work correctly when applied in isolation to a single slot.'],
      highlights: [
        'D14.1 Per-peer UPG: removed the per-room mirrorHostUpgToSlot1 call from resumePlayAfterBoons. Slot 1 now evolves its own UPG independently. Initial state still matches across peers because both installOnlineCoopHostSlot1 and installOnlineCoopGuestSlot1 seed slot 1 with getDefaultUpgrades() at session start.',
        'D14.2 Boon-pick handshake: host enters phase → broadcasts coop-boon-start { roomIndex, phaseId, slot1BoonIds: [int,int,int] } where boonIds are stable indices into the BOONS array (names are unsafe — `Gravity Well` is duplicated). Each peer renders its own picker, sends coop-boon-pick { phaseId, slotId, boonId }. Both peers apply both picks locally so slot 0 and slot 1 UPGs stay mirrored; host gates resumePlayAfterBoons until both flags are set. Out-of-order picks arriving before coop-boon-start are buffered by phaseId and drained on phase entry. Stale picks (phaseId < current) are dropped.',
        'D14.3 Slot-1 safe whitelist (v1): only 22 boons are eligible for slot 1 — those that purely mutate slot.upg fields consumed by firePlayer / collisions / charge math (Rapid Fire, Ring Blast, Backshot, Snipe Shot, Twin Lance, Bigger Bullets, Faster Bullets, Critical Hit, Ricochet, Homing, Pierce, Quick Harvest, Decay Extension, Capacity Boost, Deep Reserve, Wider Absorb, Long Reach, Kinetic Harvest, Steady Aim, Ghost Velocity, Extra Life, plus Heal). Boons that hook globals (shields, room-regen, gravity-well, mirror-tide, blood-pact, EMP, predator, etc.) are excluded for slot 1 in v1 — a per-slot boon-hook refactor is deferred to a future phase. Slot 1 cannot pick legendaries v1.',
        'AFK timeout: 60s host-side timer auto-resolves slot 1 to slot1BoonIds[0] if guest doesn\'t pick (e.g. backgrounded the tab), then synthesizes a coop-boon-pick echo so guest\'s slot1.upg stays in sync when they return. Host legendary picks send a sentinel coop-boon-pick { slotId:0, boonId:-1 } so guest knows host completed without needing to mirror anything.',
        'Guest sim freeze: handleCoopBoonStartGuest now sets gstate=\'upgrade\' and cancels the RAF loop while the picker is open, mirroring host pause behavior. handleCoopRoomAdvanceGuest restores the loop. Without this, the predicted body kept moving while the picker was open and would snap on close.',
        'boonSelection.js: added boonsOverride param. When supplied as a non-empty array it bypasses pickBoonChoices (which uses simRng — host/guest can drift) and the reroll handler is hard-disabled. Solo and offline coop are unchanged.',
        'Tests: all 24 suites green; determinism canary 11/11 byte-identical. No new test was needed — the existing test-coop-boon-queue covers the COOP_DEBUG queue path (untouched), and the new wire format is exercised at runtime. Future test-coverage opportunity: end-to-end host+guest simulator that exchanges the new packets.',
        'Known limitations (v1): excluded boons require deeper sim work to be slot-1 safe; no slot-1 legendaries; AFK auto-pick uses first option deterministically. These are tracked for a future D14b/D17 refactor pass.',
      ]
    },
  {
      version: '1.20.45',
      label: 'COOP PHASE D13: GUEST GAMEPLAY PARITY (RESPAWN, ORB PICKUP, HURT ANIM, AIM ARROW)',
      summary: ['After D12.4 sync was solid, but the guest still felt like a passenger. D13 closes four parity gaps in one pass: (1) on death the guest\'s predicted body never re-anchored to spawn because hp returns to max in the same host tick the slot dies — the alive flag never flips false in any serialized snapshot. (2) Slot 1 walked through grey/charge orbs without picking them up — the absorb scan only ran for slot 0. (3) The guest never saw a hurt-animation wobble or damage number on its own slot 1 because host-side distort/dmg# were local-only. (4) The guest had no aim-arrow triangle, only the host did.'],
      highlights: [
        'D13.1 Respawn anchor: bodies now carry a respawnSeq counter, incremented in respawnGuestSlot and propagated via the snapshot wire (new optional respawnSeq field, defaults to 0). snapshotApplier treats any seq change as a force-anchor trigger alongside aliveEdge and roomChanged, so the guest\'s predicted slot 1 teleports to spawn on death even when the death+respawn collapses into one host tick.',
        'D13.2 Slot-1+ grey orb absorb: added a per-slot absorb branch after the slot-0 grey path. Iterates ascending slot id (deterministic), uses per-slot absorbRange (slot.body.r + 5 + slot.upg.absorbRange), clamps to slot.upg.maxCharge so the ring never overflows, and explicitly does NOT inherit slot-0 host-only timer state (no _barrierPulse / _chainMagnet bonuses) so slot 0\'s deterministic boon timeline stays untouched. Determinism canary unaffected.',
        'D13.3 Hurt animation: snapshot now carries body.distort. The applier writes it onto the predicted body each frame so the ghost renderer\'s wobble effect plays on the guest\'s screen for slot 1\'s hits. Added invuln-blink in drawGuestSlots (every 90ms tick while invincible > 0) matching host slot-0 behavior. snapshotApplier also exposes an onSlotDamage callback that fires once per fresh snapshot (gated on shift, not on every render frame) when a slot\'s hp drops vs. previous; the script wires it to spawnDmgNumber + sparks in player color, so guests now see local damage feedback. Lethal hits remain a known limitation: hp goes maxHp→max same tick, so neither distort nor the dmg number renders for the killing blow — accepted for D13.',
        'D13.4 Guest aim arrow: snapshot gained a hasTarget bool; drawGuestSlots replicates the host\'s aim-triangle render (script.js:4759) for each guest slot using slot.aim.angle and the per-slot body radius. Triangle is hidden when hasTarget is false (no enemies to lock on) and during invuln-blink off-frames so it doesn\'t stutter through the blink effect.',
        'Tests: all 23 suites green; determinism canary 11/11 byte-identical. New optional snapshot fields default safely (?? 0 / !!) so existing test-coop-snapshot fixtures pass without modification. No regressions in solo (no slot 1 exists, all new code paths early-out on playerSlots.length <= 1).',
      ]
    },
  {
      version: '1.20.44',
      label: 'COOP PHASE D16.1: UNIFIED ARENA ASPECT (PC + MOBILE)',
      summary: ['Playtest screenshots showed the PC and iPhone clients rendering wildly different play areas in BOTH solo and coop. The iPhone got the intended tall portrait arena (1.78×W height) while PC was capped at 1.34×W height. Because entity spawn coordinates (busters at top/bottom corners, obstacle layouts, room intro placement) are calibrated to the tall portrait world, on PC the top busters were getting clipped off-screen and the bottom row was bunched against the canvas edge. This shipped as a coop fix but applies to solo too.'],
      highlights: [
        'resize(): collapsed BASE_ARENA_ASPECT (1.18) and maxArenaAspect (phone 1.78 / desktop 1.34) into a single ARENA_ASPECT = 1.78 used everywhere. Every device now sees the same tall portrait arena; on shorter desktop windows the canvas shrinks in width to keep the aspect locked rather than squishing height.',
        'Removed the isPhoneWidth / desktop branch entirely from canvas sizing. The viewport-height path (maxWidthByHeight) handles narrow desktop windows by clamping width down so the locked-aspect height fits available space.',
        'finalHeight is now simply finalWidth × ARENA_ASPECT — no more max(baseHeight, min(avail, extendedCap)) flattening. The canvas always preserves a consistent aspect, which means coop guest and host see the same world layout regardless of device.',
        'Side benefit: solo PC players now see the same map proportions as solo iPhone players. Obstacles and busters are no longer cut off or compressed on desktop. Determinism is unaffected (sim is world-coordinate; aspect change is presentation-only).',
        'Tests: all 23 suites green; determinism canary 11/11 byte-identical. No new tests were added — this is a presentation tweak with no sim impact.',
      ]
    },
  {
      version: '1.20.43',
      label: 'COOP PHASE D12.4: SLOT-1 ROOM-RESET + CHARGE FIX',
      summary: ['Two playtest issues after v1.20.42 shipped: (1) the guest\'s body did not reset to room center between rooms — only host\'s slot 0 was teleported by startRoom(), so slot 1 stayed wherever it was at room-clear and felt "stuck off-spawn" after every boon screen; (2) slot 1 was auto-firing constantly on the host without the guest needing to earn charge through gameplay. Pre-D12.4 updateGuestFire built charge at +1.0/s while the guest was still, but slot 0 has no equivalent free regen — it gains charge only through kinetic movement (moveChargeRate boon) or absorb/hit boons. Slot 1 was effectively cheating.'],
      highlights: [
        'startRoom now resets every guest slot\'s body to a center spawn (offset by ±60 px so slots don\'t overlap), zeroes velocity, refreshes spawnX/spawnY for the respawn-on-death path, and grants 1 s of spawn invuln. Snapshots already carry the new positions; the next change makes the guest\'s local prediction adopt them.',
        'snapshotApplier: applySlot now accepts `roomChanged` as a force-anchor trigger alongside `aliveEdge` and `!prevSnapSlot`. apply() detects prev.room.index !== curr.room.index and passes it through, so the guest\'s predicted slot 1 body teleports to the new spawn on every room transition instead of holding its previous position.',
        'updateGuestFire: removed the "+dt while still" auto-charge build. Slot 1 no longer charges just by standing still. This matches slot 0\'s design where standing still does not regen charge — only kinetic movement (with the Kinetic Harvest boon mirrored from host) or absorb/hit mechanics generate charge. Without the boon, slot 1 stays at 0 charge and does not fire — same behavior as a host with no charge sources.',
        'updateGuestSlotMovement: added kinetic-charge gain for guest slots while moving, mirroring the host\'s line at script.js:3576 (gainCharge with getKineticChargeRate). Gated on UPG.moveChargeRate > 0 (i.e. the host has Kinetic Harvest) and on combat phases (spawning|fighting). UPG is mirrored from host via mirrorHostUpgToSlot1, so any boon the host picks up benefits slot 1\'s charge gain too.',
        'Tests: updated test-guest-fire.mjs to drop the obsolete "still builds charge" assertion and add a "still+no-enemy does NOT build charge" guard against regression. All 24 suites green; determinism canary 11/11 byte-identical (host slot 0 path untouched).',
      ]
    },
  {
      version: '1.20.42',
      label: 'COOP PHASE D12.3: SLOT-1 GRADUAL DRIFT FIX',
      summary: ['Playtest revealed slot-1 movement starts perfectly accurate at run start, then progressively desyncs each room until guest no longer appears to move on the host. Diagnostics from v1.20.41 plus the symptom pattern pinned it to the remote-input-buffer staleness check, not transport. Each between-room boon screen pauses the host\'s simTick (gstate != "playing") while the guest\'s simTick keeps advancing — so guest input frames accumulate ahead of host\'s clock. The pre-D12.3 adapter used `Math.abs(t - frame.tick) > 12` which marked "future" frames stale just as harshly as ancient ones; once cumulative drift crossed 12 ticks (~200 ms), the host froze slot 1.'],
      highlights: [
        'Staleness check is now one-sided: only frames in the PAST (t - frame.tick > threshold) are considered stale. Future frames represent input the guest just sent that the host hasn\'t caught up to yet, and are always treated as fresh — they\'re the most accurate intent we have.',
        'STALE_TICK_THRESHOLD bumped from 12 ticks (~200 ms) to 60 ticks (~1 s). Tolerates normal cross-device sim-clock drift over long sessions plus host pauses on boon screens, while still suppressing autofire / movement when a peer has truly fallen off (≥1 s of no input).',
        'New `peekNewest()` API on remoteInputBuffer used as the fallback when peekLatestUpTo(t) returns null (i.e. all frames in buffer are after t). Previously the adapter fell through to peekOldest(), which would return an arbitrary ancient frame that no longer reflected the guest\'s current intent — exactly the "appears to stop moving" symptom.',
        'Tests: 5 new cases in test-coop-input-sync.mjs — guest-ahead small/large gap (verifies newest-frame selection + never-stale), past-frame stale at new threshold, configurable threshold still honored, fresh past frame within threshold. All 24 suites green; determinism canary 11/11 byte-identical (sim path unaffected: hostRemoteInputProcessor uses peekAt directly).',
        'Diagnostic infra (?coopdiag=1) from v1.20.41 stays in for one more release in case any drift edge case is reported during the next playtest.',
      ]
    },
  {
      version: '1.20.41',
      label: 'COOP PHASE D12.3: INPUT-CHAIN DIAGNOSTICS',
      summary: ['Playtest after D12.2 surfaced a one-way input bug: host can\'t see guest moving, but guest sees host fine. Snapshots flow host→guest correctly, but guest→host input frames either aren\'t being sent, aren\'t arriving, or aren\'t being consumed by host\'s slot-1 adapter. Without runtime telemetry it\'s impossible to localize the break, so D12.3 ships a no-op-by-default diagnostic mode (`?coopdiag=1`) that logs the entire chain on both peers.'],
      highlights: [
        'New URL flag `?coopdiag=1` enables verbose periodic logging (every 2s) of: simTick, gstate, roomPhase, coopInputSync stats (sent/received/pendingLocal/pendingRemote), hostRemoteInputProcessor stats (lastProcessedTick, processedCount, missCount), playerSlots[1] body x/y/vx/vy, slot.input.moveVector() output, and (on guest) joy.active/mag/dx/dy. Comparing the two peers\' logs side-by-side immediately shows where the chain breaks (e.g. guest sent=0 → joystick not capturing; guest sent>0 host received=0 → transport drop; received>0 processed=0 → tick mismatch).',
        'Per-packet ingest log on `kind:\'input\'` reception: prints role, slot, frame count, first/last tick, first frame still-bit, and current host simTick. Lets us see exactly which guest ticks are arriving and how they line up with the host\'s clock.',
        'Diagnostic interval is started in `installCoopInputUplink` and cleared in `teardownCoopInputUplink`, so it auto-stops on game over / disconnect / app close. Zero gameplay or determinism impact: the flag only adds console.info calls, no sim mutations.',
        'No version bump for the test runner: 24 suites still green, determinism 11/11 byte-identical (diagnostics are flag-gated and outside any sim path).',
        'Players are unaffected unless they explicitly add `?coopdiag=1` to the URL. Production runs see no extra logging.',
      ]
    },
  {
      version: '1.20.40',
      label: 'COOP PHASE D12.2: GUEST UX FIXES',
      summary: ['Post-D12.1 playtest revealed four guest-side bugs that compounded into a "half-broken" feel: the room intro overlay never went away on guest, the host\'s death didn\'t propagate to the guest (game just froze on the last snapshot), the bottom of the arena was clipped on PC browsers when guest viewport had a different aspect from the host, and a stray dev-only blue ring orbited the partner slot. D12.2 fixes all four; per-peer boon picks remains tracked for D15.'],
      highlights: [
        '"READY?" overlay sticking on guest: the room intro state machine (advanceRoomIntroPhase) only runs in the host\'s sim path, which guest skips. Snapshots already carry roomPhase but nothing was hiding the overlay when phase advanced. Snapshot apply now tracks prev/next roomPhase + roomIndex and calls showRoomIntro/hideRoomIntro on the appropriate edges. Guest sees READY?→GO!→fighting in sync with host across every room.',
        'Game-over propagation: host\'s gameOver() now broadcasts a `coop-game-over` packet (with score + roomIndex) BEFORE teardownCoopInputUplink disposes the session. Guest listener mirrors host\'s final score/room and triggers its own gameOver() so the death animation + leaderboard UI run on both peers. Without this, guest sat watching the host\'s last-snapshot pose forever.',
        'Bottom-of-arena truncation on PC browsers: guest\'s canvas was non-uniformly scaled (separate sx/sy) to fit world into a viewport with a different aspect than the host\'s. While mathematically the full world should render, in practice CSS constraints + body overflow occasionally clipped the bottom rows. D12.2 changes the strategy when the world is host-pinned: cv.width/cv.height are set to WORLD_W/WORLD_H exactly (1:1 render transform — no distortion), and only cv.style.width/height are scaled to fit the viewport while preserving the host\'s world aspect ratio. CSS letterboxes uniformly; the canvas always renders the full arena.',
        'Removed the dev-only #6ad1ff marker ring drawn around partner slots in drawGuestSlots. It served as a visual debug during D5 plumbing but is now just a distracting blue halo for players. Slot identity remains conveyed by hat/color/HP bar.',
        'Tests: 24 suites green, determinism 11/11 byte-identical (all changes are guest-side render/UI; host sim untouched).',
        'Known limit kept open: per-peer boon picks still on the host (mirrorHostUpgToSlot1). Both players will see the host\'s boon screen; guest does not get its own picks. This is the D15 milestone — a real two-screen boon flow needs per-peer UPG, separate boonSelectionOrder, and a barrier to wait for both picks before resuming the run.',
      ]
    },
  {
      version: '1.20.39',
      label: 'COOP PHASE D12.1: SHARED WORLD SIZE',
      summary: ['Playtest after D12 surfaced spatial desync: host and guest were each sizing their sim arena to their own canvas. Phones with different viewports had different WORLD_W/WORLD_H, so an enemy at (300, 500) on the host was off-screen on the guest, obstacle layouts diverged, and bullet bounds clipped at different walls. D12.1 pins the guest\'s sim world to the host\'s authoritative dimensions while keeping each device\'s canvas free to scale.'],
      highlights: [
        '`coop-run-start` packet now carries the host\'s `worldW` / `worldH`. The guest applies them via the new `setCoopWorldFromHost()` helper before `launchCoopRun()` runs, so room generation, obstacle picks, and reconciler world-bounds all use the host\'s arena from the very first frame.',
        'New `coopWorldPinned` flag in script.js makes `syncWorldFromCanvas()` a no-op once the world is pinned — subsequent canvas resizes (orientation change, viewport rescale) keep adjusting the canvas pixel size but never overwrite the host\'s world dims.',
        'Renderer already used `worldSpace.getRenderScale(cv.width, cv.height)` to letterbox the world into the canvas via a ctx transform (Phase D0a), so the guest\'s viewport now scales the host\'s arena uniformly on screen instead of cropping to its own canvas. Input is direction-only / unit-vector based, so it\'s scale-invariant — no input adjustments needed.',
        'Pin is released on coop teardown; a subsequent solo run re-syncs the world from the local canvas via the normal path. Solo and `?coopdebug=1` paths are untouched (the pin only engages on online guests after `coop-run-start`).',
        'Tests: 24 suites green. Determinism canary 11/11 byte-identical (worldSpace tests already covered the pure module; the new wiring is host/guest specific and exercised at runtime).',
      ]
    },
  {
      version: '1.20.38',
      label: 'COOP PHASE D12: LATENCY CUT + AUTOFIRE FIX',
      summary: ['First post-D11 playtest revealed two heavy issues: slot 1 (guest\'s player) appeared to fire constantly on the host\'s screen even when the guest was moving, and both peers\' views of each other felt sluggish and stale (positions lagged the actual play by 200ms+ end-to-end). D12 cuts ~50% off the input/snapshot latency stack and adds a staleness guard to the remote-input adapter so missing/old frames no longer trigger phantom autofire.'],
      highlights: [
        'Root cause of "P2 always firing": auto-fire-when-still is the game\'s core fire mechanic. With D11\'s peekOldest fallback returning whatever frame the buffer had — usually a stale `still=1` from before the guest moved — host\'s slot 1 saw a permanent "still" signal and fired every shot interval (~625 ms) until a fresher frame arrived. With 8-frame input batches at 60 Hz the fresh frames landed ~133 ms apart, so the false-still window was wide enough to look like nonstop fire.',
        'Staleness guard on remote input adapter: each lookup now reports `stale: true` when the best matching frame is more than 12 ticks (~200 ms) behind the host\'s simTick, OR when no frame exists at all. moveVector returns `{active:false, stale:true}` and isStill returns `false` (no signal — explicitly NOT still). updateGuestFire respects the new flag: charge build pauses, fire timer caps as if the slot is moving, autofire skipped. When fresh frames resume arriving, fire behavior returns instantly.',
        'Threshold is configurable per adapter via `staleTickThreshold` for testing — default 12 ticks tolerates one full batch + jitter without false positives.',
        'Input batch size halved: 8 → 4 (`createCoopInputSync` default + the lobby wire-up site). Average slot-1 input lag on host drops from 133 ms to 67 ms; guest motion changes (start/stop direction) reach the host roughly twice as fast. Bandwidth stays well under Supabase\'s 20 events/s cap (~15 msg/s outbound input, +15 msg/s inbound snapshots = 15 each direction).',
        'Snapshot rate raised: 10 Hz → 15 Hz (`ticksPerSnapshot: 6 → 4`). Host now broadcasts entity state every 67 ms instead of 100 ms — guest sees the host position update 50% more often.',
        'Render delay tightened: 100 ms → 70 ms in the guest\'s snapshot applier. Still buffers slightly more than one snapshot interval (67 ms) so the 2-snapshot interpolation never starves; takes 30 ms of authoritative-view lag off the guest\'s perception.',
        'Net combined latency improvement: input round-trip (guest move → host applies → snapshot back to guest) drops from ~233 ms to ~137 ms — about 40% off, while staying single-shot under the 20 msg/s rate cap.',
        'Tests: +3 new staleness suite cases on the remote adapter (stale-frame returns stale+isStill=false; fresh-within-threshold passes through; threshold is configurable). Updated the legacy "no frame returns inactive" test to assert the new contract (stale=true, isStill=false). 27 cases in coop-input-sync, 24 suites green overall, determinism 11/11 byte-identical (solo/COOP_DEBUG never use the remote adapter).',
        'Known limits kept open for D13+: guest-side bullet prediction (D5f) — guest\'s own shots still appear after the next snapshot lands, so firing has a perceptible click-to-bullet delay on the guest. Host-tab-hidden policy and auto-rejoin on guest refresh remain unimplemented; both are robustness items targeted for D14.',
      ]
    },
  {
      version: '1.20.37',
      label: 'COOP PHASE D11: SYNC START + TICK-TOLERANT INPUT',
      summary: ['Fixes the two bugs that surfaced in v1.20.36 playtest: (1) host and guest started their sims at independent moments (whoever clicked Start first ran ahead until the other clicked theirs), so simTick clocks were never aligned; (2) host\'s slot-1 remote-input adapter only matched on EXACT tick — once host\'s simTick passed available frames, slot 1 froze on the host\'s screen. Online co-op should now play with the guest visibly moving on the host\'s screen.'],
      highlights: [
        'Synchronized run start: host\'s "Start Run" click broadcasts `coop-run-start` over the gameplay channel and launches its own loop. Guest\'s button is replaced with a disabled "Waiting for host…" label and the guest auto-launches when the start message arrives. One human action, two synchronized sim starts (within a single Supabase round-trip).',
        'Lobby start handler refactored — the launch logic is now a `launchCoopRun()` helper that\'s idempotent (guard against double-launch) and triggered from both the host\'s click path AND the guest\'s `coop-run-start` listener. Listener is unsubscribed once the run launches.',
        'Tick-tolerant remote-input adapter: `peekAt(simTick)` is still the deterministic primary path (used by the host-remote-input processor for ack tracking). When it misses, the adapter now falls back to `peekLatestUpTo(simTick)` — newest frame at-or-before the requested tick — and finally to `peekOldest()` if host is BEHIND any buffered frame (run-start race). Slot 1 keeps moving across simTick drift instead of freezing.',
        'Two new buffer methods on `remoteInputBuffer.js`: `peekLatestUpTo(tick)` (reverse-linear scan, O(1) typical) and `peekOldest()`. Both pure / no side-effects; they don\'t consume frames so the processor\'s exact-tick `hasFrameFor` accounting (for snapshot `lastProcessedInputSeq[1]`) stays unchanged.',
        'Both fixes are independent — sync-start brings the two simTick clocks within one network RTT of each other, tick-tolerant lookup absorbs the residual drift + jitter + boon-pause-induced gaps. Together: guest\'s player visibly moves on host\'s screen.',
        'Test state: 24 suites green (415+ assertions). Determinism canary 11/11 byte-identical. The new fallback paths are invoked only when exact-tick match fails, so the determinism replay (which always calls peekAt against ticks for which a frame was just pushed) never touches the new code paths.',
        'Known limits this ship: (a) if guest reloads or refreshes after pressing Start, they get stuck on the lobby ready view (no auto-rejoin) — pre-existing. (b) if host clicks Start while guest\'s tab is backgrounded, guest may miss the start message until rAF resumes — they\'ll be a few seconds behind on tick alignment but the tick-tolerant adapter will keep their input flowing. (c) snapshot interpolation lag (~100ms) means guest still feels a slight delay on slot 0\'s position — predicted by D5d for slot 1 only.',
        'Known limits inherited: D10 team-boons (host picks for both), no leaderboard for coop runs, no host-tab-hidden policy.',
      ]
    },
  {
      version: '1.20.36',
      label: 'COOP PHASE D10: MULTI-ROOM BOONS',
      summary: ['Co-op runs no longer end after room 1. When the host clears a room, a `coop-boon-start` message hits the gameplay channel, the host opens the standard boon picker, and on confirm the host\'s upgraded UPG is mirrored onto guest slot 1 + a `coop-room-advance` hint clears the guest\'s wait overlay before the next snapshot lands. Both peers proceed into the next room together. Online co-op is now multi-room playable end-to-end.'],
      highlights: [
        'Replaces C3a-min-1 single-room termination (`endCoopDemoRun`) with `enterOnlineCoopBoonPhaseHost()` at the `clearStep.shouldShowUpgrades` branch. The unused demo-end function has been removed.',
        'Two new gameplay-channel message kinds: `coop-boon-start` (host → guest, fires when host opens the picker) and `coop-room-advance` (host → guest, fires when host\'s pick is applied and the next room is starting). Guest-only handlers wired alongside existing input/snapshot branches in `installCoopInputUplink`.',
        'Guest renders a "PARTNER PICKING A BOON…" full-screen overlay (#coop-wait-overlay) on `coop-boon-start` and clears it on `coop-room-advance`. Pure DOM injection — no extra CSS file changes — overlay is non-interactive (pointer-events:none) so it doesn\'t block input batching.',
        'Boon-application model v1: team boons. Host picks once per room (full legendary path included); the resulting UPG state is deep-cloned (JSON) and mirrored onto `playerSlots[1].upg` in-place (slot.upg is a frozen closure ref so we mutate keys rather than reassign). This means slot 1\'s authoritative bullets fire with the same stat/orb/shockwave/echo configuration as slot 0.',
        'Per-peer picks (each player chooses their own boon) are deferred — would require sending guest\'s picker state both ways, surfacing a richer overlay UI, and handling both-locked-in lockout. v1\'s host-picks-for-both keeps the protocol to two host→guest messages and ships today.',
        'Session reference is now captured at `installCoopInputUplink` time into a module-level `activeCoopSession` so non-uplink code paths (boon entry/advance) can publish messages without re-plumbing the session object through every call site. Cleared on teardown.',
        'Wait overlay + boon-phase state are reset by `teardownCoopInputUplink`, so leaving online mode (game over, leaving lobby, role change) leaves no stale UI behind.',
        'Test state: 24 suites green, determinism 11/11 byte-identical. New behavior is gated to `isCoopHost()` / role==="guest" and never touches solo / COOP_DEBUG sims.',
        'Known limits this ship: (a) host\'s tab being hidden during a pick still freezes the broadcaster — guest will sit on the wait overlay until host returns. (b) if `coop-boon-start` is dropped, guest sees no overlay but the next snapshot still advances the room cleanly — gameplay safe, UI cosmetic only. (c) if guest disconnects mid-pick, host\'s pick still applies + run continues solo-from-host\'s-POV until session detects disconnect.',
        'Remaining for v1.21.0: D5f predicted bullet visuals OR D8 two-peer fuzz harness (whichever surfaces first in playtest), C4 enemy 2× HP + per-client tint, host-tab-hidden / suspended policy.',
      ]
    },
  {
      version: '1.20.35',
      label: 'COOP PHASE D9: LOBBY → RUN HANDSHAKE',
      summary: ['The online lobby can now actually start a game. Once both peers reach the Ready view, a new "Start Run" button arms the pending coop run (role/seed/code/session) and launches via the same init+loop path solo uses. Online coop is now reachable from the UI for the first time. Same-room single-room playable end-to-end.'],
      highlights: [
        'New "Start Run" button on the coop ready view (#coop-ready-start). The "Gameplay launch arrives in the next experimental build" placeholder text is gone — the next build is here.',
        'CoopLobby `onReady` payload now includes the gameplay channel `session` so the host\'s session reference can be forwarded to `armPendingCoopRun` and re-used by `installCoopInputUplink` in init() — no second transport instance, no double-listener.',
        'Wire path: `lobby.onReady` → `armPendingCoopRun({ role, seed, code, session })` → user clicks Start Run → `init()` (consumes pending coop record, seeds RNG from coop seed, installs uplink + slots/applier/reconciler appropriate to role) → `gstate=playing` → loop starts.',
        'Both peers must press Start Run independently on their own device — no auto-start. This is intentional for the first ship: gives each player a beat to confirm they\'re ready before the host starts authoritative sim and the guest snaps into prediction.',
        'D5e reconciliation (shipped in v1.20.34) now actually exercises end-to-end through the lobby path. Predicted movement + soft-pull correction visible in real online play.',
        'Single-room termination (C3a-min-1) still applies online: round 1 plays through, run ends on room clear / death / pause-quit. Multi-room boon handshake (D10) is the next blocker for full runs.',
        'Test state: 24 suites green, determinism 11/11 byte-identical. Lobby wiring is UI-only — no tests added (would require DOM harness).',
        'Known limits this ship: (a) one room only — see D10. (b) no predicted bullet visuals on guest fire — guest sees their bullets emerge from authoritative position with ~snapshot-interval delay until D5f. (c) no host-tab-hidden handling — minimizing host tab will desync until either pause-both or end-run policy lands. (d) no leaderboard for coop runs (intentional, gated by isCoopRun).',
      ]
    },
  {
      version: '1.20.34',
      label: 'COOP PHASE D5e: RECONCILIATION (INPUT REPLAY)',
      summary: ['Closes the loop on guest prediction. Each fresh host snapshot, the guest replays its own locally-buffered input frames forward from the host-acknowledged tick, computes a "corrected" position, and either snaps (large desync) or softly pulls the predicted body toward truth (small drift). Result: predicted-feel stays responsive while authoritative state always wins over time. Determinism canary 11/11.'],
      highlights: [
        'New module `src/net/predictionReconciler.js` (~190 lines): tick-keyed ring-buffer for guest input frames, plus a pure replay function that applies the same prediction math (165 * GLOBAL_SPEED_LIFT * tMag) starting from any authoritative state. Default 240-tick (4s @ 60Hz) capacity gives comfortable margin against packet loss at 10Hz snapshot cadence. 31 unit tests covering empty history, single/multi-frame replay, inactive frames, world-bound clamping, ring wraparound, reset, constructor validation.',
        'Guest install path now builds the reconciler alongside the snapshot applier with matching speedPerSecond and current world bounds. Lifecycle: rebuilt per guest run, torn down with the rest of the coop scaffolding when leaving online mode.',
        '`updateOnlineGuestPrediction` records this tick\'s input frame ({tick, dx, dy, t, active}) into the reconciler BEFORE applying movement — so the recorded frame matches what the local sim used and what was sent up to the host on the input channel.',
        'Reconciliation correction runs in the loop\'s applier hook ONCE per fresh snapshot (gated by snapshotSeq tracker, so 60Hz render against 10Hz snapshots doesn\'t multi-correct). Pulls authoritative slot 1 state + lastProcessedInputSeq[1] from the snapshot, calls reconciler.replay(auth, ackTick, simTick, dt, bodyR), and compares the corrected position to the predicted body.',
        'Hard-snap threshold: 96px error → instant teleport (catastrophic desync, prediction is unrecoverable). Soft band: 1.5px–96px → close 35% of error per snapshot, converging in ~3-5 snapshots (~0.3-0.5s). Below 1.5px: ignored as numerical noise. Tunable via constants near the top of script.js.',
        'Skipped during respawn lifecycle: when guest is dead (body.deadAt) or host slot is dead, no replay runs — applier\'s alive-edge anchor handles those discontinuities instead. Skipped also when host hasn\'t yet ack\'d any of our input ticks (lastProcessedInputSeq[1] === null).',
        'Obstacle collision deliberately NOT replayed in this version. Drift near walls is acceptable since each snapshot recorrects, and the obstacle solver depends on global room state the reconciler can\'t see. World-bounds clamping IS replayed.',
        'Test state: 24 suites green (413+ assertions). Determinism canary 11/11 byte-identical — reconciliation is gated to isCoopGuest()-only paths and never touches host/solo/COOP_DEBUG sims.',
        'Next up: D5f (predicted bullet visuals or first multi-peer integration test against the reconciler under simulated jitter/loss).',
      ]
    },
  {
      version: '1.20.33',
      label: 'COOP PHASE D5d: LOCAL PREDICTION (GUEST SLOT 1)',
      summary: ['Guest now feels their own movement instantly. Joystick input drives the local slot 1 body each frame; the snapshot applier skips writing slot 1\'s body x/y/vx/vy continuously, but still re-anchors on death, respawn, runId reset, and first snapshot. Aim, hp, charge, invulnT, and alive flag remain host-authoritative. Determinism canary 11/11.'],
      highlights: [
        'Snapshot applier accepts a new factory option `predictedSlotId`. When set, applySlot skips body x/y/vx/vy writes for that slot id during normal interpolation — the prediction loop owns body movement. Aim angle is still applied from snapshot every frame (with 100ms interpolation lag), so auto-targeting matches host-authoritative bullets without divergence.',
        'Re-anchor on lifecycle discontinuities: even with prediction enabled, the applier writes the body authoritatively when (a) it\'s the first snapshot for that slot, (b) the alive flag toggles (death or respawn), or (c) the runId changes. Death + respawn anchors zero local vx/vy so stale predicted velocity can\'t keep drifting after the lifecycle event.',
        'Discrete fields (hp, charge, maxCharge, maxHp, invulnT, deadAt, alive) are still applied from snapshot every frame regardless of skipBody — the prediction loop reads body.deadAt to halt movement when host says we\'re dead.',
        'New `updateOnlineGuestPrediction(dt)` runs in the isCoopGuest branch of update(). Reads slot1.input.moveVector() (HostInputAdapter on the local joystick), applies movement at 165 * GLOBAL_SPEED_LIFT (matching host-side guest movement), clamps to world bounds, and resolves obstacle collisions via the shared resolveEntityObstacleCollisions helper.',
        'Guest\'s slot 1 install (`installOnlineCoopGuestSlot1`) now mounts `createHostInputAdapter(joy)` on `slot.input` (was null in D5b/c). Same adapter the input-uplink already uses to send frames to the host — predicted state and uplink stay perfectly in sync without sampling the joystick twice.',
        'Bullets still come from snapshots and are authored against host-authoritative slot 1 position. Until reconciliation lands (D5e/f), guest may see their own shots emerge slightly offset from the predicted body when local prediction has drifted from server truth. This is cosmetic — gameplay impact comes from prediction-feel, which is what D5d delivers.',
        '5 new applier test scenarios (8 new assertions): predicted slot body preserved, aim+hp+charge still update, alive→dead re-anchor + zero velocity, dead→alive (respawn) re-anchor, runId reset re-anchor, and predictedSlotId=null leaves all slots interpolating normally.',
        'Test state: 23 suites green (382+ assertions). Determinism canary 11/11 byte-identical (gated to solo/host/COOP_DEBUG paths — guest prediction never runs in those).',
        'Next up (Phase D5e): bullet/aim prediction or input acknowledgement-based reconciliation — closing the loop so predicted state corrects to authoritative state without visible snap-back.',
      ]
    },
  {
      version: '1.20.32',
      label: 'COOP PHASE D5c: INTERPOLATION BUFFER + UPSERT-BY-ID',
      summary: ['Guest now renders smooth motion. The applier holds a 2-snapshot buffer (prev + curr) and lerps entity positions at `renderTimeMs - renderDelayMs` (default 100 ms). Upsert-by-id replaces wipe-and-rebuild — entities only despawn when missing from the latest snapshot. Solo / host / COOP_DEBUG remain byte-identical (applier null). Determinism canary 11/11.'],
      highlights: [
        'snapshotApplier.js rewritten end-to-end. The applier now keeps a 2-snapshot buffer ({snapshot, recvAtMs} for prev and curr). Each frame, the loop calls .apply() with the latest known snapshot + the current rAF timestamp; the applier shifts curr→prev only when the input is a genuinely newer (runId, seq) tuple, then renders interpolated state at `renderTimeMs - renderDelayMs`.',
        'Position interpolation: enemies, bullets, and slot bodies all lerp x/y/vx/vy by id between prev and curr. Default render delay = 100 ms, roughly one snapshot interval at 10 Hz, so guest typically has prev+curr to interp between unless a snapshot is dropped.',
        'Aim arrow uses shortest-arc angle interpolation (lerpAngle wraps over ±π). Without this, an aim crossing the back hemisphere would spin the wrong way for one frame on every snapshot.',
        'Discrete values (hp, charge, maxCharge, invulnT, alive flag, room index/phase, score) are taken from curr — never lerped. Health bars don\'t flicker fractional values; pause/death state changes flip cleanly on the next snapshot.',
        'Upsert-by-id: enemies/bullets are now indexed by id when interpolating. Ids in both prev+curr lerp; ids only in curr (just-spawned) render at curr position; ids only in prev (despawned) drop out of the local arrays. No accidental zombies, no flicker between rebuilds.',
        'Boundary handling: targetT < prev.recvAt → snap to prev (alpha=0). targetT > curr.recvAt → snap to curr (alpha=1, no extrapolation in D5c). Same-seq replays don\'t shift the buffer but still re-render at advancing alpha so the loop animates smoothly between snapshot arrivals.',
        'Run-id epoch: a snapshot from a different runId clears prev so the new run\'s first frame snaps to curr (no stale interp into the new world). Last-applied seq tracker resets on epoch.',
        'D5b-compatible fallback: if renderTimeMs is omitted, applier snaps to curr (alpha=1, interpolated=false). Useful in tests and for any caller that just wants latest authoritative state.',
        'Wiring in script.js: snapshot ingest now stamps performance.now() into latestRemoteSnapshotRecvAtMs alongside the decoded snapshot. Loop hook in loop(ts) passes both renderTimeMs (frameStartTs) and snapshotRecvAtMs to apply().',
        'Test suite rewritten — 51 assertions covering: first-snapshot snap, mid-window interpolation, slot lerp, shortest-arc aim, despawn (id missing in curr), spawn (id missing in prev), extrapolation skip, prev clamp, same-seq replay, older-seq protection, runId reset, fallback path, unknown enemy type, bullet field round-trip, bullet position lerp, maxHp safe default, reset, null-arg guards, discrete-value pass-through.',
        'Test state: 23 suites green (374+ assertions, +1 suite vs D5b). Determinism 11/11 byte-identical.',
        'Next up (Phase D5d): local prediction for guest\'s OWN slot — guest reads its joystick, simulates its own movement locally, and submits inputs to host. Snapshot applier will skip writing slot 1 from snapshots so prediction owns the frame.',
      ]
    },
  {
      version: '1.20.31',
      label: 'COOP PHASE D5b: SNAP-TO-LATEST SNAPSHOT APPLIER',
      summary: ['Guest now actually sees the world. The snapshot applier ingests host broadcasts, validates them via decodeSnapshot, and writes enemy / bullet / slot state into the local arrays so guest renders the host\'s authoritative state. Solo / host / COOP_DEBUG remain byte-identical (applier is null on those code paths). Determinism canary 11/11.'],
      highlights: [
        'New module src/net/snapshotApplier.js — pure factory createSnapshotApplier({ enemyTypeDefs, resolveColors }) returns an object with .apply(snapshot, target). No transport, no DOM, no globals. Wipes-and-rebuilds enemies/bullets per applied snapshot (D5c will replace with upsert + interpolation).',
        'Decode-on-ingress: incoming snapshot payloads now run through decodeSnapshot before being stored. Malformed packets (NaN positions, missing required scalars, wrong kind) are dropped with a console.warn instead of wedging the applier mid-frame.',
        'Sequence memory: each applier instance remembers the last (runId, snapshotSeq) it actually applied. The 60 Hz frame loop hits .apply every frame, but the 10 Hz snapshot feed means 5 of every 6 calls would be duplicates — the applier no-ops on same-or-older seq so the entity arrays only thrash when there is genuinely new data. Run-id mismatch resets the tracker (host restarted).',
        'Slot match by id, not array index: snapshot.slots[i].id (0=host, 1=guest in wire format) is the source of truth. Sparse slot arrays from the host (e.g. host omits a downed slot) no longer scramble assignment.',
        'Wire schema extended: maxHp added to encodeEnemy. Without it, every wipe-rebuild would have collapsed maxHp to current hp, causing the enemy HP bar to flicker only on damage frames. coopSnapshot test count: 24/24.',
        'Guest slot 1 install: new installOnlineCoopGuestSlot1() seats a placeholder body for the local guest player so D5a\'s getLocalRenderSlot() has a real target. Body is a placeholder for now; positions snap to host\'s view of slot 1 each frame. D5d replaces snapshot-driven position with locally-predicted state.',
        'Color resolver: applier accepts a resolveColors(type, def) callback. script.js wires it through getEnemyDefinition() which already runs resolveEnemyColor against the local palette — host and guest can therefore have different cosmetic palettes without breaking either.',
        'runElapsedMs intentionally NOT overwritten on guest from snapshots (rubber-duck D5b finding). Guest advances its own run timer locally; overwriting at ~10 Hz would cause stutter / jump-back between snapshots. roomIndex / roomPhase / score ARE mirrored from snapshot — they are game-wide singletons, not per-frame timers.',
        'Loop integration: applier hook runs once per frame AFTER fixed-step sim ticks (no-op on guest because guest update() early-returns) and BEFORE draw(simNowMs). Solo/host: applier is null, hook skipped.',
        'Known limitation: isBoss is not on the wire. Guest derives visuals from ENEMY_TYPES[type] only, so boss HP-bar and \"★ BOSS\" label may render incorrectly on guest until a follow-up adds the flag. Acceptable D5b scope.',
        'New test suite scripts/test-snapshot-applier.mjs (50 tests): basic apply, wipe-and-rebuild, empty snapshot, slot-match-by-id, seq-skip, runId reset, unknown enemy type fallback, maxHp safe defaulting, bullet field round-trip, missing slot resilience, reset() behavior, null-arg guards.',
        'Rubber-duck critique adopted: (a) full hydrate of static-per-type enemy flags from ENEMY_TYPES, (b) lastAppliedSeq tracker to avoid 60 Hz re-application, (c) runElapsedMs stays local, (d) match slots by id, (e) decode/validate at ingress, (f) maxHp on wire.',
        'Test state: 22 suites green (323+ assertions). Determinism 11/11 byte-identical.',
        'Next up (Phase D5c): interpolation buffer — render guest entities ~50–75 ms behind latest snapshot for smooth motion; upsert-by-id instead of wipe-and-rebuild.',
      ]
    },
  {
      version: '1.20.30',
      label: 'COOP PHASE D5a: RENDER/HUD TO LOCAL SLOT',
      summary: ['Ghost sprite and HUD now read from the local render slot (whichever slot represents this browser) instead of hardcoded slot 0. Solo / host / COOP_DEBUG → byte-identical (local slot is slot 0, whose metrics/upg bridge to the legacy globals). Online guest will now correctly bind its own ghost + charge bar + sps to slot 1 once D5b installs the guest body.'],
      highlights: [
        'New getLocalRenderSlot() helper in script.js wraps getLocalSlot(playerSlots) and falls back to playerSlots[0] when the local slot has not been installed yet — guests wake up with no slot 1 until D5b\'s snapshot applier seats one, and we never want the renderer to NPE in that gap.',
        'drawGhost(ts) now reads body / charge / maxCharge / fireT / hp / maxHp / sps from the local slot\'s body+metrics+upg instead of the slot-0 globals (player / charge / UPG.maxCharge / fireT / hp / maxHp / UPG.sps). For solo and host these are the same objects via the slot 0 getter bridges, so the canary stays byte-identical.',
        'drawGuestSlots(ts) now skips whichever slot is local rather than hardcoding `i = 1`. On the host this still draws slot 1 (the guest); on the guest, after D5b, this will draw slot 0 (the host) — both peers see their partner via the same code path.',
        'hudUpdate() now reads charge / maxCharge / sps from the local slot\'s metrics+upg. roomIndex / runElapsedMs / score remain global (they are game-wide values shared between both peers, not per-slot).',
        'Out of scope (intentionally deferred): payload ring, aim arrow, shields, orbit spheres, void walker. These still read player.* / UPG.* globals. They will be retargeted in a follow-up once D5b populates slot positions on the guest — until then, slot 0 has no useful x/y on a guest peer, so retargeting now would render onto stale data anyway.',
        'Test state: 22 suites green (273+ assertions). Determinism 11/11 byte-identical — local slot collapses to slot 0 in the canary harness so render reads are unchanged.',
        'Next up (Phase D5b): snap-to-latest snapshot applier so the guest actually sees enemies / bullets / partner positions instead of an empty world.',
      ]
    },
  {
      version: '1.20.29',
      label: 'COOP PHASE D4.6: SNAPSHOT CONTRACT FIX',
      summary: ['Pre-D5 audit caught four bugs in the wire format that would have made guest rendering impossible: enemy IDs were unstable, enemy fire fields were unpopulated, bullets lacked render-critical fields, and slot data was incomplete. All fixed before guests start consuming snapshots in D5. Determinism canary byte-identical.'],
      highlights: [
        'Enemy stable IDs: collectHostSnapshotState now reads e.eid (the runtime field set by createEnemy) instead of e.id (which is undefined → was falling back to array index → guest upsert would have thrashed every frame as enemies sorted differently).',
        'Enemy fire fields renamed to match runtime: schema now carries fT (cooldown counter, ms) and fRate (period, ms) instead of nonexistent fireT/windup. Guests will be able to render live fire-tells (charging-up animation before an enemy shoots).',
        'Bullets now carry r (radius) and state (output|grey|danger). bulletRenderer.js dispatches on b.state directly, so without these fields every guest-rendered projectile would have crashed or fallen through to default visuals. r is needed for hit-region drawing and bounce-ring math.',
        'Slot data now fully populated. encodeSlot already declared charge/maxCharge/aimAngle/invulnT/shieldT/stillTimer/alive but collectHostSnapshotState was only writing 6 of the 13 fields → guests would have decoded zeros for shields, aim arrow, charge bar, etc. Now reads s.metrics for hp/maxHp/charge/stillTimer, slot.upg.maxCharge, slot.aim.angle, body.invincible (invulnT), body.shields[0].t (shieldT), body.deadAt (alive).',
        'Bullet ownerSlot still clamped to 0 for danger bullets (no slot owner) — type/state fields carry the player/danger discriminator. spawnTick still 0 until D4b proper bullet spawn-tick stamping (which D5 does not need).',
        'New coopSnapshot tests (24 total, +3): default values for new fields (bullet r=6, state=output; enemy r=12, fT=0, fRate=0), regression guard ensuring legacy fireT/windup keys are NOT present in encoded output (we want hard breaks if anything still reads the old names).',
        'No changes to broadcaster, applier, runtime sim, or HUD. Pure schema/collection fix.',
        'Rubber-duck of D5 plan flagged this as a blocker — ALL of D5\'s rendering would have been built on phantom data. Better to catch it now than after D5b lands and guests render the wrong world.',
        'All 22 test suites green (273+ assertions). Determinism 11/11 byte-identical — change is host-broadcast-only, sim path untouched.',
        'Next up (Phase D5a): route render/HUD to local slot (currently hardcoded to slot 0) so the guest sees their own slot 1 as the "main" player rather than the host.',
      ]
    },
  {
      version: '1.20.28',
      label: 'COOP PHASE D4.5: HOST DRIVES ONLINE SLOT 1',
      summary: ['Host now actually consumes guest input frames to drive slot 1 in the authoritative sim. lastProcessedInputSeq[1] is no longer a placeholder — it reflects the highest sim-tick where the host applied a real remote-input frame, ready for D6 reconciliation. Determinism canary byte-identical (online host code path is gated; offline runs untouched).'],
      highlights: [
        'New src/net/hostRemoteInputProcessor.js: tracks the highest sim-tick for which the host has CONSUMED a remote-input frame (not "received" — that distinction was rubber-duck finding #3 on the D4 plan). Per-tick, peeks the ring; if a frame exists, advances lastProcessedTick and trims the buffer to retainTicks (default 60 = ~1s history for D6 replay).',
        'Online host slot 1 now spawned in installCoopInputUplink (host branch) via createRemoteInputAdapter(remoteRing, { getCurrentTick: () => simTick }). Body, metrics, timers, aim mirror the COOP_DEBUG installGuestDebugSlot setup so the existing slot-1 movement / contact-damage / respawn paths work unchanged.',
        'collectHostSnapshotState (the broadcaster getState callback) now reads lastProcessedInputSeq[1] from hostRemoteInputProcessor.getLastProcessedTick(). Stays null until the first frame is applied, then advances every tick a guest frame is consumed.',
        'Loop wiring: hostRemoteInputProcessor.tick(simTick) runs INSIDE the fixed-step accumulator, immediately AFTER update() and BEFORE coopSnapshotBroadcaster.tick(). Order matters — the snapshot must reflect the just-consumed tick rather than lagging by a cadence period.',
        'teardownCoopInputUplink also tears down the slot 1 entry (delete playerSlots[1]) and resets the processor handle so a fresh init() / restoreRun() starts clean. Slot 0 lifecycle is left to installPlayerSlot0 — we only own what we installed.',
        'Idempotent install: if playerSlots[1] is already registered (COOP_DEBUG path or a re-entry) we skip — real online runs never coexist with COOP_DEBUG, but the guard is conservative belt-and-braces.',
        'New scripts/test-host-remote-input-processor.mjs (12 tests): construction guards, lastProcessedTick null start, missing-frame leaves value unchanged, frame-present advances, monotonic-ish behavior across gaps, non-finite/negative simTick rejection, retainTicks=N trim arithmetic, retainTicks=0 evicts the just-processed frame, cutoff<0 skipped at run start, reset, integration over 121 ticks.',
        'All 22 test suites green (270+ assertions). Determinism 11/11 byte-identical — slot-1 install is gated behind isCoopHost (online); solo and COOP_DEBUG paths are untouched.',
        'D6 reconciliation can now use lastProcessedInputSeq[1] to safely trim guest replay buffers without dropping un-applied input.',
        'Next up (Phase D5): guest renders from snapshots — interpolation between two consecutive snapshots, plus client-side prediction for slot-1 movement so guest input feels responsive.',
      ]
    },
  {
      version: '1.20.27',
      label: 'COOP PHASE D4: HOST SNAPSHOT BROADCAST',
      summary: ['Host now emits a full state snapshot every 6 sim ticks (~10 Hz). Each snapshot is tagged with a runId/epoch so stale packets from a disposed run can never contaminate the next one. Guests receive and store the latest snapshot but do not yet render from it — D5 wires prediction + interpolation. Determinism canary byte-identical.'],
      highlights: [
        'New src/net/coopSnapshotBroadcaster.js: tick-cadence broadcaster. Cadence is sim-tick-based (NOT wall time) so behavior is independent of frame jitter, tab-throttle and rAF resume bursts — a 500-tick gap emits exactly ONE snapshot, not 84 catch-up sends.',
        'Async-safe sendGameplay: Promise.resolve(result).then(() => sent++).catch(failed++) pattern matches the D3-fix shape so unhandled rejections cannot leak. Sync throws and async rejections are both counted in stats.failed.',
        'Late-resolve safety: if dispose() fires before an in-flight async send resolves, the late .then() does NOT increment stats.sent. Important for runId/epoch transitions where a brand-new broadcaster is taking over.',
        'New src/net/coopSnapshot.js schema additions: required `runId` (string 1-128 chars) on every encoded snapshot; lastProcessedInputSeq[0|1] now u32-or-null (was forced 0). null = "host has not consumed any input for this slot yet" — D6 reconciliation must NOT trim replay buffer when null. 0 is reserved as a valid tick.',
        'script.js wiring: currentRunId generated via crypto.randomUUID() (with fallback) on init() and restoreRun() right after resetBulletIds(). installCoopInputUplink builds the broadcaster on host role; teardownCoopInputUplink disposes it. Loop calls coopSnapshotBroadcaster?.tick(simTick) inside the fixed-step accumulator so cadence is deterministic.',
        'Guest snapshot receipt: onGameplay handler now also processes kind=\'snapshot\' envelopes. Epoch gate: if incoming runId differs from latestRemoteSnapshot.runId we hard-reset seq tracking (otherwise a late packet from the old run could fight a fresh sequence). isNewerSnapshot() then gates against duplicates / out-of-order delivery.',
        'collectHostSnapshotState() builds a defensive loose object: ?? defaults on every field, ownerSlot clamped to non-negative (danger bullets carry the danger/player discriminator in the `type` field). encodeSnapshot is strict — any throw is caught by the broadcaster and counted as a failed send rather than crashing the loop.',
        'Rate budget: 10 Hz host (snapshots) + ~7.5 Hz guest (8-frame input batch) = ~17.5 msg/s. Comfortable headroom under Supabase 20 msg/s cap for retries / pings / boon-pick handshakes.',
        'New scripts/test-coop-snapshot-broadcaster.mjs: 14 tests covering construction guards, cadence (first-tick + every-N), gap-no-burst, ticksPerSnapshot floor, non-finite simTick rejection, output envelope shape, sequencer integration, sync send error isolation, async rejection not-unhandled, getState throw isolation, encode failure isolation, dispose stops sends, late-resolve-after-dispose does not count, stats fields populated.',
        'Updated scripts/test-coop-snapshot.mjs: every encodeSnapshot call now includes runId; new tests for runId required, runId type/length validation, lastProcessedInputSeq null support per slot. 21/21 passing.',
        'All 21 test suites green (260+ assertions). Determinism 11/11 byte-identical — no host-only code path touches the deterministic sim.',
        'D7 host-side lag-comp remains BLOCKED/DEFERRED: Valve-style rewind only works for hitscan, but our projectiles bounce/home/split. Host-authoritative projectile timing for v1; revisit if playtest shows guest shots feel unfair.',
        'Next up (Phase D4.5): host drives online slot 1 by draining remoteInputBuffer + sets a true lastProcessedInputSeq[1]. Then D5 (guest prediction + interpolation, snapshots actually drive rendering).',
      ]
    },
  {
      version: '1.20.26',
      label: 'COOP PHASE D3-FIX: TRANSPORT CONTRACT + ASYNC SEND',
      summary: ['Pre-D4 hotfix. Rubber-duck found that D3 was silently broken on the real Supabase transport: the onGameplay handler treated its arg as the raw payload, but coopSession actually delivers {payload,from,ts} envelopes — every guest input frame was being dropped. Also tightened async sendGameplay error handling.'],
      highlights: [
        'script.js: onGameplay handler in installCoopInputUplink now unwraps `ev.payload` before kind-checking. Previously `payload.kind` was always undefined → every input dropped → host never saw guest movement.',
        'src/net/coopInputSync.js: sendGameplay error handling now covers both sync throws AND async rejections via Promise.resolve(result).then(() => sentCount++).catch(logger). Previously async rejections produced unhandled-promise warnings and a wrongly-incremented sent counter.',
        'Default batchSize bumped 4 → 8 frames (~7.5 msg/s instead of ~15 msg/s). Combined with the upcoming 10 Hz host snapshot broadcaster (D4) keeps the channel at ~17.5 msg/s with safe headroom under the Supabase 20 msg/s cap for retries/pings/boon picks.',
        'scripts/test-coop-input-uplink.mjs: mock session now matches real coopSession contract (envelope wrapping in simulateIncoming, async sendGameplay). Added unwrapToInputIngest helper that mirrors the script.js fix. New tests: defensive null/undefined envelope handling, async-rejection-not-unhandled, async-resolve-increments-sent.',
        'scripts/test-coop-input-sync.mjs: stats.sent assertion converted to async-aware (await microtasks before checking) since increments now fire on Promise resolution.',
        'Both test suites now expose async-test capability via Promise tracking in their harnesses.',
        'All 20 test suites green. Determinism 11/11 byte-identical (no sim path touched).',
        'Next up (Phase D4): tick-cadence snapshot broadcaster — every 6 sim ticks → 10 Hz, with runId/epoch in the envelope so stale post-dispose sends are harmless across runs.',
      ]
    },
  {
      version: '1.20.25',
      label: 'COOP PHASE D4B: BULLET IDS',
      summary: ['Every bullet now gets a stable unique id at spawn time. Sets up snapshot correlation in D4 and prediction reconciliation in D6. Determinism canary byte-identical.'],
      highlights: [
        'New src/entities/bulletIds.js: nextHostBulletId() (positive uint32, 1-based), nextGuestBulletId() (negative int32), resetBulletIds() called on run init + restore. Sign bit distinguishes authoritative (positive) from guest-predicted (negative) bullets.',
        'Wired id allocation into all 4 spawn helper sites: projectiles.js (spawnEnemyBullet, spawnEliteBullet) and playerProjectiles.js (createOutputBullet/pushOutputBullet, pushGreyBullet). Every bullet push gets `id: nextHostBulletId()` as the first property.',
        'resetBulletIds() called from init() (line ~2401) and restoreRun() (after bullets.length=0) so both fresh runs and continues start IDs at 1 — critical for determinism canary byte-identity.',
        'scripts/test-bullet-ids.mjs: 12 assertions covering monotonic allocation, host/guest counter independence, reset behavior, ID classification helpers, all 4 spawn-site wiring, mixed-enemy+player uniqueness, spawn-order preservation, and post-reset byte-identical reproducibility.',
        'Wraparound guard: if hostCounter overflows back to 0, skip to 1 (uint32 reserves 0 as "unassigned"). Belt-and-braces — at 10 bullets/s this would take ~13 years to hit.',
        '20 test suites green. Determinism 11/11 byte-identical (IDs mirror spawn order; fresh run always produces same id sequence).',
        'Next up (Phase D4): host broadcasts snapshots at 10-15 Hz using the D4a schema + D4b IDs. Guests receive them and begin applying (render-only in D4; prediction + reconciliation land in D5/D6).',
      ]
    },
  {
      version: '1.20.24',
      label: 'COOP PHASE D4A: SNAPSHOT SCHEMA',
      summary: ['Defined the wire format host will use to broadcast authoritative state. Pure data module with encode/decode/validation — no script.js wiring yet; that lands in D4.'],
      highlights: [
        'New src/net/coopSnapshot.js: createSnapshotSequencer (monotonic uint32 with wraparound), encodeSnapshot / decodeSnapshot (strict field validation), isNewerSnapshot (32-bit-safe ordering with half-range ambiguity rule).',
        'Wire shape: {kind:\'snapshot\', snapshotSeq, snapshotSimTick, lastProcessedInputSeq:{0,1}, slots[pos/vel/hp/charge/aim/invuln/shield/alive], bullets[id/pos/vel/type/owner/bounces/spawnTick], enemies[id/pos/hp/type/fireT/windup], room{index/phase/clearTimer/spawnQueueLen}, score, elapsedMs}. FULL snapshots only for first cut — delta compression deferred past D9.',
        'lastProcessedInputSeq is the reconciliation anchor (rubber-duck #3): tells the guest which input tick the host had consumed when the snapshot was sampled, so D6 can replay only inputs AFTER that tick.',
        'Strict validation: throws on NaN/Infinity positions, negative u32 fields, missing required fields, wrong kind. Lenient on missing optional scalars (defaults to 0/false). All throws include descriptive field paths like "slots[0].x" or "bullets[1].ownerSlot".',
        'scripts/test-coop-snapshot.mjs: 18 assertions covering sequencer, wraparound (0x00 follows 0xFFFFFFFF), half-range boundary, JSON round-trip, default-fill, fractional floor, all validation error paths, and sequencer-driven newest-wins ordering.',
        '19 test suites green. Determinism 11/11 byte-identical (pure module not imported by script.js yet).',
        'Next up (Phase D4b): monotonic bullet IDs. Every bullet gets a stable id (per-owner spawn seq) so snapshots can correlate predicted vs authoritative bullets during reconciliation.',
      ]
    },
  {
      version: '1.20.23',
      label: 'COOP PHASE D3: GUEST INPUT UPLINK',
      summary: ['Guest browsers now stream their local input frames to the host over the coop gameplay channel. Host ingests into a ring buffer, ready for slot-1 sim to drain in D4. Solo and ?coopdebug=1 untouched.'],
      highlights: [
        'Wired createCoopInputSync into script.js. On init(), after slot 0 installs, installCoopInputUplink(armedCoop) spins up an instance bound to the active session. Teardown in gameOver / endCoopDemoRun disposes the sync and unsubscribes from onGameplay.',
        'Guest path in update() now calls coopInputSync.sampleFrame(simTick) after the guest-gate clock advance. Frames are quantized (int8 dx/dy, uint8 t, still bit) and batched in groups of 4 → ~15 msg/s at 60 Hz, well under Supabase\'s 20 msg/s hard cap.',
        'New module-level simTick counter increments once per fixed-step update() call. Acts as the authoritative clientTick tag on guest input frames and (later in D4) the host\'s snapshot sim-tick.',
        'Host side: session.onGameplay listener forwards {kind:\'input\'} payloads into inputSync.ingest(), which lands them in a sorted ring buffer. Out-of-order frames sort, duplicate ticks drop first-write-wins, non-input kinds ignored.',
        'scripts/test-coop-input-uplink.mjs: 12 new assertions covering batch flush, explicit flush, quantization, host ingest, out-of-order sort, duplicate drop, teardown cleanup, sendGameplay throw isolation, and end-to-end loopback.',
        '18 test suites green. Determinism 11/11 byte-identical (the uplink only installs when role === host/guest; solo and COOP_DEBUG never touch it).',
        'Next up (Phase D4a): snapshot schema + sequencing. Host starts broadcasting authoritative state (slots, bullets, enemies, room phase) so guests can render again and D5 prediction has a baseline to reconcile against.',
      ]
    },
  {
      version: '1.20.22',
      label: 'COOP PHASE D2: HOST-AUTHORITATIVE SIM',
      summary: ['Guest browsers now skip the local simulation entirely; the host peer is the authority for enemies/bullets/scoring/room progression. Solo and ?coopdebug=1 keep the full sim, byte-identical.'],
      highlights: [
        'New src/net/coopRunConfig.js helpers: isCoopHost() / isCoopGuest() — strict role === \'host\' / \'guest\' checks. Never negate (!isCoopGuest()) — solo and COOP_DEBUG (role:\'local\') must always fall through the host-like path.',
        'update(dt,ts) in script.js: right after the dying early-return, added a guest gate. role===\'guest\' → advance runElapsedMs + simNowMs, clear prevStill, return. No enemy/bullet/scoring work runs on guest browsers.',
        'Guest draw() continues to run so the UI stays responsive; until D4 snapshots land, guests see an effectively frozen arena (expected intermediate state).',
        'scripts/test-coop-run-config.mjs +12 assertions: isCoopHost/Guest state matrix across solo/host/guest/local; explicit "critical invariant: solo/local/host NEVER get guest gate" checks.',
        'Determinism 11/11 byte-identical (guest gate is gated by role which is null in solo). 17 test suites green. Browser smoke (solo + ?coopdebug=1) clean.',
        'Rubber-duck-flagged anti-pattern enforced in code comments: exact role checks only — no negation.',
        'Next up (Phase D3): guest → host input uplink on the gameplay channel so the host can drive slot 1 inside its authoritative sim.',
      ]
    },
  {
      version: '1.20.21',
      label: 'COOP PHASE D0B: PER-SLOT FIRE',
      summary: ['firePlayer now reads/writes through the passed-in slot instead of module globals. Host and guest share the same full-featured fire path (boons, shockwave, echo, overload, volleys). Solo byte-identical via slot 0 getter/setter bridges.'],
      highlights: [
        'firePlayer(slot, tx, ty) fully slot-driven: every `charge`/`player`/`UPG`/`_echoCounter`/`playerAimAngle` access replaced with slot.metrics/body/upg/timers/aim. Slot 0 is still wired to the legacy globals through Object.freeze getter/setter bridges installed in C2a, so solo play is byte-identical (determinism 11/11).',
        'Removed the simplified `fireGuestSlot` shim (Phase C2d-2). updateGuestFire now calls firePlayer directly, so guest slots get the full boon stack once their UPG state is networked in (D4+).',
        'echoCounter migrated from module-level `_echoCounter` to per-slot `slot.timers.echoCounter`. Slot 0 bridge keeps the legacy var in sync; guest slots now get independent echo state.',
        'Unblocks Phase D5 (guest prediction) and D6 (reconciliation): replaying inputs for slot N will no longer corrupt slot 0\'s charge/aim/echo.',
        'Rewrote scripts/test-guest-fire.mjs to drop the deleted fireGuestSlot port-tests and keep the updateGuestFire charge-gate tests (still distinct from host mobile-charge path).',
        '17 test suites green. Determinism byte-identical. Browser smoke (solo + ?coopdebug=1) clean, no console errors. Experimental repo only; live repo unchanged.',
        'Next up (Phase D2): host-authoritative sim flag → guest skips sim, applies snapshots instead.',
      ]
    },
  {
      version: '1.20.20',
      label: 'COOP PHASE D0A: WORLD-SPACE DECOUPLED',
      summary: ['Simulation now runs in a dedicated WORLD coordinate space, independent from each device\'s canvas pixels. Foundation for host+guest sharing an identical arena regardless of screen size. Solo and ?coopdebug=1 paths byte-identical.'],
      highlights: [
        'New src/core/worldSpace.js pure module: createWorldSpace() owns width/height + getRenderScale(canvasW, canvasH). 15 unit tests (scripts/test-world-space.mjs).',
        'script.js: WORLD_W/WORLD_H module vars now drive the sim. 14 sim call sites migrated from cv.width/cv.height → WORLD_W/WORLD_H (player init, body.x clamp, createRoomObstacles, spawnEnemy ctx, update W/H, createInitialPlayerState x2, room intro centers, telemetry bridge).',
        'Renderer: draw() now wraps the scene in ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0) using worldSpace.getRenderScale(). Identity (1,1) in solo since WORLD is mirrored from canvas. Transform reset to identity before joystick UI draw (joystick stays in canvas-pixel space).',
        'resize() calls syncWorldFromCanvas() — keeps WORLD === canvas in solo/?coopdebug=1 so today\'s behavior is untouched. In Phase D2+ online coop, host will pin WORLD to a fixed size (likely 400×472) and guests render scaled regardless of their device size.',
        'Rubber-duck critique blocker #1 resolved: before this change, host and guest on different-sized devices would have run different-sized arenas. Now the sim is authoritative over world dims.',
        'Determinism 11/11 byte-identical. 17 test suites green (was 16 + new world-space suite). Experimental repo only; live repo unchanged.',
        'Next up (Phase D0b): extract pure per-slot player step function (firePlayer currently reads globals — blocker for prediction/reconciliation).',
      ]
    },
  {
      version: '1.20.19',
      label: 'COOP ARCHITECTURE PIVOT: LOCKSTEP → AUTHORITATIVE-HOST',
      summary: ['Lockstep scheduler removed. Pivoting online co-op to authoritative-host + client prediction + reconciliation (Valve model) for latency-tolerant twitch play. Solo and ?coopdebug=1 paths unchanged.'],
      highlights: [
        'Rationale: lockstep gates every shot on round-trip latency — unacceptable for bullet-heaven pacing. Authoritative-host (one peer = server, other = client predicting locally) gives zero-latency feel on own input while keeping sim deterministic.',
        'DELETED src/net/coopLockstep.js and scripts/test-coop-lockstep.mjs. The two-counter gate and 42 lockstep tests are gone. Test count drops from 321 → 279 across 15 suites.',
        'KEPT (still useful under host-authority model): coopRunConfig (seed + roles + isOnlineCoopRun), onlineSlotRuntime, coopSession gameplay channel (sendGameplay/onGameplay), coopInputSync (input quantization + batching), remoteInputBuffer (host\'s guest-input queue), C3a-min-1 single-room termination gate.',
        'script.js unchanged — lockstep was never wired into the main loop (would have shipped in c3a-ship-1, now scrapped).',
        'inputSync.sampleFrame retains its return value for the upcoming guest-side prediction path (guest echoes its own quantized frame into a prediction buffer for reconciliation).',
        'Next up (Phase D): host-authoritative sim flag → guest input uplink → 20 Hz host snapshot broadcast → guest prediction + interpolation → reconciliation → host-side lag comp for guest hit-reg → two-peer integration test → first playable online run.',
        'Determinism byte-identical (11/11). Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.18',
      label: 'COOP PHASE C3A-MIN-1: SINGLE-ROOM TERMINATION',
      summary: ['Online coop runs now terminate cleanly after Room 1 clears, skipping the boon picker. Foundation for one deterministic online single-room run. Solo and ?coopdebug=1 paths unchanged.'],
      highlights: [
        'New isOnlineCoopRun() in src/net/coopRunConfig.js: true only when role===\'host\'||\'guest\'. solo (no run) and COOP_DEBUG (role:\'local\') return false — both behave identically to today.',
        'script.js: shouldShowUpgrades gate now routes online coop peers to endCoopDemoRun() instead of showUpgrades(). Solo and COOP_DEBUG still call showUpgrades() unchanged.',
        'endCoopDemoRun(): freezes sim (gstate=\'gameover\', cancelAnimationFrame), reuses the gameOver overlay with note "COOP DEMO COMPLETE · Room 1 cleared · Boon selection coming in C3b", calls clearCoopRun(). Does NOT push leaderboard entry.',
        'COOP_DEBUG parity: ?coopdebug=1 has role:\'local\' → isOnlineCoopRun()=false → still shows boon picker as before.',
        'Determinism: endCoopDemoRun is a no-op in the pure-sim harness (no coop run armed) — byte-identical 11/11.',
        'New scripts/test-coop-single-room.mjs: 26 contract tests (isOnlineCoopRun helper, all-four-states matrix, shouldEndAfterRoomClear pure logic). 321 tests across 16 suites.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.17',
      label: 'COOP PHASE C3A-CORE-3: LOCKSTEP GATE',
      summary: ['Internal scaffolding: two-counter lockstep gate (sendTick / executeTick) prevents sim divergence when network latency is non-zero. ?coopdebug=1 only.'],
      highlights: [
        'New src/net/coopLockstep.js: sampleLocalThrough/canExecuteTick/consumeTick. Sim only advances when BOTH slots\' quantized frames for that tick are buffered locally.',
        'Owns a local ring buffer mirrored from inputSync.sampleFrame — both peers read their own input through the same quantize→dequantize pipe so sim floats stay byte-identical across machines.',
        'stallReason diagnostics (localMissing / remoteMissing / nonMonotonic / null) give the future lockstep driver a clean signal for "pause sim" vs "catch up".',
        'Solo/COOP_DEBUG path: expectRemote=false gate depends only on local availability → no regression to existing single-device play.',
        'Invariants enforced by tests: executeTick ≤ sendTick always, consumeTick monotonically +1, non-monotonic consume throws, sampleLocalThrough idempotent past sendTick.',
        'Minor: inputSync.sampleFrame now returns the quantized frame (back-compat — previous callers ignore the return value).',
        'New scripts/test-coop-lockstep.mjs: 42 contract tests. 295 tests across 16 suites. Determinism byte-identical.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.16',
      label: 'COOP PHASE C3A-CORE-2: INPUT SYNC',
      summary: ['Internal scaffolding: new coopInputSync batches local input at 15 msg/s (4 frames/batch, 60 Hz sim) and fans out remote frames via a ring buffer. Foundation for lockstep tick gate (C3a-core-3). ?coopdebug=1 only.'],
      highlights: [
        'New src/net/remoteInputBuffer.js: sorted ring buffer (capacity 120) for remote quantized frames. push/peekAt/consumeUpTo/hasFrameFor/stats — reverse-linear scan, O(1) amortised for in-order arrivals. Duplicate ticks: first wins. Capacity overflow: oldest dropped.',
        'New src/net/coopInputSync.js: createCoopInputSync({sendGameplay, localAdapter, localSlotIndex, batchSize=4}). sampleFrame(tick) quantizes dx/dy to int8, t to uint8; flushes via sendGameplay when batch full. flush() for manual/shutdown drain. ingest(payload) validates+fans out to onRemoteFrame listeners and populates ring buffer. getStats()/getRemoteRingBuffer()/dispose().',
        'Quantization: dx/dy=Math.round(v*127) int8; t=Math.round(v*255) uint8. Round-trip error ≤1/127≈0.79% per axis. Supabase 20 events/s cap: batchSize=4 yields ~15 msg/s.',
        'Extended src/core/inputAdapters.js: new createRemoteInputAdapter(ringBuffer, {getCurrentTick}). Dequantizes frames; stall default (dx=0,dy=0,active=false) when no frame present for tick.',
        'New scripts/test-coop-input-sync.mjs: 24 tests (7 ring buffer, 8 batching, 5 ingest/dispatch, 4 remote adapter). No wiring into script.js — C3a-core-3 (lockstep) owns that.',
        '253 tests across 15 suites. Determinism byte-identical (11/11). Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.15',
      label: 'COOP PHASE C3A-CORE-1: LOCAL SLOT RUNTIME',
      summary: ['Internal scaffolding: new onlineSlotRuntime resolves "which slot is the person at this browser?" Foundation for input sync + HUD routing. ?coopdebug=1 only.'],
      highlights: [
        'New src/net/onlineSlotRuntime.js: resolveLocalSlotIndex/getLocalSlotIndex/getLocalSlot/isLocalSlot — derives local slot from coopRunConfig role (host/local→0, guest→1).',
        'Pure utility module with explicit-override support; no globals read outside of getActiveCoopRun(). Enables Node integration tests for online slot logic without touching the DOM.',
        'Wired the auto-fire call site in script.js to route through getLocalSlot(). Solo/host/COOP_DEBUG paths resolve to slot 0 → byte-identical. Only a real online guest (role=guest) flips to slot 1, and that path is not yet playable.',
        'New scripts/test-online-slot-runtime.mjs: 28 contract tests (role mapping, override, sparse arrays, solo invariant, isLocalSlot identity).',
        '229 tests across 14 suites. Determinism byte-identical (11/11). Playwright smoke clean for solo and ?coopdebug=1.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.14',
      label: 'COOP PHASE C3A-PRE-2: GAMEPLAY CHANNEL',
      summary: ['Internal scaffolding: coopSession gains sendGameplay/onGameplay multiplexed with handshake. Foundation for C3a input sync. ?coopdebug=1 only.'],
      highlights: [
        'Envelope wrapper: every outbound message is now {kind:\'handshake\'|\'gameplay\', payload, from, protocol, ts}. Handshake payload fields unchanged.',
        'Backward-compat: legacy unwrapped messages (no kind field, type at top level) are still accepted and treated as handshake with a one-time logger warning.',
        'New sendGameplay(payload): async; throws if not ready phase or if payload is null/undefined/non-object.',
        'New onGameplay(fn): returns unsubscribe; fires {payload, from, ts} for each inbound gameplay message. Listener isolation: gameplay traffic never reaches handshake handlers and vice versa.',
        'Pre-ready gameplay messages are silently dropped (debug log only) — no buffering, no error.',
        'Internal refactor: sendHandshake(payload) helper wraps all handshake send sites; handleMessageAsHost/Guest unchanged in shape.',
        'New scripts/test-coop-gameplay-channel.mjs: 12 contract tests. 201 tests across 13 suites. Determinism byte-identical.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      label: 'COOP PHASE C3A-PRE-1: ISCOOPRUN FLAG',
      summary: ['Internal scaffolding: real coop-run lifecycle flag + seed bootstrap. Foundation for online lockstep. ?coopdebug=1 only.'],
      highlights: [
        'New src/net/coopRunConfig.js: armPendingCoopRun/consumePendingCoopRun/isCoopRun/clearCoopRun — one-shot armed config consumed exactly once at init().',
        'init() seed precedence rewritten: armed-coop seed > URL ?seed= > time. COOP_DEBUG auto-arms a local-role config (URL ?seed= still wins for local replays).',
        'C2f gates re-keyed from raw COOP_DEBUG check to isCoopRun() — future online runs will gate identically without flag-sprawl.',
        'gameOver() now calls clearCoopRun() after pushLeaderboardEntry so a fresh solo run after a coop session is fully clean.',
        'Continue Run button guard widened: hidden under any of ?coopdebug=1 / ?coop=1 / ?room=<code>.',
        'New scripts/test-coop-run-config.mjs: 22 contract tests (arm/peek/consume/clear, one-shot, seed coercion, validation). 189 tests across 12 suites.',
        'Determinism byte-identical. Playwright smoke clean; new "[seed] coop run seed <n> role local" console log confirms the wire.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.12',
      label: 'COOP PHASE C2F: COOP GATING',
      summary: ['Internal scaffolding: save/continue/leaderboard are now solo-only. Coop (?coopdebug=1) runs don\'t persist and don\'t submit scores. ?coopdebug=1 only.'],
      highlights: [
        'saveRunState() early-returns under COOP_DEBUG — no stale saves left behind after a coop session. Solo saves unchanged.',
        'pushLeaderboardEntry() early-returns under COOP_DEBUG (still clears legacy recovery). Coop scores don\'t belong on the solo board — one player per device, different scoring model.',
        '"Continue Run" button is hidden under COOP_DEBUG (you can\'t resume a coop session solo).',
        'New scripts/test-coop-gating.mjs: 10 contract tests (save/leaderboard/continue gates, determinism).',
        '167 tests total across 11 suites. Determinism byte-identical. Playwright smoke clean for solo and ?coopdebug=1.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.11',
      label: 'COOP PHASE C2E: PER-SLOT BOONS',
      summary: ['Internal scaffolding: guest slot 1 now gets its own boon picker between rooms. Each player picks independently before play resumes. ?coopdebug=1 only.'],
      highlights: [
        'New pendingBoonSlotQueue + advanceCoopBoonQueue(): host picks first (full legendary path unchanged), then each alive guest slot picks from its own UPG clone.',
        'New showUpgradesForGuestSlot(slot): calls the existing showBoonSelection UI with slot.upg as the pool, applying picks to slot.upg and slot.metrics.hp/maxHp. No rerolls, no legendaries for guest slot in this phase.',
        'Resume path consolidated into resumePlayAfterBoons() and called once the queue drains. Solo path has an empty queue → bit-identical to previous flow.',
        'Guest boon picks persist across rooms via slot.upg and surface in the renderer (charge ring, aim) on the next combat tick.',
        'New scripts/test-coop-boon-queue.mjs: 10 contract tests (solo no-op, FIFO order, dead-slot skip, multi-guest drain). 157 tests total across 10 suites.',
        'Determinism preserved: solo path unchanged; compound replay still byte-identical. Playwright smoke clean for both solo and ?coopdebug=1 (two pickers open serially, play resumes after second).',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.10',
      label: 'COOP PHASE C2D-2: GUEST FIRE',
      summary: ['Internal scaffolding: guest slot 1 now auto-aims at the nearest enemy and fires. ?coopdebug=1 is now end-to-end playable same-device 2P (dev harness).'],
      highlights: [
        'New fireGuestSlot(slot, tx, ty): fresh-default UPG means no spread/crit/pierce/bounce/homing — a simple single bullet per charge unit. Stamps ownerId=slot.id and expireAt=simNowMs+PLAYER_SHOT_LIFE_MS so it obeys the normal bullet lifecycle.',
        'New updateGuestFire(dt, combatActive): charge builds at 1/s while still (matches default UPG), fire interval = 1/(sps*2)=0.625s. Uses pickPlayerAutoTarget(body.x, body.y) so the target-selection is shared with host.',
        'slot.aim.angle/hasTarget now reflect live targeting — renderer + future facing indicators can read them directly.',
        'Ghost sprite charge ring now animates for guest slot (previously fireProgress was hardcoded 0).',
        'New scripts/test-guest-fire.mjs: 15 contract tests (charge consume, ownerId stamp, fire gating, still-required, interval math). 147 tests total across 9 suites.',
        'Determinism preserved: solo path has no guest slots → updateGuestFire is skipped entirely. 50-room compound replay still byte-identical. Playwright smoke clean for both solo and ?coopdebug=1.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.9',
      label: 'COOP PHASE C2D-1B: PER-SLOT DAMAGE',
      summary: ['Internal scaffolding: guest slot 1 now takes real damage from enemies in ?coopdebug=1. Invisible to solo players.'],
      highlights: [
        'Guest slot 1 drops the permanent invincibility it had in C2c — now spawns with 1.5s of invuln, then is damageable.',
        'New tickGuestSlotTimers(dt) decays invincible/distort on guest slot bodies each frame (host is covered by the existing player.invincible decay).',
        'New applyContactDamageToGuestSlot / applyDangerDamageToGuestSlot / respawnGuestSlot helpers: drop hp on slot.metrics, flash invuln + distort, spawn damage number, on lethal hit respawn at spawnX/spawnY with full HP + 2s invuln (dev-harness only; coopdebug is not a product feature).',
        'Rusher contact damage now routes through the target slot: host retains the full UPG aftermath (lifeline/colossus/blood-pact), guests use the simplified helper. Siphon charge-drain now drains whichever slot is being targeted (bridge-backed for slot 0, own metric for guests).',
        'New processGuestDangerBulletHits(ts) runs after the main danger-bullet loop: any danger bullet that survived the host pass and now overlaps a guest slot is consumed and deals direct projectile damage. Output bullets are correctly ignored.',
        'New scripts/test-slot-damage.mjs: 11 contract tests (contact/danger hp drop, invuln flag, distort flag, lethal-triggers-respawn, invincible-blocks-hit, nearest-slot-only, output-ignored). 132 tests total across 8 suites.',
        'Determinism preserved: solo path has no guest slots → processGuestDangerBulletHits is skipped, all helpers unreachable. 50-room compound replay test still byte-identical. Playwright smoke clean for both solo and ?coopdebug=1.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.8',
      label: 'COOP PHASE C2D-1A: ENEMY TARGETING',
      summary: ['Internal scaffolding: enemies now pick the nearest living player slot each tick instead of hard-coding slot 0. Invisible to solo players.'],
      highlights: [
        'New getEnemyTargetSlot(enemy) selector: iterates getActiveSlots(), skips dead slots (hp<=0), returns nearest by distance-squared with a stable id-ASC tie-break so networking peers will agree.',
        'Enemy step loop (stepEnemyCombatState + fireEnemyBurst) now receives the chosen slot body as player, once per enemy per frame.',
        'spawnEB / spawnDBB / spawnTB / spawnEliteTriangleBullet accept an optional target param (defaults to host player singleton) so enemy projectiles aim at the same slot their parent enemy targeted.',
        'Damage and charge-drain paths are still host-only — gated by targetIsHost. Slot-aware damage plumbing comes in C2d-1b; slot 1 shooting comes in C2d-2. Slot 1 in ?coopdebug=1 stays invincible for now but will now have enemies aiming at it whenever it\'s the nearest slot.',
        'New scripts/test-enemy-targeting.mjs: 8 contract tests (solo, nearer-wins, tie-break, dead-slot skip, sparse array, null body). 121 tests total across 7 suites.',
        'Determinism preserved: solo path returns slot 0 → bit-identical to pre-C2d behavior. 50-room compound replay test still byte-identical.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.7',
      label: 'COOP PHASE C2C: SECOND PLAYER (DEV)',
      summary: ['Internal scaffolding: a second player slot can now render and move behind a dev-only URL flag. Invisible to solo players; never exposed in the UI.'],
      highlights: [
        'New src/core/inputAdapters.js: createHostInputAdapter(joy) + createArrowKeysInputAdapter(keyState) + createNullInputAdapter(). Each exposes a uniform moveVector() / isStill() contract so the update loop can drive any slot identically regardless of input source.',
        'Slot 0 now ships with createHostInputAdapter(joy) wired in at installPlayerSlot0() — no behavior change, just removing the temporary null input.',
        'Dev-only ?coopdebug=1 URL flag spawns playerSlots[1]: its own body/UPG/metrics/timers/aim (not bridged), spawn-offset to the right, invincible, controlled by arrow keys. A thin updateGuestSlotMovement(dt, W, H) helper runs after the slot-0 movement block so slot 0 determinism is bit-identical.',
        'drawGuestSlots(ts) renders each guest ghost after the host with a blue marker ring for visual distinction. Dev-only scaffolding — deleted when real online co-op ships.',
        'New scripts/test-input-adapters.mjs: 8 contract tests for host / arrow-keys / null adapters (deadzone, saturation, diagonal normalization, opposing-key cancel). 113 tests total across 6 suites.',
        'This is online-only co-op\'s testing harness — it lets multi-slot rendering, movement, and (soon) enemy targeting be validated without spinning up the Supabase transport. NOT a couch-co-op product feature.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
  {
      version: '1.20.6',
      label: 'COOP PHASE C2B: OWNERID + SLOT FIRE',
      summary: ['Internal refactor: player output bullets now carry an ownerId attribution field, and firePlayer / boon hooks accept an explicit slot. Invisible to solo players.'],
      highlights: [
        'createOutputBullet, pushOutputBullet, spawnRadialOutputBurst, and spawnSplitOutputBullets now plumb ownerId (default 0) as a first-class field. Split bullets inherit their source bullet\'s owner.',
        'buildPlayerVolleySpecs accepts an ownerId param so every shot in a volley is stamped with the shooter\'s slot id. Echo-fire replays reuse the same ownerId as the parent volley.',
        'firePlayer signature changed from firePlayer(tx, ty) to firePlayer(slot, tx, ty). Main-loop call site now passes playerSlots[0]. Attribution-only for now — player bullets still never collide with players.',
        'Boon hooks (onRoomStart / onRoomClear / onTick) now receive the shooter slot in their context object. Existing hook implementations ignore it; future per-slot hooks can route off it.',
        'New scripts/test-player-ownership.mjs: 8 contract tests covering createOutputBullet, pushOutputBullet, buildPlayerVolleySpecs, spawnRadialOutputBurst, spawnSplitOutputBullets ownerId propagation. 105 tests total across 5 suites.',
        'Experimental repo only; live repo unchanged.',
      ]
    },
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
