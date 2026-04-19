import { iconHTML } from './iconRenderer.js';

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

function showLeaderboardBoonsPopup({ popup, titleEl, listEl, runnerName, boons, boonOrder = '' }) {
  if(!popup || !titleEl || !listEl) return;
  titleEl.textContent = `${runnerName} · Run Loadout`;
  const orderedBoons = orderBoonsForDisplay(boons, boonOrder);
  renderBoonRows(listEl, orderedBoons, 'No boon data recorded.');
  popup.classList.remove('off');
}

export { orderBoonsForDisplay, renderGameOverBoonsList, showLeaderboardBoonsPopup };
