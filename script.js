import { C, ROOM_SCRIPTS, DECAY_BASE, M, VERSION } from './src/data/gameData.js';
import { getActiveBoonEntries, getDefaultUpgrades, getRequiredShotCount, syncChargeCapacity, getEvolvedBoon, checkLegendarySequences } from './src/data/boons.js';
import { ENEMY_TYPES, createEnemy, canEnemyUsePurpleShots } from './src/entities/enemyTypes.js';
import { JOY_DEADZONE, JOY_MAX, createJoystickState, resetJoystickState, bindJoystickControls, tickJoystick } from './src/input/joystick.js';
import { fetchRemoteLeaderboard, submitRemoteScore } from './src/platform/leaderboardService.js';
import { bindResponsiveViewport } from './src/platform/viewport.js';
import { showBoonSelection } from './src/ui/boonSelection.js';
import { renderVersionTag } from './src/ui/versionTag.js';

renderVersionTag(VERSION);

// Suppress iOS Safari magnifier / long-press context menu on the whole page
document.addEventListener('contextmenu', (e) => e.preventDefault());
// Block dblclick — iOS can route double-tap zoom through this even when CSS manipulation is set
document.addEventListener('dblclick', (e) => e.preventDefault());

function revealAppShell() {
  requestAnimationFrame(() => {
    document.body.classList.remove('app-loading');
    document.body.classList.add('app-ready');
  });
}

const cv  = document.getElementById('cv');
const ctx = cv.getContext('2d');
const LB_KEY = 'phantom-rebound-leaderboard-v1';
const NAME_KEY = 'phantom-rebound-runner-name';

const nameInputStart = document.getElementById('name-input-start');
const nameInputGo = document.getElementById('name-input-go');
const lbScreen = document.getElementById('s-lb');
const lbOpenBtn = document.getElementById('btn-lb-open');
const lbOpenBtnGo = document.getElementById('btn-lb-open-go');
const lbCloseBtn = document.getElementById('btn-lb-close');
const lbCurrent = document.getElementById('lb-current');
const lbStatus = document.getElementById('lb-status');
const lbList = document.getElementById('leaderboard-list');
const lbPeriodBtns = document.querySelectorAll('[data-lb-period]');
const lbScopeBtns = document.querySelectorAll('[data-lb-scope]');
const goBoonsBtn = document.getElementById('btn-go-boons');
const goBoonsPanel = document.getElementById('go-boons-panel');
const goBoonsList = document.getElementById('go-boons-list');
const goBoonsCloseBtn = document.getElementById('btn-go-boons-close');

function resize() {
  const w = Math.min(400, window.innerWidth * 0.95);
  cv.width  = Math.floor(w);
  cv.height = Math.floor(w * 1.18);
  cv.style.width = `${cv.width}px`;
  cv.style.height = `${cv.height}px`;
}
bindResponsiveViewport(resize);

// ── PLAYER UPGRADES ───────────────────────────────────────────────────────────
let UPG = getDefaultUpgrades();
function resetUpgrades() {
  UPG = getDefaultUpgrades();
}

function syncRunChargeCapacity() {
  syncChargeCapacity(UPG);
  charge = Math.min(charge, UPG.maxCharge);
}

function getEnemyGreyDropCount() {
  return getRequiredShotCount(UPG);
}

function renderGameOverBoons() {
  if(!goBoonsList) return;
  const entries = getActiveBoonEntries(UPG);
  goBoonsList.innerHTML = '';
  if(entries.length === 0) {
    goBoonsList.innerHTML = '<div class="up-active-empty">No boons collected this run.</div>';
    return;
  }
  for(const entry of entries) {
    const row = document.createElement('div');
    row.className = 'up-active-item';
    row.innerHTML = `<div class="up-active-icon">${entry.icon}</div><div class="up-active-copy"><div class="up-active-name">${entry.name}</div><div class="up-active-detail">${entry.detail}</div></div>`;
    goBoonsList.appendChild(row);
  }
}

function syncPlayerScale() {
  if(!player) return;
  player.r = 9 * (UPG.playerSizeMult || 1);
}

// ── STATE ─────────────────────────────────────────────────────────────────────
let gstate = 'start';
let player = {};
let bullets = [], enemies = [], particles = [];
let score=0, kills=0;
let charge=0, fireT=0, stillTimer=0, prevStill=false;
let hp=100, maxHp=100;
const joy = createJoystickState();
const GAME_OVER_ANIM_MS = 850;
const SHIELD_HALF_W = 9;
const SHIELD_HALF_H = 4.5;
const STALL_SPAWN_COOLDOWN_MS = 2600;
const SHIELD_ORBIT_R    = 35;   // orbital radius of shield orbs from player center (px)
const SHIELD_COOLDOWN   = 1.5;  // seconds a shield is inactive after absorbing a bullet
const SHIELD_ROTATION_SPD  = 0.001; // radians per millisecond (≈1 rev / 6.3 s)
const ORBIT_SPHERE_R    = 40;   // orbital radius of passive orbit spheres (px)
const ORBIT_ROTATION_SPD   = 0.003; // radians per millisecond (≈1 rev / 2.1 s)
const PLAYER_SHOT_LIFE_MS = 1100;
let enemyIdSeq = 1;
let playerName = 'RUNNER';
let leaderboard = [];
let lbPeriod = 'daily';
let lbScope = 'everyone';
let remoteLeaderboardRows = [];
let useRemoteLeaderboardRows = false;
let lbStatusMode = 'local';
let lbStatusText = 'LOCAL ONLY';
let lbRequestSeq = 0;
let raf=0, lastT=0;
let gameOverShown = false;
let boonRerolls = 1;
let damagelessRooms = 0;
let tookDamageThisRoom = false;
let lastStallSpawnAt = -99999;
let _barrierPulseTimer = 0;
let _slipCooldown = 0;
let _absorbComboCount = 0, _absorbComboTimer = 0;
let _chainMagnetTimer = 0;
let _echoCounter = 0;
let _vampiricRestoresThisRoom = 0;
let _orbFireTimers = [];
let _orbCooldown = [];
let boonHistory = [];
let pendingLegendary = null;
let legendaryOffered = false;

// Room system
let roomIndex = 0;
let roomPhase = 'intro';
let roomTimer = 0;
let spawnQueue = [];
let roomClearTimer = 0;
let roomPurpleShooterAssigned = false;
let roomIntroTimer = 0;
const ROOM_NAMES = ROOM_SCRIPTS.map((room) => room.name);

function getRoomDef(idx) {
  const name = idx < ROOM_NAMES.length
    ? ROOM_NAMES[idx]
    : ['FRENZY','OVERRUN','DELUGE','STORM','NIGHTMARE','ABYSS','INFERNO','CHAOS'][(idx - ROOM_NAMES.length) % 8];
  const chaos = Math.min(0.65, idx * 0.035);
  return { name, chaos, waves:[generateWeightedWave(idx)] };
}

function getUnlockedEnemyTypes(roomIdx) {
  return Object.entries(ENEMY_TYPES)
    .filter(([, def]) => roomIdx >= def.unlockRoom)
    .map(([type]) => type);
}

function weightedPick(candidates) {
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = Math.random() * total;
  for(const candidate of candidates) {
    roll -= candidate.weight;
    if(roll <= 0) return candidate.type;
  }
  return candidates[candidates.length - 1].type;
}

function generateWeightedWave(roomIdx) {
  const unlocked = getUnlockedEnemyTypes(roomIdx);
  const entries = new Map();
  const budgetBase = 5.0 + roomIdx * 1.35;
  let budget = budgetBase;
  let shooterCount = 0;

  if(roomIdx === 9) {
    entries.set('purple_chaser', 1);
    budget -= ENEMY_TYPES.purple_chaser.spawnValue;
    shooterCount += 1;
  }

  while(budget >= 2) {
    const candidates = unlocked
      .filter((type) => roomIdx > 9 || (type !== 'purple_chaser' && type !== 'purple_disruptor'))
      .filter((type) => type !== 'purple_disruptor' || roomIdx >= 11)
      .filter((type) => ENEMY_TYPES[type].spawnValue <= budget + 0.5)
      .filter((type) => {
        // Rooms 20-29: once a triangle is in the wave, reduce bullet pressure from other heavy shooters
        if(roomIdx >= 20 && roomIdx < 30 && entries.has('triangle')) {
          return !['zoner','purple_disruptor','purple_chaser','disruptor'].includes(type);
        }
        return true;
      })
      .map((type) => {
        const def = ENEMY_TYPES[type];
        const pressureBias = def.ammoPressure > 0 ? 0.9 : 0.75;
        const affordability = 1 / def.spawnValue;
        const roomBias = 1 + Math.min(1.2, Math.max(0, roomIdx - def.unlockRoom) * 0.08);
        return { type, weight: pressureBias * affordability * roomBias };
      });
    if(candidates.length === 0) break;
    const type = weightedPick(candidates);
    entries.set(type, (entries.get(type) || 0) + 1);
    budget -= ENEMY_TYPES[type].spawnValue;
    if(ENEMY_TYPES[type].ammoPressure > 0) shooterCount++;
  }

  if(shooterCount === 0) {
    entries.set('chaser', (entries.get('chaser') || 0) + 1);
  }

  return [...entries.entries()].map(([t, n]) => ({ t, n, d:0 }));
}

function buildSpawnQueue(roomDef) {
  const queue = [];
  for(const wave of roomDef.waves) {
    for(const entry of wave) {
      for(let i=0; i<entry.n; i++) {
        queue.push({ t: entry.t, spawnAt: 0 }); // all spawn immediately
      }
    }
  }
  return queue;
}

