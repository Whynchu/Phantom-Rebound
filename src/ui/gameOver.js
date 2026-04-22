function showGameOverScreen({
  panelEl,
  boonsPanelEl,
  scoreEl,
  noteEl,
  breakdownEl,
  score,
  note,
  breakdown,
  stats,
  renderBoons,
}) {
  if(boonsPanelEl) boonsPanelEl.classList.add('off');
  if(scoreEl) scoreEl.textContent = formatNumber(score);
  if(noteEl) noteEl.textContent = note;
  if(breakdownEl) renderScoreBreakdown(breakdownEl, breakdown, stats);
  renderBoons?.();
  panelEl?.classList.remove('off');
}

function renderScoreBreakdown(el, breakdown, stats) {
  el.innerHTML = '';
  const rows = [];
  if (breakdown) {
    if (breakdown.kills)      rows.push(['Kill points',    breakdown.kills]);
    if (breakdown.overkill)   rows.push(['Overkill',       breakdown.overkill]);
    if (breakdown.roomClear)  rows.push(['Room clears',    breakdown.roomClear]);
    if (breakdown.pace)       rows.push(['Pace bonus',     breakdown.pace]);
    if (breakdown.efficiency) rows.push(['HP efficiency',  breakdown.efficiency]);
    if (breakdown.flawless)   rows.push(['Flawless rooms', breakdown.flawless]);
    if (breakdown.clutch)     rows.push(['Clutch rooms',   breakdown.clutch]);
    if (breakdown.density)    rows.push(['Combat density', breakdown.density]);
    if (breakdown.accuracy)   rows.push(['Accuracy',       breakdown.accuracy]);
    if (breakdown.dodge)      rows.push(['Dodge bonus',    breakdown.dodge]);
    if (breakdown.boss)       rows.push(['Boss takedowns', breakdown.boss]);
    if (breakdown.streak)     rows.push(['Streak bonus',   breakdown.streak]);
  }
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'go-breakdown-row';
    const l = document.createElement('span');
    l.className = 'go-breakdown-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'go-breakdown-value';
    v.textContent = formatNumber(value);
    row.appendChild(l);
    row.appendChild(v);
    el.appendChild(row);
  }
  if (stats) {
    const parts = [];
    if (Number.isFinite(stats.kills) && stats.kills > 0) parts.push(`${stats.kills} kills`);
    if (Number.isFinite(stats.rooms) && stats.rooms > 0) parts.push(`Room ${stats.rooms}`);
    if (Number.isFinite(stats.elapsedMs) && stats.elapsedMs > 0) parts.push(formatDuration(stats.elapsedMs));
    if (Number.isFinite(stats.damagelessRooms) && stats.damagelessRooms > 0) {
      parts.push(`${stats.damagelessRooms} clean ${stats.damagelessRooms === 1 ? 'room' : 'rooms'}`);
    }
    if (parts.length) {
      const statRow = document.createElement('div');
      statRow.className = 'go-breakdown-stats';
      statRow.textContent = parts.join(' · ');
      el.appendChild(statRow);
    }
  }
}

function formatNumber(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('en-US');
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export { showGameOverScreen };
