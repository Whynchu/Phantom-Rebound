function sanitizePlayerName(value) {
  const cleaned = (value || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim();
  return cleaned.slice(0, 14);
}

function parseLocalLeaderboardRows(rows, { gameVersionPrefix = '', gameVersion = '', limit = 500 }) {
  const prefix = String(gameVersionPrefix || '').trim();
  const exact = String(gameVersion || '').trim();
  if(!Array.isArray(rows)) return [];
  return rows
    .filter((entry) => (
      entry
      && typeof entry.name === 'string'
      && Number.isFinite(entry.score)
      && Number.isFinite(entry.ts)
      && (
        (prefix && typeof entry.version === 'string' && entry.version.startsWith(prefix))
        || (!prefix && exact && entry.version === exact)
      )
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
  scoreBreakdown,
  ts = Date.now(),
  runMode = 'solo',
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
    boonIds: Array.isArray(boons)
      ? boons.map((boon) => (boon && typeof boon === 'object' ? boon.name : String(boon || ''))).filter(Boolean)
      : [],
    runMode: runMode === 'coop' ? 'coop' : 'solo',
    boons: {
      picks: boons,
      color,
      order: boonOrder,
      telemetry,
      scoreBreakdown: scoreBreakdown || null,
    },
  };
}

export {
  sanitizePlayerName,
  parseLocalLeaderboardRows,
  upsertLocalLeaderboardEntry,
  buildLocalScoreEntry,
};