function startRoom(idx) {
  tookDamageThisRoom = false;
  _vampiricRestoresThisRoom = 0;
  _orbFireTimers = []; _orbCooldown = [];
  roomIndex = idx;
  roomPurpleShooterAssigned = false;
  const def = getRoomDef(idx);
  spawnQueue = buildSpawnQueue(def);
  roomTimer = 0;
  roomIntroTimer = 0;
  roomPhase = 'intro';
  enemies = [];
  bullets = [];
  player.x = cv.width / 2;
  player.y = cv.height / 2;
  player.vx = 0;
  player.vy = 0;
  showRoomIntro('READY?', false);
  updateRoomBadge(def);
}

function updateRoomBadge(def) {
  const el = document.getElementById('room-badge');
  el.textContent = `ROOM ${roomIndex+1} — ${def.name}`;
}

function spawnEnemy(type) {
  const enemy = createEnemy(type, {
    width: cv.width,
    height: cv.height,
    margin: M,
    roomIndex,
    nextEnemyId: enemyIdSeq++,
  });
  if(enemy.forcePurpleShots) roomPurpleShooterAssigned = true;
  enemies.push(enemy);
}

function pickFallbackShooterType() {
  if(roomIndex < 2) return 'chaser';
  if(roomIndex < 5) return Math.random() < 0.7 ? 'chaser' : 'sniper';
  const pool = ['chaser', 'sniper', 'disruptor', 'zoner'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function ensureShooterPressure() {
  const onlyDryEnemiesRemain = enemies.length > 0
    && bullets.length === 0
    && enemies.every((enemy) => enemy.isRusher || enemy.isSiphon);
  if(!onlyDryEnemiesRemain) return;
  if(roomTimer - lastStallSpawnAt < STALL_SPAWN_COOLDOWN_MS) return;
  spawnEnemy(pickFallbackShooterType());
  lastStallSpawnAt = roomTimer;
}

function circleIntersectsShieldPlate(cx, cy, radius, sx, sy, angle) {
  const dx = cx - sx;
  const dy = cy - sy;
  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);
  const lx = dx * cosA - dy * sinA;
  const ly = dx * sinA + dy * cosA;
  const nearestX = Math.max(-SHIELD_HALF_W, Math.min(SHIELD_HALF_W, lx));
  const nearestY = Math.max(-SHIELD_HALF_H, Math.min(SHIELD_HALF_H, ly));
  const hitDx = lx - nearestX;
  const hitDy = ly - nearestY;
  return hitDx * hitDx + hitDy * hitDy < radius * radius;
}

// Bullet speed scales with room — moderate at room 1, ramps up to full by room 10
function bulletSpeedScale() {
  return 0.68 + Math.min(roomIndex, 10) * 0.032;
}

function spawnEB(ex,ey) {
  const a=Math.atan2(player.y-ey,player.x-ex)+(Math.random()-.5)*.22;
  const spd=(145+Math.random()*40) * bulletSpeedScale();
  bullets.push({x:ex,y:ey,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,state:'danger',r:4.5,decayStart:null,bounces:0});
}

function spawnZB(ex,ey,idx,total) {
  const a=(Math.PI*2/total)*idx;
  const spd=125 * bulletSpeedScale();
  bullets.push({x:ex,y:ey,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,state:'danger',r:4.5,decayStart:null,bounces:0});
}

function spawnDBB(ex,ey) {
  const a=Math.atan2(player.y-ey,player.x-ex)+(Math.random()-.5)*.22;
  const spd=(145+Math.random()*40) * bulletSpeedScale();
  bullets.push({x:ex,y:ey,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,state:'danger',r:4.5,decayStart:null,bounces:0,doubleBounce:true,bounceCount:0});
}

function spawnTB(ex,ey) {
  const a=Math.atan2(player.y-ey,player.x-ex)+(Math.random()-.5)*.18;
  const spd=(145+Math.random()*40) * bulletSpeedScale();
  bullets.push({x:ex,y:ey,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,state:'danger',r:8,decayStart:null,bounces:0,isTriangle:true,wallBounces:0});
}

function spawnTriangleBurst(ex, ey, origVx, origVy) {
  const baseAngle = Math.atan2(origVy, origVx);
  const burstSpd = 140 * bulletSpeedScale();
  for(let i = 0; i < 3; i++) {
    const angle = baseAngle + (i - 1) * (Math.PI * 2 / 3);
    bullets.push({x:ex,y:ey,vx:Math.cos(angle)*burstSpd,vy:Math.sin(angle)*burstSpd,state:'danger',r:7,decayStart:null,bounces:0});
  }
  sparks(ex, ey, '#60a5fa', 6, 50);
}

function createLaneOffsets(count, spacing) {
  return Array.from({ length: count }, (_, idx) => (idx - (count - 1) / 2) * spacing);
}

function drawGooBall(x, y, radius, fillColor, coreColor, wobbleSeed, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const angle = (Math.PI * 2 / 8) * i;
    const wobble = 0.86 + 0.22 * Math.sin(wobbleSeed + i * 1.37);
    const px = x + Math.cos(angle) * radius * wobble;
    const py = y + Math.sin(angle) * radius * wobble;
    if(i===0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.arc(x + Math.sin(wobbleSeed) * radius * 0.08, y + Math.cos(wobbleSeed * 1.2) * radius * 0.08, radius * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function firePlayer(tx,ty) {
  if(charge < 1) return;
  const base=Math.atan2(ty-player.y,tx-player.x);
  const angs=[];
  const forwardOffsets = createLaneOffsets(1 + UPG.forwardShotTier, 7 * Math.min(1.6, UPG.shotSize));

  for(const laneOffset of forwardOffsets) angs.push({ angle: base, offset: laneOffset });
  if(UPG.spreadTier>=1){
    angs.push({ angle: base-0.28, offset: 0 }, { angle: base+0.28, offset: 0 });
  }
  if(UPG.spreadTier>=2){
    angs.push({ angle: base-0.45, offset: 0 }, { angle: base-0.22, offset: 0 }, { angle: base+0.22, offset: 0 }, { angle: base+0.45, offset: 0 });
  }
  if(UPG.dualShot>0){
    angs.push({ angle: base + Math.PI, offset: 0 });
  }
  if(UPG.ringShots>0){
    for(let i=0;i<UPG.ringShots;i++){
      angs.push({ angle: (Math.PI*2/UPG.ringShots)*i, offset: 0, coronaHoming: !!UPG.corona });
    }
  }

  const availableShots = Math.min(Math.floor(charge), angs.length);
  if(availableShots <= 0) return;

  const snipeScale = 1 + UPG.snipePower * 0.18;
  const bspd = 230 * Math.min(2.0, UPG.shotSpd) * snipeScale;
  const baseRadius = 4.5 * Math.min(2.5, UPG.shotSize) * (1 + UPG.snipePower * 0.15);
  const baseDmg = (1 + UPG.snipePower * 0.35) * (UPG.playerDamageMult || 1) * (UPG.denseDamageMult || 1);
  const lifeMs = PLAYER_SHOT_LIFE_MS * (UPG.shotLifeMult || 1);
  const now = performance.now();
  const overchargeBonus = (UPG.overchargeVent && charge >= UPG.maxCharge) ? 1.4 : 1;

  for(const shot of angs.slice(0, availableShots)) {
    const a = shot.angle;
    const sideX = Math.cos(a + Math.PI / 2) * shot.offset;
    const sideY = Math.sin(a + Math.PI / 2) * shot.offset;
    const crit = Math.random()<UPG.critChance;
    bullets.push({
      x:player.x + sideX, y:player.y + sideY,
      vx:Math.cos(a)*bspd,
      vy:Math.sin(a)*bspd,
      state:'output', r:crit ? baseRadius * 1.28 : baseRadius, decayStart:null,
      bounceLeft: UPG.bounceTier>0?2:0,
      pierceLeft: UPG.pierceTier,
      homing: UPG.homingTier>0 || (shot.coronaHoming||false),
      crit,
      dmg: baseDmg * overchargeBonus,
      expireAt: now + lifeMs,
      hitIds: new Set(),
    });
  }
  charge=Math.max(0,charge-availableShots);
  sparks(player.x,player.y,C.green,4 + Math.min(4, availableShots),55);
  if(UPG.echoFire){
    _echoCounter++;
    if(_echoCounter>=5){
      _echoCounter=0;
      const eNow=performance.now();
      for(const shot of angs.slice(0,availableShots)){
        const a=shot.angle;
        const sideX=Math.cos(a+Math.PI/2)*shot.offset;
        const sideY=Math.sin(a+Math.PI/2)*shot.offset;
        bullets.push({x:player.x+sideX,y:player.y+sideY,vx:Math.cos(a)*bspd,vy:Math.sin(a)*bspd,state:'output',r:baseRadius,decayStart:null,bounceLeft:UPG.bounceTier>0?2:0,pierceLeft:UPG.pierceTier,homing:UPG.homingTier>0,crit:false,dmg:baseDmg,expireAt:eNow+lifeMs,hitIds:new Set()});
      }
    }
  }
}

function sparks(x,y,col,n=6,spd=80) {
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,s=spd*(.4+Math.random()*.6);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,col,life:1,decay:1.6+Math.random()});
  }
}

function spawnGreyDrops(x,y,ts,count=getEnemyGreyDropCount()) {
  const dropCount = Math.max(1, Math.floor(count));
  for(let i=0;i<dropCount;i++){
    const a=Math.random()*Math.PI*2,s=50+Math.random()*55;
    bullets.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,state:'grey',r:4.5,decayStart:ts,bounces:0});
  }
}
function burstBlueDissipate(x, y) {
  for(let i=0;i<12;i++){
    const a = Math.random() * Math.PI * 2;
    const s = 45 + Math.random() * 70;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      col: `rgba(96,165,250,${0.35 + Math.random() * 0.4})`,
      life: 0.9 + Math.random() * 0.35,
      decay: 2.2 + Math.random() * 0.9,
      grow: 0.8 + Math.random() * 1.2,
    });
  }
}

