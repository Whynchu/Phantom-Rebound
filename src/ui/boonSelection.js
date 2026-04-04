import { pickBoonChoices, createHealBoon, getActiveBoonEntries, getEvolvedBoon } from '../data/boons.js';

const BOON_FADE_MS = 180;

function renderActiveBoons(upg) {
  const panel = document.getElementById('up-active-panel');
  const list = document.getElementById('up-active-list');
  if(!panel || !list) return;
  const entries = getActiveBoonEntries(upg);
  list.innerHTML = '';
  if(entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'up-active-empty';
    empty.textContent = 'No active boons yet.';
    list.appendChild(empty);
    return;
  }
  for(const entry of entries) {
    const row = document.createElement('div');
    row.className = 'up-active-item';
    row.innerHTML = `
      <div class="up-active-icon">${entry.icon}</div>
      <div class="up-active-copy">
        <div class="up-active-name">${entry.name}</div>
        <div class="up-active-detail">${entry.detail}</div>
      </div>`;
    list.appendChild(row);
  }
}

function showBoonSelection({ upg, hp, maxHp, rerolls = 0, onReroll = null, onSelect, cardsContainer = document.getElementById('up-cards'), panel = document.getElementById('s-up') }) {
  let pool = pickBoonChoices(upg, hp, maxHp);
  let remainingRerolls = rerolls;
  const healBoon = createHealBoon(upg);
  const toggleBtn = document.getElementById('btn-up-active');
  const activePanel = document.getElementById('up-active-panel');
  const activeCloseBtn = document.getElementById('btn-up-active-close');

  cardsContainer.innerHTML = '';
  cardsContainer.dataset.cardCount = '3';
  renderActiveBoons(upg);
  if(activePanel) activePanel.classList.add('off');

  const setActivePanelOpen = (open) => {
    if(!activePanel) return;
    activePanel.classList.toggle('off', !open);
  };

  if(toggleBtn) toggleBtn.onclick = () => setActivePanelOpen(activePanel.classList.contains('off'));
  if(activeCloseBtn) activeCloseBtn.onclick = () => setActivePanelOpen(false);

  const mainRow = document.createElement('div');
  mainRow.className = 'up-cards-main';
  const healRow = document.createElement('div');
  healRow.className = 'up-heal-row';

  function buildMainCards() {
    mainRow.innerHTML = '';
    for(const boon of pool) {
      const evolved = getEvolvedBoon(boon, upg);
      const isEvolved = evolved !== boon;
      const displayBoon = isEvolved ? evolved : boon;
      const card = document.createElement('div');
      const tagColor = displayBoon.tag === 'OFFENSE' ? '#f87171' : displayBoon.tag === 'UTILITY' ? '#38bdf8' : '#4ade80';
      card.className = isEvolved ? 'up-card evolved' : 'up-card';
      card.innerHTML = `
        <div class="up-icon">${displayBoon.icon}</div>
        <div class="up-name">${displayBoon.name}</div>
        <div class="up-desc">${displayBoon.desc}</div>
        <div class="up-tag" style="color:${tagColor}">${displayBoon.tag}</div>`;
      card.onclick = () => {
        if(panel.classList.contains('screen-leaving')) return;
        panel.classList.add('screen-leaving');
        window.setTimeout(() => {
          setActivePanelOpen(false);
          panel.classList.add('off');
          panel.classList.remove('screen-entering', 'screen-leaving');
          onSelect(boon);
        }, BOON_FADE_MS);
      };
      mainRow.appendChild(card);
    }
  }

  buildMainCards();

  const healCard = document.createElement('div');
  healCard.className = `up-card heal-card heal-card-small${healBoon.disabled ? ' disabled' : ''}`;
  healCard.innerHTML = `
    <div class="up-icon">${healBoon.icon}</div>
    <div class="up-name">${healBoon.name}</div>
    <div class="up-desc">${healBoon.desc}</div>
    <div class="up-tag" style="color:${healBoon.disabled ? '#707070' : '#f87171'}">${healBoon.disabled ? 'SPENT' : healBoon.tag}</div>`;
  healCard.onclick = () => {
    if(healBoon.disabled || panel.classList.contains('screen-leaving')) return;
    panel.classList.add('screen-leaving');
    window.setTimeout(() => {
      setActivePanelOpen(false);
      panel.classList.add('off');
      panel.classList.remove('screen-entering', 'screen-leaving');
      onSelect(healBoon);
    }, BOON_FADE_MS);
  };
  healRow.appendChild(healCard);

  if(onReroll !== null) {
    const rerollCard = document.createElement('div');
    function updateRerollCard() {
      const avail = remainingRerolls > 0;
      rerollCard.className = `up-card reroll-card reroll-card-small${avail ? '' : ' disabled'}`;
      rerollCard.innerHTML = `
        <div class="up-icon">🎲</div>
        <div class="up-name">Reroll</div>
        <div class="up-desc">${avail ? `${remainingRerolls} reroll${remainingRerolls === 1 ? '' : 's'} left` : 'None left — clear 3 rooms damageless to earn more'}</div>
        <div class="up-tag" style="color:${avail ? '#fbbf24' : '#707070'}">${avail ? 'FREE' : 'SPENT'}</div>`;
    }
    updateRerollCard();
    rerollCard.onclick = () => {
      if(remainingRerolls <= 0 || panel.classList.contains('screen-leaving')) return;
      remainingRerolls--;
      onReroll();
      pool = pickBoonChoices(upg, hp, maxHp);
      buildMainCards();
      updateRerollCard();
    };
    healRow.appendChild(rerollCard);
  }

  cardsContainer.appendChild(mainRow);
  cardsContainer.appendChild(healRow);

  panel.classList.remove('off', 'screen-leaving');
  panel.classList.add('screen-entering');
  window.setTimeout(() => panel.classList.remove('screen-entering'), BOON_FADE_MS);
}

export { showBoonSelection };
