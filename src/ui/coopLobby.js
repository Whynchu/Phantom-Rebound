// Co-op lobby UI controller.
//
// Phase B: gets two browsers to a shared "ready" state with matching
// simulation seed. Does NOT start gameplay — that's Phase C. When
// both peers reach ready, we just show a confirmation ("Partner ready:
// <name>") so the smoke test can verify both sides agree on the seed.
//
// URL contract:
//   ?coop=1         -> show Co-op button on start screen
//   ?room=XXXXXX    -> auto-open lobby in Join mode with code filled
//
// DOM contract (elements created in index.html):
//   #btn-coop              -> start-screen button that opens the lobby
//   #s-coop-lobby          -> lobby screen (class="screen off")
//     .coop-mode-row buttons[data-coop-mode="create"|"join"]
//     #coop-create-view, #coop-join-view, #coop-waiting-view,
//     #coop-ready-view, #coop-error-view
//     #coop-create-start, #coop-join-start
//     #coop-join-code (input)
//     #coop-waiting-code (span), #coop-waiting-share (input, readonly)
//     #coop-copy-share (button)
//     #coop-ready-partner (span)
//     #coop-error-msg (span)
//     #coop-back-home (button, all views)

import { createCoopSession } from '../net/coopSession.js';
import {
  generateRoomCode,
  generateOpaqueId,
  generateSimSeed,
} from '../net/coopTransport.js';

const VIEWS = ['create', 'join', 'waiting', 'ready', 'error'];

function parseCoopFlags(search = window.location.search) {
  const params = new URLSearchParams(search);
  const enabled = params.get('coop') === '1' || params.has('room');
  const room = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return { enabled, room };
}

function buildShareUrl(code) {
  const url = new URL(window.location.href);
  url.searchParams.set('coop', '1');
  url.searchParams.set('room', code);
  return url.toString();
}