function showUpgrades() {
  gstate='upgrade'; cancelAnimationFrame(raf);
  showBoonSelection({
    upg: UPG,
    hp,
    maxHp,
    rerolls: boonRerolls,
    onReroll: () => { boonRerolls--; },
    pendingLegendary: (!legendaryOffered && pendingLegendary) ? pendingLegendary : null,
    onLegendaryAccept: (leg) => {
      const lState={hp,maxHp}; leg.apply(UPG,lState); hp=lState.hp; maxHp=lState.maxHp;
      legendaryOffered=true; pendingLegendary=null;
      syncRunChargeCapacity(); boonHistory.push(leg.name);
      document.getElementById('s-up').classList.add('off');
      startRoom(roomIndex+1);
      gstate='playing'; lastT=performance.now(); raf=requestAnimationFrame(loop);
    },
    onSelect: (boon) => {
      const state = { hp, maxHp };
      const evolvedBoon = getEvolvedBoon(boon, UPG);
      evolvedBoon.apply(UPG, state);
      syncRunChargeCapacity();
      hp = state.hp;
      maxHp = state.maxHp;
      syncPlayerScale();
      boonHistory.push(evolvedBoon.name);
      if(!legendaryOffered){
        const leg = checkLegendarySequences(boonHistory, UPG);
        if(leg) pendingLegendary=leg;
      }
      document.getElementById('s-up').classList.add('off');
      startRoom(roomIndex+1);
      gstate='playing'; lastT=performance.now();
      raf=requestAnimationFrame(loop);
    },
  });
}

function sanitizeName(v) {
  const cleaned = (v || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim();
  return cleaned.slice(0, 14);
}

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LB_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if(Array.isArray(parsed)) {
      leaderboard = parsed
        .filter((x)=>x && typeof x.name==='string' && Number.isFinite(x.score) && Number.isFinite(x.ts) && x.version === VERSION.num)
        .slice(0, 500);
      leaderboard.sort((a,b)=>b.score-a.score || b.ts-a.ts);
    }
  } catch {
    leaderboard = [];
  }
}

function loadSavedPlayerName() {
  try {
    return sanitizeName(localStorage.getItem(NAME_KEY) || '');
  } catch {
    return '';
  }
}

function saveLeaderboard() {
  localStorage.setItem(LB_KEY, JSON.stringify(leaderboard.slice(0, 500)));
}

