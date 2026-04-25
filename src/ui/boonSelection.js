import { pickBoonChoices, createHealBoon, getActiveBoonEntries, getEvolvedBoon } from '../data/boons.js';
import { iconHTML } from './iconRenderer.js';

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
      ${iconHTML(entry.icon, 'up-active-icon')}
      <div class="up-active-copy">
        <div class="up-active-name">${entry.name}</div>
        <div class="up-active-detail">${entry.detail}</div>
      </div>`;
    list.appendChild(row);
  }
}

function showBoonSelection({ upg, hp, maxHp, rerolls = 0, onReroll = null, onSelect, pendingLegendary = null, onLegendaryAccept = null, onLegendaryReject = null, boonsOverride = null, cardsContainer = document.getElementById('up-cards'), panel = document.getElementById('s-up') }) {
  // Coop D14 — boonsOverride lets the caller supply an explicit list of boon
  // objects (used by the online-coop handshake to keep host/guest picker UIs
  // in sync without depending on simRng position). When set, rerolls are
  // hidden because the choice list is host-authoritative.
  let pool = Array.isArray(boonsOverride) && boonsOverride.length > 0
    ? boonsOverride.slice()
    : pickBoonChoices(upg, hp, maxHp, pendingLegendary && onLegendaryAccept ? 2 : 3);
  // D18.12 — when boonsOverride is set, callers may still allow reroll by
  // passing onReroll that returns a fresh array of boon objects. Used by
  // the coop guest picker so the guest can reroll its own slot1-safe pool
  // locally without round-tripping through the host.
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
  const hpRow = document.createElement('div');
  hpRow.className = 'up-room-hp';
  hpRow.innerHTML = `
    <span class="up-room-hp-label">HP</span>
    <span class="up-room-hp-value">${Math.ceil(hp)} / ${Math.ceil(maxHp)}</span>`;

  function getMainCardEntries() {
    if(!(pendingLegendary && onLegendaryAccept)) return pool.map((boon) => ({ type: 'boon', boon }));
    const entries = pool.map((boon) => ({ type: 'boon', boon }));
    entries.splice(Math.min(1, entries.length), 0, { type: 'legendary', boon: pendingLegendary });
    return entries;
  }

  function buildMainCards() {
    mainRow.innerHTML = '';
    for(const entry of getMainCardEntries()) {
      const boon = entry.boon;
      const card = document.createElement('div');
      if(entry.type === 'legendary') {
        card.className = 'up-card legendary';
        card.innerHTML = `
          <div class="up-legendary-eyebrow">✦ LEGENDARY ✦</div>
          ${iconHTML(boon.icon)}
          <div class="up-name">${boon.name}</div>
          <div class="up-desc">${boon.desc}</div>
          <div class="up-tag" style="color:#fbbf24">LEGENDARY</div>`;
        card.onclick = () => {
          if(panel.classList.contains('screen-leaving')) return;
          panel.classList.add('screen-leaving');
          window.setTimeout(() => {
            panel.classList.add('off');
            panel.classList.remove('screen-entering', 'screen-leaving');
            cardsContainer.innerHTML = '';
            onLegendaryAccept(boon);
          }, BOON_FADE_MS);
        };
        mainRow.appendChild(card);
        continue;
      }

      const evolved = getEvolvedBoon(boon, upg);
      const isEvolved = evolved !== boon;
      const displayBoon = isEvolved ? evolved : boon;
      const tagColor = displayBoon.tag === 'OFFENSE' ? '#f87171' : displayBoon.tag === 'UTILITY' ? '#38bdf8' : '#4ade80';
      card.className = isEvolved ? 'up-card evolved' : 'up-card';
      card.innerHTML = `
        ${iconHTML(displayBoon.icon)}
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
          if(pendingLegendary && onLegendaryReject) onLegendaryReject(pendingLegendary);
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
    ${iconHTML(healBoon.icon)}
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
        ${iconHTML('🎲')}
        <div class="up-name">Reroll</div>
        <div class="up-desc">${avail ? `${remainingRerolls} reroll${remainingRerolls === 1 ? '' : 's'} left` : 'None left — clear 3 rooms damageless to earn more'}</div>
        <div class="up-tag" style="color:${avail ? '#fbbf24' : '#707070'}">${avail ? 'FREE' : 'SPENT'}</div>`;
    }
    updateRerollCard();
    rerollCard.onclick = () => {
      if(remainingRerolls <= 0 || panel.classList.contains('screen-leaving')) return;
      remainingRerolls--;
      const result = onReroll();
      if(boonsOverride) {
        // D18.12 — caller-supplied pool: trust onReroll's return as the new
        // pool. If it returns nothing usable, keep the old pool (defensive).
        if(Array.isArray(result) && result.length > 0) {
          pool = result.slice();
        }
      } else {
        pool = pickBoonChoices(upg, hp, maxHp, pendingLegendary && onLegendaryAccept ? 2 : 3);
      }
      buildMainCards();
      updateRerollCard();
    };
    healRow.appendChild(rerollCard);
  }

  cardsContainer.appendChild(hpRow);
  cardsContainer.appendChild(mainRow);
  cardsContainer.appendChild(healRow);

  panel.classList.remove('off', 'screen-leaving');
  panel.classList.add('screen-entering');
  window.setTimeout(() => panel.classList.remove('screen-entering'), BOON_FADE_MS);
}

export { showBoonSelection };