function bindCoopLobby({
  coopButton,
  lobbyScreen,
  startScreen,
  root,
  getPlayerName,
  getPlayerColor,
  setMenuChromeVisible,
  onReady,
  transportFactory,
  logger = console,
} = {}) {
  if (!lobbyScreen || !coopButton) {
    return { open: () => {}, close: () => {}, dispose: () => {} };
  }

  const flags = parseCoopFlags();
  if (flags.enabled) {
    coopButton.classList.remove('off');
  } else {
    coopButton.classList.add('off');
  }

  const $ = (sel) => lobbyScreen.querySelector(sel);
  const views = {};
  VIEWS.forEach((k) => { views[k] = $(`#coop-${k}-view`); });

  function showView(name) {
    VIEWS.forEach((k) => views[k]?.classList.toggle('off', k !== name));
  }

  let activeSession = null;
  let activeRole = null;

  function resetSession() {
    if (activeSession) {
      activeSession.close().catch(() => {});
      activeSession = null;
      activeRole = null;
    }
  }

  function openLobby({ joinCode } = {}) {
    startScreen?.classList.add('off');
    lobbyScreen.classList.remove('off');
    setMenuChromeVisible?.(true);
    if (joinCode) {
      const input = $('#coop-join-code');
      if (input) input.value = joinCode;
      showView('join');
    } else {
      showView('create');
    }
  }

  function closeLobby() {
    resetSession();
    lobbyScreen.classList.add('off');
    startScreen?.classList.remove('off');
    setMenuChromeVisible?.(true);
  }

  coopButton.addEventListener('click', () => openLobby());

  lobbyScreen.querySelectorAll('[data-coop-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-coop-mode');
      if (mode === 'create' || mode === 'join') showView(mode);
    });
  });

  lobbyScreen.querySelectorAll('[data-coop-back]').forEach((btn) => {
    btn.addEventListener('click', () => {
      resetSession();
      closeLobby();
    });
  });

  function identity() {
    return {
      name: (getPlayerName?.() || 'RUNNER').toString().slice(0, 14),
      color: getPlayerColor?.() || null,
    };
  }

  function startSession(role, code) {
    resetSession();
    const session = createCoopSession({
      role,
      code,
      identity: identity(),
      transportFactory,
      generateSeed: generateSimSeed,
      generateId: generateOpaqueId,
      logger: (...args) => logger?.log?.('[coop]', ...args),
    });
    activeSession = session;
    activeRole = role;

    session.on('stateChange', ({ phase }) => {
      logger?.log?.('[coop] phase →', phase);
    });
    session.on('error', (err) => {
      const msg = $('#coop-error-msg');
      if (msg) msg.textContent = `${err.code}${err.detail ? ': ' + err.detail : ''}`;
      showView('error');
    });
    session.on('ready', ({ seed, partnerIdentity }) => {
      const nameEl = $('#coop-ready-partner');
      const seedEl = $('#coop-ready-seed');
      const roleEl = $('#coop-ready-role');
      if (nameEl) nameEl.textContent = partnerIdentity?.name || 'PARTNER';
      if (seedEl) seedEl.textContent = String(seed);
      if (roleEl) roleEl.textContent = role.toUpperCase();
      showView('ready');
      onReady?.({ seed, partnerIdentity, role, code });
    });

    if (role === 'host') {
      const codeEl = $('#coop-waiting-code');
      const shareEl = $('#coop-waiting-share');
      if (codeEl) codeEl.textContent = code;
      if (shareEl) shareEl.value = buildShareUrl(code);
      showView('waiting');
    } else {
      showView('waiting');
      const codeEl = $('#coop-waiting-code');
      if (codeEl) codeEl.textContent = code;
      const shareEl = $('#coop-waiting-share');
      if (shareEl) shareEl.value = 'Connecting...';
    }

    session.start().catch((err) => {
      const msg = $('#coop-error-msg');
      if (msg) msg.textContent = `start failed: ${err?.message || err}`;
      showView('error');
    });
  }

  $('#coop-create-start')?.addEventListener('click', () => {
    const code = generateRoomCode(6);
    startSession('host', code);
  });

  $('#coop-join-start')?.addEventListener('click', () => {
    const input = $('#coop-join-code');
    const raw = (input?.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (raw.length !== 6) {
      const msg = $('#coop-error-msg');
      if (msg) msg.textContent = 'Enter a 6-character room code';
      showView('error');
      return;
    }
    startSession('guest', raw);
  });

  $('#coop-copy-share')?.addEventListener('click', async () => {
    const shareEl = $('#coop-waiting-share');
    const codeEl = $('#coop-waiting-code');
    if (!shareEl?.value) return;
    const shareUrl = shareEl.value;
    const code = codeEl?.textContent?.trim() || '';
    const btn = $('#coop-copy-share');
    const prev = btn?.textContent;

    // Prefer native share sheet on mobile — keeps us in the browser's
    // share UI rather than fully context-switching to another app,
    // which on mobile often suspends the tab and drops the WebSocket.
    const payload = {
      title: 'Phantom Rebound Co-op',
      text: `Join my Phantom Rebound co-op run — room ${code}`,
      url: shareUrl,
    };
    const canShare = typeof navigator !== 'undefined'
      && typeof navigator.share === 'function'
      && (!navigator.canShare || navigator.canShare(payload));
    if (canShare) {
      try {
        await navigator.share(payload);
        if (btn) {
          btn.textContent = 'Shared!';
          setTimeout(() => { btn.textContent = prev; }, 1200);
        }
        return;
      } catch (err) {
        // User cancelled or share failed — fall through to clipboard.
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard?.writeText(shareUrl);
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = prev; }, 1200);
      }
    } catch { /* ignore */ }
  });

  // Auto-open on ?room=XXXXXX
  if (flags.enabled && flags.room && flags.room.length === 6) {
    setTimeout(() => openLobby({ joinCode: flags.room }), 0);
  }

  return {
    open: openLobby,
    close: closeLobby,
    dispose: () => { resetSession(); },
  };
}

export { bindCoopLobby, parseCoopFlags, buildShareUrl };