function isSameLocalDay(ts, nowTs = Date.now()) {
  const a = new Date(ts);
  const b = new Date(nowTs);
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function getVisibleLeaderboardRows() {
  let rows = leaderboard.slice();
  if(lbPeriod === 'daily') rows = rows.filter((row)=>isSameLocalDay(row.ts));
  if(lbScope === 'personal') rows = rows.filter((row)=>row.name === playerName);
  rows.sort((a,b)=>b.score-a.score || b.ts-a.ts);
  return rows.slice(0, 10);
}

function setLeaderboardStatus(mode, text) {
  lbStatusMode = mode;
  lbStatusText = text;
  lbStatus.textContent = text;
  lbStatus.classList.remove('syncing', 'synced', 'local', 'error');
  lbStatus.classList.add(mode);
}

function updateLeaderboardToggleStates() {
  lbPeriodBtns.forEach((btn)=>btn.classList.toggle('active', btn.dataset.lbPeriod === lbPeriod));
  lbScopeBtns.forEach((btn)=>btn.classList.toggle('active', btn.dataset.lbScope === lbScope));
}

function renderLeaderboard() {
  const periodLabel = lbPeriod === 'daily' ? 'DAILY' : 'ALL TIME';
  const scopeLabel = lbScope === 'personal' ? 'PERSONAL' : 'EVERYONE';
  lbCurrent.textContent = `RUNNER: ${playerName} · ${periodLabel} · ${scopeLabel}`;
  lbStatus.textContent = lbStatusText;
  lbList.innerHTML = '';
  const rows = lbStatusMode === 'syncing'
    ? []
    : (useRemoteLeaderboardRows ? remoteLeaderboardRows : getVisibleLeaderboardRows());
  if(rows.length===0){
    const li = document.createElement('li');
    li.className = 'lb-empty';
    li.textContent = lbStatusMode === 'syncing' ? 'Syncing records...' : 'No runs match this view yet.';
    lbList.appendChild(li);
    updateLeaderboardToggleStates();
    return;
  }
  for(let i=0;i<rows.length;i++){
    const row = rows[i];
    const li = document.createElement('li');
    const hasBoons = Array.isArray(row.boons) && row.boons.length > 0;
    li.innerHTML = `
      <span class="lb-rank">#${i + 1}</span>
      <span class="lb-name">${row.name} · R${row.room}</span>
      <span class="lb-score">${row.score}</span>
      ${hasBoons ? '<button class="lb-boons-btn" type="button" title="View run loadout">📋</button>' : '<span></span>'}
    `;
    if(hasBoons) {
      li.querySelector('.lb-boons-btn').addEventListener('click', () => showLbBoonsPopup(row.name, row.boons));
    }
    lbList.appendChild(li);
  }
  updateLeaderboardToggleStates();
}

async function refreshLeaderboardView() {
  const requestId = ++lbRequestSeq;
  remoteLeaderboardRows = [];
  useRemoteLeaderboardRows = false;
  setLeaderboardStatus('syncing', 'SYNCING');
  renderLeaderboard();
  try {
    const rows = await fetchRemoteLeaderboard({
      period: lbPeriod,
      scope: lbScope,
      playerName,
      gameVersion: VERSION.num,
      limit: 10,
    });
    if(requestId !== lbRequestSeq) return;
    remoteLeaderboardRows = rows;
    useRemoteLeaderboardRows = true;
    setLeaderboardStatus('synced', 'SUPABASE LIVE');
  } catch (error) {
    if(requestId !== lbRequestSeq) return;
    remoteLeaderboardRows = [];
    useRemoteLeaderboardRows = false;
    setLeaderboardStatus('local', 'LOCAL FALLBACK');
  }
  renderLeaderboard();
}

function pushLeaderboardEntry() {
  const boons = getActiveBoonEntries(UPG);
  const entry = {
    name: playerName,
    score,
    room: roomIndex + 1,
    ts: Date.now(),
    version: VERSION.num,
    boons,
  };
  leaderboard.push(entry);
  leaderboard.sort((a,b)=>b.score-a.score || b.ts-a.ts);
  leaderboard = leaderboard.slice(0, 500);
  saveLeaderboard();
  submitRemoteScore({
    playerName: entry.name,
    score: entry.score,
    room: entry.room,
    gameVersion: VERSION.num,
    boons,
  }).then(() => {
    if(lbScope !== 'personal' || playerName === entry.name) {
      refreshLeaderboardView();
    }
  }).catch(() => {
    useRemoteLeaderboardRows = false;
    setLeaderboardStatus('local', 'LOCAL FALLBACK');
    renderLeaderboard();
  });
  renderLeaderboard();
}

function gameOver(){
  if(gameOverShown) return;
  gameOverShown = true;
  gstate='dying';
  player.deadAt = performance.now();
  player.popAt = player.deadAt + GAME_OVER_ANIM_MS * 0.72;
  player.deadPulse = 0;
  player.deadPop = false;
  pushLeaderboardEntry();
}

function init() {
  score=0; kills=0;
  charge=0; fireT=0; stillTimer=0; prevStill=false; hp=120; maxHp=120;
  gameOverShown = false;
  boonRerolls = 1;
  damagelessRooms = 0;
  tookDamageThisRoom = false;
  lastStallSpawnAt = -99999;
  enemyIdSeq = 1;
  player={x:cv.width/2,y:cv.height/2,r:9,vx:0,vy:0,invincible:0,distort:0,deadAt:0,popAt:0,deadPop:false,deadPulse:0};
  player.shields=[];
  _barrierPulseTimer=0;
  _slipCooldown=0; _absorbComboCount=0; _absorbComboTimer=0;
  _chainMagnetTimer=0; _echoCounter=0; _vampiricRestoresThisRoom=0;
  _orbFireTimers=[]; _orbCooldown=[];
  boonHistory=[]; pendingLegendary=null; legendaryOffered=false;
  bullets=[];enemies=[];particles=[];
  resetJoystickState(joy);
  resetUpgrades();
  syncRunChargeCapacity();
  syncPlayerScale();
  startRoom(0);
  hudUpdate();
}

// ── MAIN LOOP ─────────────────────────────────────────────────────────────────
function loop(ts){
  if(gstate!=='playing' && gstate!=='dying') return;
  const dt=Math.min((ts-lastT)/1000,.05); lastT=ts;
  update(dt,ts); draw(ts); hudUpdate();
  raf=requestAnimationFrame(loop);
}

// ── UPDATE ────────────────────────────────────────────────────────────────────
function update(dt,ts){
  if(gstate === 'dying'){
    if(!player.deadPop && ts >= player.popAt){
      player.deadPop = true;
      sparks(player.x, player.y, '#f8b4c7', 10, 85);
      burstBlueDissipate(player.x, player.y);
    }
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      p.vx*=Math.pow(.84,dt*60);p.vy*=Math.pow(.84,dt*60);
      p.life-=p.decay*dt;
      if(p.life<=0)particles.splice(i,1);
    }
    if(ts - player.deadAt >= GAME_OVER_ANIM_MS){
      gstate='gameover';
      cancelAnimationFrame(raf);
      document.getElementById('go-score').textContent=score;
      document.getElementById('go-note').textContent=`Room ${roomIndex+1} · ${kills} enemies eliminated`;
      if(goBoonsPanel) goBoonsPanel.classList.add('off');
      renderGameOverBoons();
      document.getElementById('s-go').classList.remove('off');
    }
    return;
  }

  const W=cv.width,H=cv.height;
  const BASE_SPD=165*Math.min(2.5,(UPG.speedMult || 1) * (UPG.titanSlowMult || 1));
  const joyMax = joy.max || JOY_MAX;

  // Drift anchor when thumb wanders far past max radius
  if(roomPhase === 'fighting' || roomPhase === 'spawning') tickJoystick(joy, dt);

  // ── Player movement — virtual joystick
  if(roomPhase !== 'intro' && joy.active && joy.mag > JOY_DEADZONE){
    const t = Math.min((joy.mag - JOY_DEADZONE) / (joyMax - JOY_DEADZONE), 1);
    player.vx = joy.dx * BASE_SPD * t;
    player.vy = joy.dy * BASE_SPD * t;
  } else {
    player.vx = 0;
    player.vy = 0;
  }
  player.x=Math.max(M+player.r,Math.min(W-M-player.r,player.x+player.vx*dt));
  player.y=Math.max(M+player.r,Math.min(H-M-player.r,player.y+player.vy*dt));
  if(player.invincible>0)player.invincible-=dt;
  if(player.distort>0)player.distort-=dt;

  // ── Shields — sync count to tier, tick cooldowns
  while(player.shields.length < UPG.shieldTier) player.shields.push({cooldown:0, hardened: !!UPG.shieldTempered, mirrorCooldown:-9999});
  for(const s of player.shields){
    if(s.cooldown>0){
      const prev=s.cooldown;
      s.cooldown=Math.max(0,s.cooldown-dt);
      if(prev>0 && s.cooldown<=0 && UPG.shieldTempered) s.hardened=true;
    }
  }
  if(_barrierPulseTimer>0) _barrierPulseTimer-=dt*1000;
  if(_absorbComboTimer>0){ _absorbComboTimer-=dt*1000; if(_absorbComboTimer<=0){_absorbComboCount=0;} }
  if(_chainMagnetTimer>0) _chainMagnetTimer-=dt*1000;
  if(_slipCooldown>0) _slipCooldown-=dt*1000;
  if(UPG.colossus) hp=Math.min(maxHp, hp+dt);
  // Volatile Orb cooldowns — recharge after 8s
  for(let si=0;si<_orbCooldown.length;si++){
    if(_orbCooldown[si]>0) _orbCooldown[si]=Math.max(0,_orbCooldown[si]-dt);
  }

  // ── Room state machine
  roomTimer += dt*1000;

  if(roomPhase==='intro'){
    roomIntroTimer += dt * 1000;
    if(roomIntroTimer >= 1000 && roomIntroTimer < 1600){
      showRoomIntro('GO!', true);
    } else if(roomIntroTimer >= 1600){
      hideRoomIntro();
      roomPhase = 'spawning';
    }
  }

  if(roomPhase==='spawning'){
    // Drain spawn queue
    while(spawnQueue.length && spawnQueue[0].spawnAt <= roomTimer){
      spawnEnemy(spawnQueue.shift().t);
    }
    if(spawnQueue.length===0) roomPhase='fighting';
  }

  if(roomPhase==='fighting' || roomPhase==='spawning'){
    if(enemies.length===0 && spawnQueue.length===0){
      roomPhase='clear';
      roomClearTimer=0;
      // Clear all projectiles immediately
      bullets=[]; particles=[];
      // Room clear regen
      if(UPG.regenTick>0) hp=Math.min(maxHp, hp+UPG.regenTick);
      // Damageless streak → earn reroll (cap 3)
      if(!tookDamageThisRoom){
        damagelessRooms++;
        if(damagelessRooms >= 3){
          boonRerolls = Math.min(3, boonRerolls + 1);
          damagelessRooms = 0;
        }
      } else {
        damagelessRooms = 0;
      }
      showRoomClear();
    }
  }

  if(roomPhase==='fighting' || roomPhase==='spawning'){
    ensureShooterPressure();
  }

  if(roomPhase==='clear'){
    roomClearTimer+=dt*1000;
    if(roomClearTimer>1000){
      roomPhase='reward';
      showUpgrades();
    }
  }

  // 'reward' and 'between' phases are handled by showUpgrades / card click callbacks

  // ── Auto-fire: only while still, and always gated by SPS interval
  const isStill = !joy.active || joy.mag <= JOY_DEADZONE;

  if(!isStill){
    stillTimer = 0;
    if(UPG.moveChargeRate > 0 && (roomPhase === 'spawning' || roomPhase === 'fighting')){
      charge = Math.min(UPG.maxCharge, charge + UPG.moveChargeRate * UPG.maxCharge * dt);
    }
  } else {
    stillTimer += dt;
  }

  if(charge >= 1 && isStill){
    fireT += dt;
    const interval = 1 / (UPG.sps * 2);
    if(fireT >= interval){
      fireT = fireT % interval;
      const tgt=enemies.reduce((b,e)=>{const d=Math.hypot(e.x-player.x,e.y-player.y);return(!b||d<b.d)?{e,d}:b;},null);
      if(tgt) firePlayer(tgt.e.x,tgt.e.y);
    }
  }

  prevStill = isStill;

  // ── Enemies
  const WINDUP_MS = 520; // tell duration before firing
  for(let ei=enemies.length-1;ei>=0;ei--){
    const e=enemies[ei];
    if(e.isSiphon){
      e.x+=Math.sin(ts*.0009+e.y)*22*dt;
      e.y+=Math.cos(ts*.0011+e.x)*22*dt;
      e.x=Math.max(M+e.r,Math.min(W-M-e.r,e.x));
      e.y=Math.max(M+e.r,Math.min(H-M-e.r,e.y));
      if(Math.hypot(e.x-player.x,e.y-player.y)<72){charge=Math.max(0,charge-2.8*dt);sparks(player.x,player.y,C.siphon,1,35);}
    } else if(e.isRusher){
      const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy);
      if(d>e.r){
        e.x+=dx/d*e.spd*dt;
        e.y+=dy/d*e.spd*dt;
      }
      e.x=Math.max(M+e.r,Math.min(W-M-e.r,e.x));
      e.y=Math.max(M+e.r,Math.min(H-M-e.r,e.y));
      if(d<player.r+e.r+2 && player.invincible<=0){
        hp-=18; player.invincible=1.0; player.distort=.4;
        sparks(player.x,player.y,'#f472b6',10,90);
        if(hp<=0){
          if(UPG.lifeline && UPG.lifelineTriggerCount < (UPG.lifelineUses||1)){
            UPG.lifelineTriggerCount++; UPG.lifelineUsed=true; hp=1; player.invincible=2.0; sparks(player.x,player.y,'#f0abfc',16,100);
            if(UPG.lastStand){ const lsNow=performance.now(); for(let la=0;la<Math.floor(UPG.maxCharge);la++){ const lang=(Math.PI*2/Math.max(1,Math.floor(UPG.maxCharge)))*la; bullets.push({x:player.x,y:player.y,vx:Math.cos(lang)*220,vy:Math.sin(lang)*220,state:'output',r:4.5,decayStart:null,bounceLeft:UPG.bounceTier>0?2:0,pierceLeft:UPG.pierceTier,homing:false,crit:false,dmg:(UPG.playerDamageMult||1)*(UPG.denseDamageMult||1),expireAt:lsNow+2000,hitIds:new Set()}); } }
          }
          else { gameOver(); return; }
        }
      }
    } else {
      const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy);
      const fleeRange = e.fleeRange || 110;
      const spd = e.spd;

      // Advance fire timer
      e.fT += dt*1000;
      const inWindup = e.fT >= e.fRate - WINDUP_MS;

      if(!inWindup){
        // Normal flee/orbit movement
        if(d < fleeRange){
          const nx=dx/d, ny=dy/d;
          const strafeDir = (Math.sin(ts*0.0008 + ei*1.3) > 0) ? 1 : -1;
          e.x -= nx*spd*dt + (-ny)*spd*(e.strafeSpd||0.6)*strafeDir*dt;
          e.y -= ny*spd*dt + (nx)*spd*(e.strafeSpd||0.6)*strafeDir*dt;
        } else if(d > fleeRange*1.6){
          e.x += dx/d*spd*0.25*dt;
          e.y += dy/d*spd*0.25*dt;
        } else {
          const strafeDir = (Math.sin(ts*0.0007 + ei*2.1) > 0) ? 1 : -1;
          e.x += (-dy/d)*spd*(e.strafeSpd||0.6)*strafeDir*dt;
          e.y += (dx/d)*spd*(e.strafeSpd||0.6)*strafeDir*dt;
        }
        e.x=Math.max(M+e.r,Math.min(W-M-e.r,e.x));
        e.y=Math.max(M+e.r,Math.min(H-M-e.r,e.y));
      }
      // else: frozen during windup — no position update

      // Fire when timer expires
      if(e.fT >= e.fRate){
        e.fT = 0;
        if(e.type==='zoner'){
          for(let i=0;i<e.burst;i++) spawnZB(e.x,e.y,i,e.burst);
        } else if(e.type==='triangle'){
          for(let i=0;i<e.burst;i++) spawnTB(e.x,e.y);
        } else {
          const canShootPurple = canEnemyUsePurpleShots(e, roomIndex);
          for(let i=0;i<e.burst;i++){
            if(canShootPurple) spawnDBB(e.x,e.y);
            else spawnEB(e.x,e.y);
          }
        }
      }
    }

    if(UPG.orbitSphereTier > 0){
      // Sync arrays
      while(_orbFireTimers.length < UPG.orbitSphereTier) _orbFireTimers.push(0);
      while(_orbCooldown.length < UPG.orbitSphereTier) _orbCooldown.push(0);
      if(!e.orbitHitAt) e.orbitHitAt = {};
      for(let si=0;si<UPG.orbitSphereTier;si++){
        if(_orbCooldown[si]>0) continue;
        const sAngle=Math.PI*2/UPG.orbitSphereTier*si+ts*ORBIT_ROTATION_SPD;
        const sx=player.x+Math.cos(sAngle)*ORBIT_SPHERE_R;
        const sy=player.y+Math.sin(sAngle)*ORBIT_SPHERE_R;
        const lastHitAt = e.orbitHitAt[si] || -99999;
        if(ts - lastHitAt < 220) continue;
        if(Math.hypot(e.x-sx,e.y-sy) < e.r + 6){
          e.orbitHitAt[si] = ts;
          e.hp -= 1;
          sparks(sx,sy,C.green,4,45);
          if(e.hp<=0){
            score+=e.pts;kills++;
            sparks(e.x,e.y,e.col,14,95);
            spawnGreyDrops(e.x,e.y,ts);
            enemies.splice(ei,1);
            break;
          }
        }
      }
    }
  }

  // ── Charged Orbs: each alive orb fires at nearest enemy every 1.2s
  if(UPG.chargedOrbs && UPG.orbitSphereTier>0 && enemies.length>0){
    while(_orbFireTimers.length < UPG.orbitSphereTier) _orbFireTimers.push(0);
    for(let si=0;si<UPG.orbitSphereTier;si++){
      if(_orbCooldown[si]>0) continue;
      _orbFireTimers[si]=((_orbFireTimers[si]||0)+dt*1000);
      if(_orbFireTimers[si]>=1200){
        _orbFireTimers[si]=0;
        const sAngle=Math.PI*2/UPG.orbitSphereTier*si+ts*ORBIT_ROTATION_SPD;
        const ox=player.x+Math.cos(sAngle)*ORBIT_SPHERE_R;
        const oy=player.y+Math.sin(sAngle)*ORBIT_SPHERE_R;
        const tgt=enemies.reduce((b,e)=>{const d=Math.hypot(e.x-ox,e.y-oy);return(!b||d<b.d)?{e,d}:b;},null);
        if(tgt){
          const ang=Math.atan2(tgt.e.y-oy,tgt.e.x-ox);
          const oNow=performance.now();
          bullets.push({x:ox,y:oy,vx:Math.cos(ang)*200,vy:Math.sin(ang)*200,state:'output',r:3.5,decayStart:null,bounceLeft:0,pierceLeft:0,homing:false,crit:false,dmg:1,expireAt:oNow+1200,hitIds:new Set()});
        }
      }
    }
  }

  // ── Bullets
  const absorbR = player.r + 5 + UPG.absorbRange + (_barrierPulseTimer > 0 ? UPG.absorbRange + 40 : 0) + (_chainMagnetTimer > 0 ? UPG.absorbRange + 30 : 0);
  const decayMS = DECAY_BASE + UPG.decayBonus;

  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];

    if(b.state==='output' && b.expireAt && ts>=b.expireAt){bullets.splice(i,1);continue;}

    // Homing for output bullets
    if(b.state==='output'&&b.homing&&enemies.length>0){
      const tgt=enemies.reduce((bst,e)=>{const d=Math.hypot(e.x-b.x,e.y-b.y);return(!bst||d<bst.d)?{e,d}:bst;},null);
      if(tgt){
        const dx=tgt.e.x-b.x,dy=tgt.e.y-b.y,d=Math.hypot(dx,dy);
        b.vx+=(dx/d)*400*dt; b.vy+=(dy/d)*400*dt;
        const sp=Math.hypot(b.vx,b.vy);
        const maxSp=230*Math.min(2.0,UPG.shotSpd)*1.2;
        if(sp>maxSp){b.vx=b.vx/sp*maxSp;b.vy=b.vy/sp*maxSp;}
      }
    }

    if(UPG.gravityWell && b.state==='danger'){
      const gdist=Math.hypot(b.x-player.x,b.y-player.y);
      if(gdist<80){
        const drag=Math.pow(0.55,dt);
        b.vx*=drag; b.vy*=drag;
        // Floor: never fully stop a danger bullet
        const spd=Math.hypot(b.vx,b.vy);
        if(spd<40){const s=40/spd;b.vx*=s;b.vy*=s;}
      }
    }

    b.x+=b.vx*dt; b.y+=b.vy*dt;
    let bounced=false;
    if(b.x-b.r<M){b.x=M+b.r;b.vx=Math.abs(b.vx);bounced=true;}
    if(b.x+b.r>W-M){b.x=W-M-b.r;b.vx=-Math.abs(b.vx);bounced=true;}
    if(b.y-b.r<M){b.y=M+b.r;b.vy=Math.abs(b.vy);bounced=true;}
    if(b.y+b.r>H-M){b.y=H-M-b.r;b.vy=-Math.abs(b.vy);bounced=true;}

    if(bounced){
      if(b.state==='danger'){
        burstBlueDissipate(b.x, b.y);
        if(b.isTriangle){
          b.wallBounces++;
          if(b.wallBounces>=1){
            spawnTriangleBurst(b.x, b.y, b.vx, b.vy);
            bullets.splice(i,1);continue;
          }
        } else if(b.doubleBounce){
          b.bounceCount++;
          if(b.bounceCount>=2){b.state='grey';b.decayStart=ts;sparks(b.x,b.y,C.grey,4,35);}
        } else {
          b.state='grey';b.decayStart=ts;
          sparks(b.x,b.y,C.grey,4,35);
        }
      } else if(b.state==='output'){
        if(b.bounceLeft>0){
          b.bounceLeft--;
          if(UPG.splitShot && !b.hasSplit){
            b.hasSplit=true;
            const splitNow=performance.now();
            for(const delta of [-0.35,0.35]){
              const sa=Math.atan2(b.vy,b.vx)+delta;
              const sp=Math.hypot(b.vx,b.vy);
              bullets.push({x:b.x,y:b.y,vx:Math.cos(sa)*sp,vy:Math.sin(sa)*sp,state:'output',r:b.r*0.8,decayStart:null,bounceLeft:0,pierceLeft:b.pierceLeft,homing:b.homing,crit:b.crit,dmg:b.dmg*0.7,expireAt:splitNow+2000,hitIds:new Set(),hasSplit:true});
            }
          }
        } else { bullets.splice(i,1); continue; }
      }
    }

    if(b.state==='grey'){
      if(ts-b.decayStart>decayMS){bullets.splice(i,1);continue;}
      b.vx*=Math.pow(.97,dt*60); b.vy*=Math.pow(.97,dt*60);
      const ghostFlowR = (UPG.ghostFlow && (Math.abs(player.vx)>5 || Math.abs(player.vy)>5)) ? player.r + b.r + 8 : -1;
      if(Math.hypot(b.x-player.x,b.y-player.y)<absorbR+b.r || (ghostFlowR>0 && Math.hypot(b.x-player.x,b.y-player.y)<ghostFlowR)){
        charge=Math.min(UPG.maxCharge,charge+UPG.absorbValue);
        // Resonant Absorb
        if(UPG.resonantAbsorb){
          _absorbComboTimer=1500;
          _absorbComboCount++;
          if(_absorbComboCount>=3){
            charge=Math.min(UPG.maxCharge, charge + UPG.absorbValue * 0.5);
            _absorbComboCount=0;
          }
        }
        // Chain Magnet
        if(UPG.chainMagnetTier>0){
          _chainMagnetTimer=500+(UPG.chainMagnetTier-1)*250;
        }
        sparks(b.x,b.y,C.ghost,5,45);
        bullets.splice(i,1);continue;
      }
      // Absorb Orbs: grey bullets near any alive orbit sphere are absorbed
      if(UPG.absorbOrbs && UPG.orbitSphereTier>0){
        while(_orbCooldown.length < UPG.orbitSphereTier) _orbCooldown.push(0);
        let absorbed=false;
        for(let si=0;si<UPG.orbitSphereTier;si++){
          if(_orbCooldown[si]>0) continue;
          const sAngle=Math.PI*2/UPG.orbitSphereTier*si+ts*ORBIT_ROTATION_SPD;
          const sx=player.x+Math.cos(sAngle)*ORBIT_SPHERE_R;
          const sy=player.y+Math.sin(sAngle)*ORBIT_SPHERE_R;
          if(Math.hypot(b.x-sx,b.y-sy)<b.r+12){
            charge=Math.min(UPG.maxCharge,charge+UPG.absorbValue);
            sparks(sx,sy,C.ghost,4,40);
            bullets.splice(i,1); absorbed=true; break;
          }
        }
        if(absorbed) continue;
      }
    }

    // Volatile Orbs: a danger bullet near any alive orbit sphere destroys the sphere + bullet
    if(b.state==='danger' && UPG.volatileOrbs && UPG.orbitSphereTier>0){
      while(_orbCooldown.length < UPG.orbitSphereTier) _orbCooldown.push(0);
      let orbHit=false;
      for(let si=0;si<UPG.orbitSphereTier;si++){
        if(_orbCooldown[si]>0) continue;
        const sAngle=Math.PI*2/UPG.orbitSphereTier*si+ts*ORBIT_ROTATION_SPD;
        const sx=player.x+Math.cos(sAngle)*ORBIT_SPHERE_R;
        const sy=player.y+Math.sin(sAngle)*ORBIT_SPHERE_R;
        if(Math.hypot(b.x-sx,b.y-sy)<b.r+7){
          _orbCooldown[si]=8;
          sparks(sx,sy,C.green,10,80);
          bullets.splice(i,1); orbHit=true; break;
        }
      }
      if(orbHit) continue;
    }

    if(b.state==='danger' && player.shields.length>0){
      const total=player.shields.length;
      // Quick proximity guard: bullet must be near the orbital ring
      if(Math.hypot(b.x-player.x,b.y-player.y)<SHIELD_ORBIT_R+8+b.r){
        let shieldHit=false;
        for(let si=0;si<total;si++){
          const s=player.shields[si];
          if(s.cooldown>0) continue;
          const sAngle=Math.PI*2/total*si+ts*SHIELD_ROTATION_SPD;
          const sx=player.x+Math.cos(sAngle)*SHIELD_ORBIT_R;
          const sy=player.y+Math.sin(sAngle)*SHIELD_ORBIT_R;
          const shieldFacing = sAngle + Math.PI * 0.5;
          if(circleIntersectsShieldPlate(b.x, b.y, b.r, sx, sy, shieldFacing)){
            // Mirror Shield: reflect bullet back as output
            if(UPG.shieldMirror && (ts - (s.mirrorCooldown||0)) > 300){
              s.mirrorCooldown = ts;
              const mNow = performance.now();
              bullets.push({x:sx,y:sy,vx:b.vx,vy:b.vy,state:'output',r:4.5*Math.min(2.5,UPG.shotSize),decayStart:null,bounceLeft:UPG.bounceTier>0?2:0,pierceLeft:UPG.pierceTier,homing:UPG.homingTier>0,crit:false,dmg:(UPG.playerDamageMult||1)*(UPG.denseDamageMult||1),expireAt:mNow+PLAYER_SHOT_LIFE_MS*(UPG.shotLifeMult||1),hitIds:new Set()});
            }
            // Tempered Shield: two-stage (purple -> blue -> pop)
            if(UPG.shieldTempered && s.hardened){
              s.hardened=false;
              sparks(sx,sy,'#c084fc',8,60);
              bullets.splice(i,1); shieldHit=true; break;
            }
            // Shield pops — Shield Burst fires 4-way output
            if(UPG.shieldBurst){
              const bNow=performance.now();
              for(let ba=0;ba<4;ba++){
                const bang=ba*Math.PI/2;
                bullets.push({x:player.x,y:player.y,vx:Math.cos(bang)*230,vy:Math.sin(bang)*230,state:'output',r:4.5*Math.min(2.5,UPG.shotSize),decayStart:null,bounceLeft:UPG.bounceTier>0?2:0,pierceLeft:UPG.pierceTier,homing:UPG.homingTier>0,crit:false,dmg:(UPG.playerDamageMult||1)*(UPG.denseDamageMult||1),expireAt:bNow+PLAYER_SHOT_LIFE_MS*(UPG.shotLifeMult||1),hitIds:new Set()});
              }
            }
            // Barrier Pulse: +1.5 charge + magnet pulse
            if(UPG.barrierPulse){
              charge=Math.min(UPG.maxCharge,charge+1.5);
              _barrierPulseTimer=600;
            }
            s.cooldown = UPG.aegisTitan ? 6.0 : SHIELD_COOLDOWN;
            sparks(sx,sy,'#67e8f9',8,60);
            bullets.splice(i,1); shieldHit=true; break;
          }
        }
        if(shieldHit) continue;
      }
    }

    if(b.state==='danger'&&player.invincible<=0){
      if(UPG.colossus){ bullets.splice(i,1); continue; }
      if(Math.hypot(b.x-player.x,b.y-player.y)<player.r+b.r-2){
        const dmgScale = 1 + Math.log(roomIndex + 1) * 0.24;
        const rawDamage = Math.ceil(18 * dmgScale);
        const finalDamage = Math.max(1, Math.ceil(rawDamage * (UPG.damageTakenMult || 1)));
        hp-=finalDamage; player.invincible=1.2; player.distort=.45;
        tookDamageThisRoom = true;
        if(UPG.hitChargeGain > 0){
          charge = Math.min(UPG.maxCharge, charge + UPG.hitChargeGain);
        }
        sparks(player.x,player.y,C.danger,10,85);
        bullets.splice(i,1);
        if(hp<=0){
          if(UPG.lifeline && UPG.lifelineTriggerCount < (UPG.lifelineUses||1)){
            UPG.lifelineTriggerCount++; UPG.lifelineUsed=true; hp=1; player.invincible=2.0; sparks(player.x,player.y,'#f0abfc',16,100);
            if(UPG.lastStand){ const lsNow=performance.now(); for(let la=0;la<Math.floor(UPG.maxCharge);la++){ const lang=(Math.PI*2/Math.max(1,Math.floor(UPG.maxCharge)))*la; bullets.push({x:player.x,y:player.y,vx:Math.cos(lang)*220,vy:Math.sin(lang)*220,state:'output',r:4.5,decayStart:null,bounceLeft:UPG.bounceTier>0?2:0,pierceLeft:UPG.pierceTier,homing:false,crit:false,dmg:(UPG.playerDamageMult||1)*(UPG.denseDamageMult||1),expireAt:lsNow+2000,hitIds:new Set()}); } }
          }
          else { gameOver(); return; }
        }
        continue;
      }
      // Slipstream: near-miss detection
      if(UPG.slipTier>0 && _slipCooldown<=0){
        const dist=Math.hypot(b.x-player.x,b.y-player.y);
        if(dist < player.r+b.r+10 && dist >= player.r+b.r-2){
          charge=Math.min(UPG.maxCharge,charge+UPG.slipChargeGain);
          _slipCooldown=150;
        }
      }
    }

    if(b.state==='output'){
      let removeBullet=false;
      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j];
        if(b.hitIds.has(e.eid)) continue;
        if(Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){
          b.hitIds.add(e.eid);
          const deadManMult = (UPG.deadManTrigger && hp <= (UPG.finalForm ? 2 : 1)) ? 3 : 1;
          const deadManPierce = UPG.deadManTrigger && hp <= (UPG.finalForm ? 2 : 1);
          const dmg = (b.crit ? 2 : 1) * b.dmg * deadManMult;
          e.hp-=dmg;
          sparks(b.x,b.y,b.crit?'#7dff9b':C.green,b.crit?8:5,b.crit?70:55);
          if(e.hp<=0){
            score+=e.pts*(b.crit?2:1);kills++;
            sparks(e.x,e.y,e.col,14,95);
            // Death bullets scatter as grey
            spawnGreyDrops(e.x,e.y,ts);
            if(UPG.vampiric && _vampiricRestoresThisRoom < 3){ hp=Math.min(maxHp,hp+2); _vampiricRestoresThisRoom++; }
            enemies.splice(j,1);
          }
          if(deadManPierce || b.pierceLeft>0){
            if(!deadManPierce){
              b.pierceLeft--;
              if((b.pierceLeft===0 || UPG.volatileAllTargets) && UPG.volatileRounds){
                const vNow=performance.now();
                for(let va=0;va<4;va++){
                  const vang=va*Math.PI/2;
                  bullets.push({x:b.x,y:b.y,vx:Math.cos(vang)*180,vy:Math.sin(vang)*180,state:'output',r:b.r*0.7,decayStart:null,bounceLeft:0,pierceLeft:0,homing:false,crit:false,dmg:b.dmg*0.5,expireAt:vNow+1500,hitIds:new Set()});
                }
                sparks(b.x,b.y,C.green,6,60);
              }
            }
          } else { removeBullet=true; break; }
        }
      }
      if(removeBullet){bullets.splice(i,1);continue;}
      if(b.x<-10||b.x>W+10||b.y<-10||b.y>H+10){bullets.splice(i,1);continue;}
    }
  }

  // ── Particles
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx*dt;p.y+=p.vy*dt;
    p.vx*=Math.pow(.84,dt*60);p.vy*=Math.pow(.84,dt*60);
    p.life-=p.decay*dt;
    if(p.life<=0)particles.splice(i,1);
  }
}

