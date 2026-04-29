import { LEADERBOARD_REMOTE_CONFIG, hasRemoteLeaderboardConfig } from '../data/leaderboardConfig.js';

function normalizePeriod(period) {
  return period === 'daily' ? 'daily' : 'all';
}

function normalizeScope(scope) {
  return scope === 'personal' ? 'personal' : 'everyone';
}

function normalizeRunMode(mode) {
  return mode === 'coop' ? 'coop' : 'solo';
}

function mapRemoteRow(row) {
  return {
    name: row.player_name,
    score: Number(row.score) || 0,
    room: Number(row.room) || 1,
    ts: row.created_at ? Date.parse(row.created_at) : Date.now(),
    boons: row.boons || null,
    color: row.player_color || 'green',
    boonOrder: row.boon_order || '',
    durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    runMode: row.run_mode === 'coop' ? 'coop' : 'solo',
  };
}

async function callLeaderboardRpc(fnName, payload) {
  if(!hasRemoteLeaderboardConfig()) throw new Error('Remote leaderboard not configured');

  const response = await fetch(`${LEADERBOARD_REMOTE_CONFIG.url}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: LEADERBOARD_REMOTE_CONFIG.publishableKey,
      Authorization: `Bearer ${LEADERBOARD_REMOTE_CONFIG.publishableKey}`,
    },
    body: JSON.stringify(payload),
  });

  if(!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `${fnName} failed (${response.status})`);
  }

  return response.json();
}

async function fetchRemoteLeaderboard({ period, scope, playerName, gameVersion, limit = 100, mode = 'solo' }) {
  const rows = await callLeaderboardRpc('get_leaderboard', {
    p_period: normalizePeriod(period),
    p_scope: normalizeScope(scope),
    p_player_name: playerName,
    p_game_version: gameVersion,
    p_limit: limit,
    p_run_mode: normalizeRunMode(mode),
  });
  return Array.isArray(rows) ? rows.map(mapRemoteRow) : [];
}

async function submitRemoteScore({ playerName, score, room, gameVersion, boons, playerColor = 'green', durationSeconds = null, runMode = 'solo' }) {
  const payload = {
    p_player_name: playerName,
    p_score: score,
    p_room: room,
    p_game_version: gameVersion,
    p_boons: boons || null,
    p_player_color: playerColor,
    p_run_mode: normalizeRunMode(runMode),
  };
  if (durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds >= 0) {
    payload.p_duration_seconds = Math.max(0, Math.round(durationSeconds));
  }
  return callLeaderboardRpc('submit_score', payload);
}

async function submitRunDiagnostic({ playerName, score, room, gameVersion, report, playerColor = 'green' }) {
  return callLeaderboardRpc('submit_run_diagnostic', {
    p_player_name: playerName,
    p_score: score,
    p_room: room,
    p_game_version: gameVersion,
    p_report: report || null,
    p_player_color: playerColor,
  });
}

export { fetchRemoteLeaderboard, submitRemoteScore, submitRunDiagnostic };
