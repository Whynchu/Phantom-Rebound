function sanitizePlayerName(value) {
  const cleaned = (value || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim();
  return cleaned.slice(0, 14);
}

function parseLocalLeaderboardRows(rows, { gameVersion, limit = 500 }) {
  if(!Array.isArray(rows)) return [];
  return rows
    .filter((entry) => (
      entry
      && typeof entry.name === 'string'
      && Number.isFinite(entry.score)
      && Number.isFinite(entry.ts)
      && entry.version === gameVersion
    ))
    .slice(0, limit)
    .sort((a, b) => b.score - a.score || b.ts - a.ts);
}

function upsertLocalLeaderboardEntry(leaderboard, entry, limit = 500) {
  const next = Array.isArray(leaderboard) ? [...leaderboard, entry] : [entry];
  next.sort((a, b) => b.score - a.score || b.ts - a.ts);
  return next.slice(0, limit);
}

function buildLocalScoreEntry({
  playerName,
  score,
  room,
  runTimeMs,
  gameVersion,
  color,
  boonOrder,
  boons,
  telemetry,
  ts = Date.now(),
}) {
  return {
    name: playerName,
    score,
    room,
    runTimeMs,
    ts,
    version: gameVersion,
    color,
    boonOrder,
    boons: {
      picks: boons,
      color,
      order: boonOrder,
      telemetry,
    },
  };
}

export {
  sanitizePlayerName,
  parseLocalLeaderboardRows,
  upsertLocalLeaderboardEntry,
  buildLocalScoreEntry,
};
