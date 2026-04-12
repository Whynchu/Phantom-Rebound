function isSameLocalDay(ts, nowTs = Date.now()) {
  const a = new Date(ts);
  const b = new Date(nowTs);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function getVisibleLeaderboardRows(leaderboard, lbPeriod, lbScope, playerName) {
  let rows = Array.isArray(leaderboard) ? leaderboard.slice() : [];
  if(lbPeriod === 'daily') rows = rows.filter((row) => isSameLocalDay(row.ts));
  if(lbScope === 'personal') rows = rows.filter((row) => row.name === playerName);
  rows.sort((a, b) => b.score - a.score || b.ts - a.ts);
  return rows.slice(0, 10);
}

function getLeaderboardRowRunTimeMs(row) {
  if(Number.isFinite(row.runTimeMs)) return row.runTimeMs;
  const telemetry = row.boons?.telemetry;
  if(!telemetry) return null;
  const rooms = Array.isArray(telemetry.rooms) ? telemetry.rooms : [];
  if(rooms.length > 0) {
    return rooms.reduce((sum, room) => sum + (Number(room.clearMs) || 0), 0);
  }
  return null;
}

function syncLeaderboardStatusBadge(lbStatus, statusMode, statusText) {
  if(!lbStatus) return;
  lbStatus.textContent = statusText;
  lbStatus.classList.remove('syncing', 'synced', 'local', 'error');
  lbStatus.classList.add(statusMode);
}

function syncLeaderboardToggleStates(lbPeriodBtns, lbScopeBtns, lbPeriod, lbScope) {
  lbPeriodBtns?.forEach((btn) => btn.classList.toggle('active', btn.dataset.lbPeriod === lbPeriod));
  lbScopeBtns?.forEach((btn) => btn.classList.toggle('active', btn.dataset.lbScope === lbScope));
}

function renderLeaderboard({
  lbCurrent,
  lbStatus,
  lbList,
  lbPeriod,
  lbScope,
  playerName,
  lbStatusMode,
  lbStatusText,
  useRemoteLeaderboardRows,
  remoteLeaderboardRows,
  leaderboard,
  playerColors,
  formatRunTime,
  onOpenBoons,
  lbPeriodBtns,
  lbScopeBtns,
}) {
  const periodLabel = lbPeriod === 'daily' ? 'DAILY' : 'ALL TIME';
  const scopeLabel = lbScope === 'personal' ? 'PERSONAL' : 'EVERYONE';
  lbCurrent.textContent = `RUNNER: ${playerName} · ${periodLabel} · ${scopeLabel}`;
  lbStatus.textContent = lbStatusText;
  lbList.innerHTML = '';
  const rows = lbStatusMode === 'syncing'
    ? []
    : (useRemoteLeaderboardRows
      ? remoteLeaderboardRows
      : getVisibleLeaderboardRows(leaderboard, lbPeriod, lbScope, playerName));

  if(rows.length === 0) {
    const li = document.createElement('li');
    li.className = 'lb-empty';
    li.textContent = lbStatusMode === 'syncing' ? 'Syncing records...' : 'No runs match this view yet.';
    lbList.appendChild(li);
    syncLeaderboardToggleStates(lbPeriodBtns, lbScopeBtns, lbPeriod, lbScope);
    return;
  }

  for(let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const li = document.createElement('li');
    const boonData = Array.isArray(row.boons)
      ? { picks: row.boons, color: row.color || 'green', order: row.boonOrder || '' }
      : (row.boons || { picks: [], color: row.color || 'green', order: row.boonOrder || '' });
    const hasBoons = boonData.picks && boonData.picks.length > 0;
    const playerColor = boonData.color || row.color || 'green';
    const boonOrder = boonData.order || row.boonOrder || '';
    const borderColor = playerColors[playerColor]?.hex || playerColors.green.hex;

    li.style.borderLeft = `3px solid ${borderColor}`;
    const runTimeMs = getLeaderboardRowRunTimeMs(row);
    const runTimeLabel = runTimeMs ? ` · ${formatRunTime(runTimeMs)}` : '';
    li.innerHTML = `
      <span class="lb-rank">#${i + 1}</span>
      <span class="lb-name">${row.name} · R${row.room}${runTimeLabel}</span>
      <span class="lb-score">${row.score}</span>
      ${hasBoons ? '<button class="lb-boons-btn" type="button" title="View run loadout">📋</button>' : '<span></span>'}
    `;
    if(hasBoons) {
      li.querySelector('.lb-boons-btn')
        ?.addEventListener('click', () => onOpenBoons?.(row.name, boonData.picks, boonOrder));
    }
    lbList.appendChild(li);
  }

  syncLeaderboardToggleStates(lbPeriodBtns, lbScopeBtns, lbPeriod, lbScope);
}

export { renderLeaderboard, syncLeaderboardStatusBadge, syncLeaderboardToggleStates };
