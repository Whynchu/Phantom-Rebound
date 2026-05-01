import { iconHTML } from './iconRenderer.js';
import { renderScoreBreakdown } from './gameOver.js';

function renderBoonRows(container, entries, emptyText) {
  if(!container) return;
  container.innerHTML = '';
  if(!Array.isArray(entries) || entries.length === 0) {
    container.innerHTML = `<div class="up-active-empty">${emptyText}</div>`;
    return;
  }

  const doc = container.ownerDocument || document;
  for(const entry of entries) {
    const row = doc.createElement('div');
    row.className = 'up-active-item';
    row.innerHTML = `${iconHTML(entry.icon, 'up-active-icon')}<div class="up-active-copy"><div class="up-active-name">${entry.name}</div><div class="up-active-detail">${entry.detail}</div></div>`;
    container.appendChild(row);
  }
}

function orderBoonsForDisplay(boons, boonOrder = '') {
  if(!Array.isArray(boons) || boons.length < 2 || !boonOrder) return boons;
  const orderedNames = boonOrder.split(',').map((name) => name.trim()).filter(Boolean);
  if(orderedNames.length === 0) return boons;
  const orderMap = new Map(orderedNames.map((name, index) => [name, index]));
  return [...boons].sort((a, b) => {
    const aIndex = orderMap.has(a.name) ? orderMap.get(a.name) : Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.has(b.name) ? orderMap.get(b.name) : Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex || a.name.localeCompare(b.name);
  });
}

function renderGameOverBoonsList(container, boons) {
  renderBoonRows(container, boons, 'No boons collected this run.');
}

function showLeaderboardRunSummaryPopup({
  popup,
  titleEl,
  scoreEl,
  noteEl,
  breakdownEl,
  listEl,
  runnerName,
  score,
  note = '',
  breakdown = null,
  stats = null,
  boons,
  boonOrder = '',
}) {
  if(!popup || !titleEl || !scoreEl || !noteEl || !breakdownEl || !listEl) return;
  titleEl.textContent = `${runnerName} · Run Summary`;
  scoreEl.textContent = Number.isFinite(score) ? Math.round(score).toLocaleString('en-US') : '0';
  noteEl.textContent = note || '';
  renderScoreBreakdown(breakdownEl, breakdown, stats);
  const orderedBoons = orderBoonsForDisplay(boons, boonOrder);
  renderBoonRows(listEl, orderedBoons, 'No boon data recorded.');
  popup.classList.remove('off');
}

function showLeaderboardBoonsPopup(args) {
  const runnerName = args.runnerName || args.name || 'RUNNER';
  const score = Number.isFinite(args.score) ? args.score : 0;
  const note = args.note || '';
  const breakdown = args.breakdown || args.scoreBreakdown || null;
  const stats = args.stats || null;
  const boons = Array.isArray(args.boons)
    ? args.boons
    : (args.boons?.picks || []);
  const boonOrder = args.boonOrder || args.boons?.order || '';
  return showLeaderboardRunSummaryPopup({
    ...args,
    runnerName,
    score,
    note,
    breakdown,
    stats,
    boons,
    boonOrder,
  });
}

export {
  orderBoonsForDisplay,
  renderGameOverBoonsList,
  showLeaderboardBoonsPopup,
  showLeaderboardRunSummaryPopup,
};
