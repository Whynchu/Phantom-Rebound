async function refreshLeaderboardSync({
  lbSync,
  period,
  scope,
  playerName,
  gameVersion,
  limit = 10,
  fetchRemoteLeaderboard,
  beginLeaderboardSync,
  applyLeaderboardSyncSuccess,
  applyLeaderboardSyncFailure,
  onSyncStart,
}) {
  const requestId = beginLeaderboardSync(lbSync);
  onSyncStart?.(requestId);
  try {
    const rows = await fetchRemoteLeaderboard({
      period,
      scope,
      playerName,
      gameVersion,
      limit,
    });
    const applied = applyLeaderboardSyncSuccess(lbSync, requestId, rows);
    return { requestId, applied, ok: applied };
  } catch {
    const applied = applyLeaderboardSyncFailure(lbSync, requestId);
    return { requestId, applied, ok: false };
  }
}

function shouldRefreshLeaderboardAfterSubmit({ lbScope, playerName, entryName }) {
  return lbScope !== 'personal' || playerName === entryName;
}

async function submitLeaderboardEntryRemote({
  entry,
  gameVersion,
  submitRemoteScore,
  forceLocalLeaderboardFallback,
  lbSync,
}) {
  try {
    await submitRemoteScore({
      playerName: entry.name,
      score: entry.score,
      room: entry.room,
      gameVersion,
      boons: entry.boons,
      playerColor: entry.color,
    });
    return { ok: true };
  } catch {
    forceLocalLeaderboardFallback(lbSync, 'LOCAL FALLBACK');
    return { ok: false };
  }
}

export {
  refreshLeaderboardSync,
  shouldRefreshLeaderboardAfterSubmit,
  submitLeaderboardEntryRemote,
};
