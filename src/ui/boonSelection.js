import { pickBoonChoices, createHealBoon, getActiveBoonEntries, getEvolvedBoon } from '../data/boons.js';
import { getDamageVarianceBounds, getCritDamageFactor, getLateBloomGrowth } from '../systems/boonHelpers.js';
import { PLAYER_BASE_MOVE_SPEED, PLAYER_BASE_BULLET_SPEED } from '../data/boonConstants.js';
import { iconHTML } from './iconRenderer.js';

const BOON_FADE_MS = 180;

function formatStatValue(value, digits = 1) {
  if(!Number.isFinite(value)) return '0';
  if(Math.abs(value - Math.round(value)) < 0.05) return String(Math.round(value));
  return value.toFixed(digits);
}

function getLateBloomMenuMods(upg, roomIdx) {
  const growth = getLateBloomGrowth(roomIdx || 0);
  switch(upg?.lateBloomVariant) {
    case 'power':
      return { damage: growth, speed: 0.94 };
    case 'speed':
      return { damage: 1, speed: growth };
    case 'defense':
      return { damage: 0.94, speed: 1 };
    default:
      return { damage: 1, speed: 1 };
  }
}

function buildRewardStats(upg, roomIdx) {
  const variance = getDamageVarianceBounds(upg);
  const lateBloomMods = getLateBloomMenuMods(upg, roomIdx);
  const snipeScale = 1 + (upg?.snipePower || 0) * 0.35;
  const spsPenalty = Math.max(0.5, 1 - (upg?.spsTier || 0) * 0.04);
  const damageMult = snipeScale
    * (upg?.playerDamageMult || 1)
    * (upg?.denseDamageMult || 1)
    * (upg?.heavyRoundsDamageMult || 1)
    * lateBloomMods.damage
    * spsPenalty;
  const moveSpeedMult = (upg?.speedMult || 1)
    * (upg?.titanSlowMult || 1)
    * (upg?.extraLifeSlowMult || 1)
    * lateBloomMods.speed;
  const bulletSpeedMult = Math.min(2.0, upg?.shotSpd || 1)
    * (upg?.miniShotSpdMult || 1)
    * (1 + (upg?.snipePower || 0) * 0.18);
  const critChancePct = Math.max(0, Math.min(95, Math.round((upg?.critChance || 0) * 100)));
  const critDamagePct = Math.max(0, Math.round((getCritDamageFactor(upg) - 1) * 100));
  const baseBulletSpeed = PLAYER_BASE_BULLET_SPEED * bulletSpeedMult;
  const baseMoveSpeed = PLAYER_BASE_MOVE_SPEED * moveSpeedMult;
  return {
    damageMin: variance.min * damageMult * 10,
    damageMax: variance.max * damageMult * 10,
    critChancePct,
    critDamagePct,
    moveSpeed: baseMoveSpeed,
    bulletSpeed: baseBulletSpeed,
  };
}

function buildStatChip(label, value) {
  return `
    <div class="up-room-stat">
      <div class="up-room-stat-label">${label}</div>
      <div class="up-room-stat-value">${value}</div>
    </div>`;
}

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

function showBoonSelection({ upg, hp, maxHp, roomIdx = 0, rerolls = 0, onReroll = null, onSelect, pendingLegendary = null, onLegendaryAccept = null, onLegendaryReject = null, boonsOverride = null, cardsContainer = document.getElementById('up-cards'), panel = document.getElementById('s-up') }) {
  const defaultChoiceCount = pendingLegendary && onLegendaryAccept ? 2 : 3;
  // Coop D14 — boonsOverride lets the caller supply an explicit list of boon
  // objects (used by the online-coop handshake to keep host/guest picker UIs
  // in sync without depending on simRng position). When set, rerolls are
  // hidden because the choice list is host-authoritative.
  let pool = Array.isArray(boonsOverride) && boonsOverride.length > 0
    ? boonsOverride.slice()
    : pickBoonChoices(upg, hp, maxHp, defaultChoiceCount);
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
  cardsContainer.dataset.cardCount = String(Math.max(1, pool.length + ((pendingLegendary && onLegendaryAccept) ? 1 : 0)));
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
  const stats = buildRewardStats(upg, roomIdx);
  const statsRow = document.createElement('div');
  statsRow.className = 'up-room-stats';
  statsRow.innerHTML = [
    buildStatChip('DMG', `${formatStatValue(stats.damageMin)}-${formatStatValue(stats.damageMax)}`),
    buildStatChip('CRIT', `${stats.critChancePct}%`),
    buildStatChip('CRIT DMG', `+${stats.critDamagePct}%`),
    buildStatChip('MOVE', `${Math.round(stats.moveSpeed)} px/s`),
    buildStatChip('BULLET', `${Math.round(stats.bulletSpeed)} px/s`),
  ].join('');

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
        pool = pickBoonChoices(upg, hp, maxHp, defaultChoiceCount);
      }
      cardsContainer.dataset.cardCount = String(Math.max(1, pool.length + ((pendingLegendary && onLegendaryAccept) ? 1 : 0)));
      buildMainCards();
      updateRerollCard();
    };
    healRow.appendChild(rerollCard);
  }

  cardsContainer.appendChild(hpRow);
  cardsContainer.appendChild(statsRow);
  cardsContainer.appendChild(mainRow);
  cardsContainer.appendChild(healRow);

  panel.classList.remove('off', 'screen-leaving');
  panel.classList.add('screen-entering');
  window.setTimeout(() => panel.classList.remove('screen-entering'), BOON_FADE_MS);
}

export { showBoonSelection };