// ── ROOM CLEAR FLASH ──────────────────────────────────────────────────────────
function showRoomClear(){
  const el=document.getElementById('room-clear');
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),1400);
}

function showRoomIntro(text, isGo) {
  const el = document.getElementById('room-intro');
  const txt = document.getElementById('room-intro-txt');
  txt.textContent = text;
  el.classList.toggle('go', Boolean(isGo));
  el.classList.add('show');
}

function hideRoomIntro() {
  const el = document.getElementById('room-intro');
  el.classList.remove('show', 'go');
}

// ── DRAW ──────────────────────────────────────────────────────────────────────
function draw(ts){
  const W=cv.width,H=cv.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);

  // Grid
  ctx.strokeStyle=C.grid;ctx.lineWidth=1;
  const gs=28;
  for(let x=M;x<W-M;x+=gs){ctx.beginPath();ctx.moveTo(x,M);ctx.lineTo(x,H-M);ctx.stroke();}
  for(let y=M;y<H-M;y+=gs){ctx.beginPath();ctx.moveTo(M,y);ctx.lineTo(W-M,y);ctx.stroke();}

  // Arena border — neutral
  ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1.5;
  ctx.strokeRect(M,M,W-2*M,H-2*M);

  // Corner ticks
  ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=1.5;
  const tick=12;
  [[M,M],[W-M,M],[M,H-M],[W-M,H-M]].forEach(([cx,cy])=>{
    const sx=cx===M?1:-1,sy=cy===M?1:-1;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+sx*tick,cy);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx,cy+sy*tick);ctx.stroke();
  });

  // Particles
  ctx.save();
  for(const p of particles){
    ctx.globalAlpha=Math.max(0,p.life*.85);
    ctx.fillStyle=p.col;
    const particleR = (3 + (p.grow || 0) * (1 - p.life)) * Math.max(0.18, p.life);
    ctx.beginPath();ctx.arc(p.x,p.y,particleR,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.restore();

  // Bullets
  for(const b of bullets){
    if(b.state==='danger'){
      const pulse=.75+.25*Math.sin(ts*.014);
      let bCol, bCore;
      if(b.isTriangle){
        bCol='#60a5fa';
        bCore='rgba(180,220,255,0.9)';
      } else {
        bCol=b.doubleBounce&&b.bounceCount===0?'#c084fc':C.danger;
        bCore=b.doubleBounce&&b.bounceCount===0?'rgba(230,200,255,0.9)':C.dangerCore;
      }
      ctx.globalAlpha = 0.88;
      ctx.shadowColor=bCol;ctx.shadowBlur=16*pulse;
      ctx.fillStyle=bCol;
      if(b.isTriangle){
        const angle = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(b.r, 0);
        ctx.lineTo(-b.r*.6, b.r*.6);
        ctx.lineTo(-b.r*.6, -b.r*.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=0;ctx.fillStyle=bCore;
      if(!b.isTriangle){
        ctx.beginPath();ctx.arc(b.x,b.y,b.r*.42,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha = 1;

    } else if(b.state==='grey'){
      const age=(ts-b.decayStart)/(DECAY_BASE+UPG.decayBonus);
      ctx.globalAlpha=Math.max(.10,0.82-age*.72);
      ctx.shadowColor=C.grey;ctx.shadowBlur=5;
      ctx.fillStyle=C.grey;
      ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;ctx.shadowBlur=0;

    } else if(b.state==='output'){
      const col = b.crit?'#7dff9b':C.green;
      ctx.shadowColor=col;ctx.shadowBlur=b.crit?28:18;
      drawGooBall(
        b.x,
        b.y,
        b.r,
        b.crit ? 'rgba(125,255,155,0.74)' : 'rgba(74,222,128,0.72)',
        b.crit ? 'rgba(232,255,238,0.9)' : 'rgba(200,255,220,0.82)',
        ts * 0.013 + b.x * 0.09 + b.y * 0.07,
        0.92
      );
      ctx.shadowBlur=0;
    }
    ctx.shadowBlur=0;
  }

  // Enemies
  const WINDUP_MS_DRAW = 520;
  for(const e of enemies){
    ctx.save();

    // Windup tell: very subtle swell + faint ring
    const inWindup = !e.isRusher && !e.isSiphon && e.fT >= e.fRate - WINDUP_MS_DRAW;
    let drawR = e.r;
    if(inWindup){
      const prog = (e.fT - (e.fRate - WINDUP_MS_DRAW)) / WINDUP_MS_DRAW; // 0→1
      drawR = e.r * (1 + prog * 0.12); // max 12% swell — subtle
      // Faint ring only
      ctx.strokeStyle = `rgba(255,255,255,${0.08 + prog * 0.18})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, drawR + 4, 0, Math.PI*2);
      ctx.stroke();
    }

    if(e.isSiphon){
      const dd=Math.hypot(e.x-player.x,e.y-player.y);
      const aa=dd<72?.14+.08*Math.sin(ts*.006):.04;
      const g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,72);
      g.addColorStop(0,`rgba(167,139,250,${aa*4})`);
      g.addColorStop(1,'rgba(167,139,250,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(e.x,e.y,72,0,Math.PI*2);ctx.fill();
    }

    ctx.shadowColor=e.glowCol;
    ctx.shadowBlur = 16;
    ctx.fillStyle = e.col;
    if(e.isTriangle){
      const angle = Math.atan2(player.y - e.y, player.x - e.x);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(drawR, 0);
      ctx.lineTo(-drawR * 0.55, drawR * 0.9);
      ctx.lineTo(-drawR * 0.55, -drawR * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // Inner glint along the tip axis
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(drawR * 0.55, 0);
      ctx.lineTo(-drawR * 0.22, drawR * 0.36);
      ctx.lineTo(-drawR * 0.22, -drawR * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();ctx.arc(e.x,e.y,drawR,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      // Inner glint
      ctx.fillStyle='rgba(255,255,255,0.18)';
      ctx.beginPath();ctx.arc(e.x,e.y,drawR*.38,0,Math.PI*2);ctx.fill();
    }

    if(e.hp<e.maxHp){
      const bw=e.r*2.4,bx=e.x-bw/2,by=e.y-e.r-8;
      ctx.fillStyle='#0a0e1a';ctx.fillRect(bx,by,bw,3);
      ctx.fillStyle=e.col;ctx.fillRect(bx,by,bw*(e.hp/e.maxHp),3);
    }
    ctx.fillStyle='rgba(180,180,180,0.45)';
    ctx.font='7px IBM Plex Mono,monospace';
    ctx.textAlign='center';
    ctx.fillText(e.type.toUpperCase(),e.x,e.y+e.r+11);
    ctx.restore();
  }

  // Ghost player sprite
  const show=player.invincible<=0||Math.floor(ts/90)%2===0;
  if(show){ drawGhost(ts); }

  // Shields
  if(player.shields && player.shields.length>0){
    const total=player.shields.length;
    for(let si=0;si<total;si++){
      const s=player.shields[si];
      const sAngle=Math.PI*2/total*si+ts*SHIELD_ROTATION_SPD;
      const sx=player.x+Math.cos(sAngle)*SHIELD_ORBIT_R;
      const sy=player.y+Math.sin(sAngle)*SHIELD_ORBIT_R;
      const shieldFacing = sAngle + Math.PI * 0.5;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(shieldFacing);
      if(s.cooldown>0){
        const frac=s.cooldown/SHIELD_COOLDOWN;
        ctx.globalAlpha=0.25+0.15*frac;
        ctx.strokeStyle='#67e8f9';
        ctx.lineWidth=1.5;
        ctx.strokeRect(-SHIELD_HALF_W,-SHIELD_HALF_H,SHIELD_HALF_W * 2,SHIELD_HALF_H * 2);
        // Partial fill showing regeneration progress
        ctx.globalAlpha=0.12*(1-frac);
        ctx.fillStyle='#67e8f9';
        ctx.fillRect(-SHIELD_HALF_W,-SHIELD_HALF_H,SHIELD_HALF_W * 2,SHIELD_HALF_H * 2);
      } else {
        const shieldCol = (UPG.shieldTempered && s.hardened) ? '#c084fc' : '#67e8f9';
        ctx.shadowColor=shieldCol; ctx.shadowBlur=14;
        ctx.strokeStyle=shieldCol;
        ctx.lineWidth=2;
        ctx.globalAlpha=0.9;
        ctx.strokeRect(-SHIELD_HALF_W,-SHIELD_HALF_H,SHIELD_HALF_W*2,SHIELD_HALF_H*2);
        ctx.shadowBlur=0;
        ctx.fillStyle=`rgba(${UPG.shieldTempered&&s.hardened?'192,132,252':'103,232,249'},0.18)`;
        ctx.fillRect(-SHIELD_HALF_W,-SHIELD_HALF_H,SHIELD_HALF_W*2,SHIELD_HALF_H*2);
      }
      ctx.restore();
    }
  }

  // Orbit Spheres
  if(UPG.orbitSphereTier>0){
    for(let si=0;si<UPG.orbitSphereTier;si++){
      const sAngle=Math.PI*2/UPG.orbitSphereTier*si+ts*ORBIT_ROTATION_SPD;
      const sx=player.x+Math.cos(sAngle)*ORBIT_SPHERE_R;
      const sy=player.y+Math.sin(sAngle)*ORBIT_SPHERE_R;
      if(_orbCooldown[si]>0){
        // Recharging — show as dim ghost with progress ring
        ctx.save();
        ctx.globalAlpha=0.18;
        ctx.fillStyle=C.green;
        ctx.beginPath();ctx.arc(sx,sy,5,0,Math.PI*2);ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.shadowColor=C.green;ctx.shadowBlur=12;
      ctx.fillStyle=C.green;
      ctx.globalAlpha=0.85;
      ctx.beginPath();ctx.arc(sx,sy,5,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle='rgba(200,255,220,0.92)';
      ctx.beginPath();ctx.arc(sx,sy,2,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  }

  // Joystick anchor — tiny subtle dot where finger landed
  if(joy.active){
    ctx.globalAlpha=0.18;
    ctx.strokeStyle='#fff';
    ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(joy.ax,joy.ay,joy.max || JOY_MAX,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=0.35;
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(joy.ax,joy.ay,3,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }
}

// ── GHOST SPRITE ──────────────────────────────────────────────────────────────
function drawGhost(ts){
  const p=player;
  if(!p||!p.x) return;
  const t=ts/1000;
  const chargeFrac=Math.min(1,charge/Math.max(1,UPG.maxCharge||10));
  const shotInterval = 1 / (UPG.sps * 2);
  const fireFrac = charge >= 1 ? Math.max(0, Math.min(1, fireT / shotInterval)) : 0;
  const overload=chargeFrac>=0.95;
  const overloadPulse=overload?Math.sin(t*12)*.3+.7:1;
  const lean=Math.max(-.3,Math.min(.3,player.vx/300));
  const wobble=Math.sin(t*3)*2;
  const deathFrac = gstate === 'dying' ? Math.max(0, Math.min(1, (ts - player.deadAt) / GAME_OVER_ANIM_MS)) : 0;
  const popFrac = gstate === 'dying' ? Math.max(0, Math.min(1, (ts - player.popAt) / (GAME_OVER_ANIM_MS * 0.28))) : 0;
  const size=player.r*1.18+chargeFrac*3.9 - deathFrac*1.2;

  ctx.save();
  if(player.distort>0 || gstate === 'dying'){
    ctx.translate(p.x,p.y+wobble);
    const deathScale = gstate === 'dying' ? 1 + deathFrac * 0.22 - popFrac * 1.1 : 1;
    ctx.scale((1+.12*Math.sin(ts*.06)) * deathScale,(1+.12*Math.cos(ts*.07)) * deathScale);
    ctx.rotate(lean);
  } else {
    ctx.translate(p.x,p.y+wobble);
    ctx.rotate(lean);
  }

  // Ambient glow
  const pulse=.55+.45*Math.sin(ts*.0025);
  const ga=ctx.createRadialGradient(0,0,0,0,0,size*3);
  ga.addColorStop(0,gstate === 'dying' ? `rgba(248,180,199,${0.14 + deathFrac * 0.16})` : overload?`rgba(120,255,160,${0.20 + 0.08 * pulse})`:`rgba(184,255,204,${0.18*pulse})`);
  ga.addColorStop(1,'rgba(184,255,204,0)');
  ctx.fillStyle=ga;
  ctx.beginPath();ctx.arc(0,0,size*3,0,Math.PI*2);ctx.fill();

  ctx.shadowBlur=22+chargeFrac*14;
  ctx.shadowColor=gstate === 'dying' ? '#f8b4c7' : overload?'#7dff9b':C.ghost;

  const inv=player.invincible>0?Math.min(1,player.invincible/.4):0;
  let bodyR,bodyG,bodyB;
  if(gstate === 'dying'){
    bodyR = 208;
    bodyG = 244 - Math.round(deathFrac * 36);
    bodyB = 224 + Math.round(deathFrac * 12);
  } else if(overload){
    bodyR=Math.round(176 + overloadPulse * 40);
    bodyG=Math.round(244 + overloadPulse * 10);
    bodyB=Math.round(196 + overloadPulse * 32);
  } else {
    bodyR=Math.round(184+inv*71);bodyG=255;bodyB=Math.round(220+inv*35);
  }
  ctx.fillStyle=`rgba(${bodyR},${bodyG},${bodyB},0.93)`;

  ctx.beginPath();
  ctx.arc(0,-size*.2,size,Math.PI,0);
  const tailW=size,segs=4;
  for(let s=0;s<=segs;s++){
    const xOff=tailW-(s/segs)*tailW*2;
    const yOff=size*.8+Math.sin(t*3+s)*4;
    if(s===0) ctx.lineTo(tailW,yOff);
    else ctx.lineTo(xOff,yOff);
  }
  ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;

  ctx.fillStyle='#080f0a';
  ctx.beginPath();ctx.arc(-5,-size*.25,3,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(5, -size*.25,3,0,Math.PI*2);ctx.fill();
  if(gstate === 'dying'){
    ctx.strokeStyle='rgba(12,20,16,0.85)';
    ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(-5,-size*.25,1.5,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(5,-size*.25,1.5,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(0,size*.08,4.6,Math.PI+.25,Math.PI*2-.25);ctx.stroke();
  } else {
    ctx.fillStyle='rgba(74,222,128,0.9)';
    ctx.beginPath();ctx.arc(-4,-size*.3,1.3,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(6, -size*.3,1.3,0,Math.PI*2);ctx.fill();
  }

  if(chargeFrac>0.3 && gstate !== 'dying'){
    ctx.strokeStyle='rgba(0,0,0,0.55)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(0,-size*.1,4.5,.2,Math.PI-.2);ctx.stroke();
  }

  // Shot cooldown ring mirrors the enemy tell ring and shows when auto-fire is primed.
  const ringRadius = size + 8;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
  if(charge >= 1){
    ctx.strokeStyle = C.green;
    ctx.shadowColor = C.green;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fireFrac);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ── HP bar above ghost (drawn in local space, above dome)
  const barW=size*2.8, barH=4;
  const barX=-barW/2, barY=-size*1.55;
  const hpFrac=Math.max(0,hp/maxHp);
  // Track
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.beginPath();ctx.roundRect(barX-1,barY-1,barW+2,barH+2,2);ctx.fill();
  // Fill — green → yellow → red
  const hpCol = hpFrac>0.5?'#4ade80':hpFrac>0.25?'#fbbf24':'#f87171';
  ctx.shadowBlur=6; ctx.shadowColor=hpCol;
  ctx.fillStyle=hpCol;
  ctx.beginPath();ctx.roundRect(barX,barY,barW*hpFrac,barH,2);ctx.fill();
  ctx.shadowBlur=0;

  ctx.restore();
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function hudUpdate(){
  document.getElementById('room-counter').textContent=`ROOM ${roomIndex+1}`;
  document.getElementById('score-txt').textContent=score;
  document.getElementById('charge-fill').style.width=`${Math.max(0, Math.min(100, (charge / UPG.maxCharge) * 100))}%`;
  document.getElementById('charge-badge').textContent=`${Math.floor(charge)} / ${UPG.maxCharge}`;
  document.getElementById('sps-num').textContent=UPG.sps.toFixed(1);
}

bindJoystickControls({
  canvas: cv,
  joy,
  getGameState: () => gstate,
});

function openLeaderboardScreen() {
  lbScreen.classList.remove('off');
  refreshLeaderboardView();
}

if(lbOpenBtn){
  lbOpenBtn.addEventListener('click', openLeaderboardScreen);
}
if(lbOpenBtnGo){
  lbOpenBtnGo.addEventListener('click', openLeaderboardScreen);
}
lbCloseBtn.addEventListener('click', () => lbScreen.classList.add('off'));
lbPeriodBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    lbPeriod = btn.dataset.lbPeriod;
    refreshLeaderboardView();
  });
});
lbScopeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    lbScope = btn.dataset.lbScope;
    refreshLeaderboardView();
  });
});

function setPlayerName(v, { syncInputs = false } = {}){
  const sanitized = sanitizeName(v);
  playerName = sanitized || 'RUNNER';
  try {
    localStorage.setItem(NAME_KEY, sanitized);
  } catch {}
  if(syncInputs){
    nameInputStart.value = sanitized;
    nameInputGo.value = sanitized;
  }
  refreshLeaderboardView();
}

nameInputStart.addEventListener('input', (e)=>setPlayerName(e.target.value));
nameInputGo.addEventListener('input', (e)=>setPlayerName(e.target.value));

document.getElementById('btn-start').onclick=()=>{
  setPlayerName(nameInputStart.value, { syncInputs: true });
  document.getElementById('s-start').classList.add('off');
  init();gstate='playing';lastT=performance.now();raf=requestAnimationFrame(loop);
};
document.getElementById('btn-restart').onclick=()=>{
  setPlayerName(nameInputGo.value, { syncInputs: true });
  document.getElementById('s-go').classList.add('off');
  if(goBoonsPanel) goBoonsPanel.classList.add('off');
  init();gstate='playing';lastT=performance.now();raf=requestAnimationFrame(loop);
};

goBoonsBtn?.addEventListener('click', ()=>goBoonsPanel?.classList.toggle('off'));
goBoonsCloseBtn?.addEventListener('click', ()=>goBoonsPanel?.classList.add('off'));

const lbBoonsPopup = document.getElementById('lb-boons-popup');
const lbBoonsPopupTitle = document.getElementById('lb-boons-popup-title');
const lbBoonsPopupList = document.getElementById('lb-boons-popup-list');
document.getElementById('btn-lb-boons-close')?.addEventListener('click', () => lbBoonsPopup?.classList.add('off'));

function showLbBoonsPopup(runnerName, boons) {
  if(!lbBoonsPopup) return;
  lbBoonsPopupTitle.textContent = `${runnerName} · Run Loadout`;
  lbBoonsPopupList.innerHTML = '';
  if(!boons || boons.length === 0) {
    lbBoonsPopupList.innerHTML = '<div class="up-active-empty">No boon data recorded.</div>';
  } else {
    for(const b of boons) {
      const row = document.createElement('div');
      row.className = 'up-active-item';
      row.innerHTML = `<div class="up-active-icon">${b.icon}</div><div class="up-active-copy"><div class="up-active-name">${b.name}</div><div class="up-active-detail">${b.detail}</div></div>`;
      lbBoonsPopupList.appendChild(row);
    }
  }
  lbBoonsPopup.classList.remove('off');
}


loadLeaderboard();
setLeaderboardStatus('local', 'LOCAL FALLBACK');
setPlayerName(loadSavedPlayerName(), { syncInputs: true });
renderLeaderboard();
revealAppShell();

draw(0);
