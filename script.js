const cv  = document.getElementById('cv');
const ctx = cv.getContext('2d');

// ── SAFARI MOBILE VIEWPORT FIX ───────────────────────────────────────────────
// Safari mobile has issues with 100vh including the address bar
function fixSafariViewport() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const vh = viewportHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);

  // Set fallback heights for iOS Safari hot-address-bar resizing
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari && /Mobile/.test(navigator.userAgent)) {
    document.documentElement.style.height = `${viewportHeight}px`;
    document.documentElement.style.minHeight = `${viewportHeight}px`;
    document.body.style.height = `${viewportHeight}px`;
    document.body.style.minHeight = `${viewportHeight}px`;
    document.body.style.position = 'relative';
  }
}

window.addEventListener('resize', fixSafariViewport);
window.addEventListener('orientationchange', () => {
  setTimeout(fixSafariViewport, 100);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fixSafariViewport);
}
fixSafariViewport(); // Initial call

function resize() {
  const w = Math.min(400, window.innerWidth * 0.95);
  cv.width  = Math.floor(w);
  cv.height = Math.floor(w * 1.18);
}
resize();

// ── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  bg:'#161616', grid:'rgba(255,255,255,0.025)', border:'rgba(255,255,255,0.1)',
  danger:'#60a5fa', dangerCore:'rgba(200,230,255,0.9)',
  grey:'#888', green:'#4ade80', ghost:'#b8ffcc', siphon:'#a78bfa',
};

// ── ROOM DEFINITIONS ─────────────────────────────────────────────────────────
// All enemies spawn at d:0 — full room visible from the start.
// Rushers/siphons always paired with at least one shooter.
// Chaos is purely RNG jitter on fire timing, not spawn order.
const ROOM_SCRIPTS = [
  // Room 1 — just one chaser. Learn the basics.
  { name:'ARRIVAL',   chaos:0,    waves:[ [{t:'chaser',   n:1, d:0}] ] },
  // Room 2 — two chasers.
  { name:'PATROL',    chaos:0,    waves:[ [{t:'chaser',   n:2, d:0}] ] },
  // Room 3 — meet the rusher, but a chaser is always there too.
  { name:'RUSH',      chaos:0,    waves:[ [{t:'chaser',   n:1, d:0},{t:'rusher', n:1, d:0}] ] },
  // Room 4 — sniper introduced. Just one of each, slow fire.
  { name:'MARKSMAN',  chaos:0.05, waves:[ [{t:'chaser',   n:2, d:0},{t:'sniper', n:1, d:0}] ] },
  // Room 5 — zoner introduced. Chasers keep pressure.
  { name:'ZONE',      chaos:0.1,  waves:[ [{t:'chaser',   n:2, d:0},{t:'zoner',  n:1, d:0}] ] },
  // Room 6 — rusher + sniper combo. Sniper provides bullets to harvest.
  { name:'PINCER',    chaos:0.1,  waves:[ [{t:'sniper',   n:2, d:0},{t:'rusher', n:2, d:0}] ] },
  // Room 7 — siphon introduced, always with chasers shooting.
  { name:'DRAIN',     chaos:0.15, waves:[ [{t:'chaser',   n:2, d:0},{t:'siphon', n:1, d:0}] ] },
  // Room 8 — disruptor introduced alongside chasers.
  { name:'STATIC',    chaos:0.15, waves:[ [{t:'chaser',   n:2, d:0},{t:'disruptor',n:1,d:0}] ] },
  // Room 9 — mixed: sniper + zoner + rusher (rushers always have shooters).
  { name:'CROSSFIRE', chaos:0.2,  waves:[ [{t:'sniper',   n:1, d:0},{t:'zoner',  n:1, d:0},{t:'rusher',n:1,d:0}] ] },
  // Room 10 — heavier: disruptors + rushers + siphon (siphon always with shooters).
  { name:'BARRAGE',   chaos:0.25, waves:[ [{t:'disruptor',n:2, d:0},{t:'rusher', n:1, d:0},{t:'siphon',n:1,d:0}] ] },
  // Room 11 — everything except siphon, real pressure.
  { name:'SIEGE',     chaos:0.3,  waves:[ [{t:'chaser',   n:2, d:0},{t:'zoner',  n:1, d:0},{t:'sniper',n:1,d:0},{t:'rusher',n:2,d:0}] ] },
  // Room 12 — full kit.
  { name:'VORTEX',    chaos:0.35, waves:[ [{t:'disruptor',n:2, d:0},{t:'sniper', n:1, d:0},{t:'rusher',n:2,d:0},{t:'siphon',n:1,d:0}] ] },
  // Room 13+ handled by getRoomDef
];

// ── ENEMY DEFS ────────────────────────────────────────────────────────────────
const EDEFS = {
  chaser:    {col:'#3b82f6', glowCol:'rgba(59,130,246,0.7)',  r:12,hp:3, spd:55, fRate:1800,burst:1,spread:.22,pts:50,  flee:true,  fleeRange:110, strafeSpd:0.6},
  zoner:     {col:'#2563eb', glowCol:'rgba(37,99,235,0.7)',   r:15,hp:5, spd:24, fRate:2200,burst:8,spread:6.28,pts:80, flee:true,  fleeRange:130, strafeSpd:0.5},
  sniper:    {col:'#93c5fd', glowCol:'rgba(147,197,253,0.7)', r:9, hp:2, spd:30, fRate:2800,burst:1,spread:0,  pts:100, flee:true,  fleeRange:150, strafeSpd:0.8},
  disruptor: {col:'#1d4ed8', glowCol:'rgba(29,78,216,0.7)',   r:11,hp:4, spd:46, fRate:750, burst:1,spread:.9, pts:60,  flee:true,  fleeRange:100, strafeSpd:0.7},
  siphon:    {col:'#a78bfa', glowCol:'rgba(167,139,250,0.7)', r:13,hp:3, spd:28, fRate:9999,burst:0,spread:0,  pts:120, isSiphon:true},
  rusher:    {col:'#f472b6', glowCol:'rgba(244,114,182,0.8)', r:13,hp:4, spd:90, fRate:9999,burst:0,spread:0,  pts:70,  isRusher:true},
};

// ── PLAYER UPGRADES ───────────────────────────────────────────────────────────
// Archero-style kit — persistent multipliers stored here
let UPG = {
  speedMult:1, sps:.5, spsTier:0, shapeTier:0, maxCharge:10,
  decayBonus:0, pierceTier:0, bounceTier:0, homingTier:0,
  shotSize:1, shotSpd:1, critChance:0, absorbRange:0, regenTick:0
};
function resetUpgrades() {
  UPG = {
    speedMult:   1,    // movement speed
    sps:         0.5,  // shots per second
    spsTier:     0,
    shapeTier:   0,    // 0=single 1=triple 2=penta 3=ring 4=double 5=snipe
    maxCharge:   10,
    decayBonus:  0,    // ms added to grey bullet lifetime
    pierceTier:  0,    // 0=none, 1=pierce 1 extra
    bounceTier:  0,    // output bullets bounce off walls
    homingTier:  0,    // output bullets curve toward nearest enemy
    shotSize:    1,    // bullet radius multiplier
    shotSpd:     1,    // output bullet speed mult
    critChance:  0,    // 0..1 chance to deal 2x damage
    absorbRange: 0,    // extra absorb radius
    regenTick:   0,    // hp regen per room clear
  };
}

const SPS_LADDER = [0.5,1.0,1.8,3.0,5.0,8.0];
const DECAY_BASE = 3500; // ms — was 8000, now faster
const M = 18;

// ── STATE ─────────────────────────────────────────────────────────────────────
let gstate = 'start';
let player = {};
let bullets = [], enemies = [], particles = [];
let score=0, kills=0;
let charge=0, fireT=0, stillTimer=0, prevStill=false;
let hp=100, maxHp=100;
// ── JOYSTICK STATE ────────────────────────────────────────────────────────────
// Virtual joystick: anchor set on press, direction from delta
let joy = { active:false, ax:0, ay:0, dx:0, dy:0, mag:0 };
const JOY_DEADZONE = 6;   // px — ignore tiny wiggles
const JOY_MAX     = 55;   // px — full speed at this delta
let raf=0, lastT=0;

// Room system
let roomIndex = 0;
let roomPhase = 'spawning';
let roomTimer = 0;
let spawnQueue = [];
let roomClearTimer = 0;

function getRoomDef(idx) {
  if(idx < ROOM_SCRIPTS.length) return ROOM_SCRIPTS[idx];
  // Endless — slow ramp, cap chaos at 0.7
  const over = idx - ROOM_SCRIPTS.length; // how many rooms past scripted
  const chaosLevel = Math.min(0.7, 0.35 + over * 0.03);
  const names = ['FRENZY','OVERRUN','DELUGE','STORM','NIGHTMARE','ABYSS','INFERNO','CHAOS'];
  const chasers    = 2 + Math.floor(over * 0.25);
  const rushers    = Math.floor(over * 0.2);
  const snipers    = 1 + Math.floor(over * 0.15);
  const disruptors = Math.floor(over * 0.18);
  const siphons    = over >= 4 ? 1 : 0;
  // Always at least 1 shooter so rushers/siphons are never alone
  const entries = [
    {t:'chaser',    n: Math.max(1, chasers),   d:0},
    {t:'sniper',    n: Math.max(1, snipers),   d:0},
  ];
  if(disruptors>0) entries.push({t:'disruptor', n:disruptors, d:0});
  if(rushers>0)    entries.push({t:'rusher',    n:rushers,    d:0});
  if(siphons>0)    entries.push({t:'siphon',    n:siphons,    d:0});
  return { name: names[over % names.length], chaos: chaosLevel, waves:[entries] };
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
  roomIndex = idx;
  const def = getRoomDef(idx);
  spawnQueue = buildSpawnQueue(def);
  roomTimer = 0;
  roomPhase = 'spawning';
  enemies = [];
  bullets = [];
  updateRoomBadge(def);
}

function updateRoomBadge(def) {
  const el = document.getElementById('room-badge');
  el.textContent = `ROOM ${roomIndex+1} — ${def.name}`;
}

function spawnEnemy(type) {
  const d = EDEFS[type];
  const W=cv.width, H=cv.height;
  const edge=Math.floor(Math.random()*4);
  let x,y;
  if(edge===0){x=M+Math.random()*(W-2*M);y=M+d.r;}
  else if(edge===1){x=W-M-d.r;y=M+Math.random()*(H-2*M);}
  else if(edge===2){x=M+Math.random()*(W-2*M);y=H-M-d.r;}
  else{x=M+d.r;y=M+Math.random()*(H-2*M);}
  // Scale HP with room index
  const hpScale = 1 + roomIndex * 0.10;
  enemies.push({...d, x, y, type, hp:Math.ceil(d.hp*hpScale), maxHp:Math.ceil(d.hp*hpScale), fT:Math.random()*d.fRate});
}

// Bullet speed scales with room — slow at room 1, ramps up
function bulletSpeedScale() {
  return 0.55 + Math.min(roomIndex, 10) * 0.065;
}

function spawnEB(ex,ey) {
  const a=Math.atan2(player.y-ey,player.x-ex)+(Math.random()-.5)*.22;
  const spd=(140+Math.random()*40) * bulletSpeedScale();
  bullets.push({x:ex,y:ey,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,state:'danger',r:4.5,decayStart:null,bounces:0});
}

function spawnZB(ex,ey,idx,total) {
  const a=(Math.PI*2/total)*idx;
  const spd=125 * bulletSpeedScale();
  bullets.push({x:ex,y:ey,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,state:'danger',r:4.5,decayStart:null,bounces:0});
}

function firePlayer(tx,ty) {
  if(charge<1) return;
  const base=Math.atan2(ty-player.y,tx-player.x);
  const tier=UPG.shapeTier;
  let angs;
  if(tier===0)       angs=[base];
  else if(tier===1)  angs=[base-.28,base,base+.28];           // triple
  else if(tier===2)  angs=[base-.45,base-.22,base,base+.22,base+.45]; // penta
  else if(tier===3)  angs=Array.from({length:8},(_,i)=>Math.PI*2/8*i); // ring
  else if(tier===4)  angs=[base, base+Math.PI];               // double (front+back)
  else               angs=[base];                              // snipe (handled via big bullet)

  const bspd = 230 * UPG.shotSpd;
  const br   = 4.5 * UPG.shotSize;
  const snipe = tier===5;

  for(const a of angs) {
    bullets.push({
      x:player.x, y:player.y,
      vx:Math.cos(a)*bspd*(snipe?1.6:1),
      vy:Math.sin(a)*bspd*(snipe?1.6:1),
      state:'output', r:snipe?7.5:br, decayStart:null,
      bounceLeft: UPG.bounceTier>0?2:0,
      pierce: UPG.pierceTier>0,
      homing: UPG.homingTier>0,
      crit: Math.random()<UPG.critChance,
    });
  }
  charge=Math.max(0,charge-1);
  sparks(player.x,player.y,C.green,4,55);
}

function sparks(x,y,col,n=6,spd=80) {
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,s=spd*(.4+Math.random()*.6);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,col,life:1,decay:1.6+Math.random()});
  }
}

// ── UPGRADE POOL ─────────────────────────────────────────────────────────────
// Full Archero-style kit
const UPGRADES = [
  // OFFENSE
  {name:'Rapid Fire',      tag:'OFFENSE', icon:'⚡', desc:'Unlock next fire rate tier. Shoot faster.',
    apply(){ if(UPG.spsTier<SPS_LADDER.length-1){UPG.spsTier++;UPG.sps=SPS_LADDER[UPG.spsTier];} }},
  {name:'Triple Shot',     tag:'OFFENSE', icon:'🔱', desc:'Fire 3 bullets in a spread instead of 1.',
    apply(){ UPG.shapeTier=Math.max(UPG.shapeTier,1); }},
  {name:'Penta Shot',      tag:'OFFENSE', icon:'✦',  desc:'Five bullets in a wide fan. Requires Triple.',
    apply(){ UPG.shapeTier=Math.max(UPG.shapeTier,2); }},
  {name:'Ring Blast',      tag:'OFFENSE', icon:'◎',  desc:'Fire 8 bullets in all directions.',
    apply(){ UPG.shapeTier=Math.max(UPG.shapeTier,3); }},
  {name:'Front+Back',      tag:'OFFENSE', icon:'↕',  desc:'Fire forward AND backward simultaneously.',
    apply(){ UPG.shapeTier=Math.max(UPG.shapeTier,4); }},
  {name:'Snipe Shot',      tag:'OFFENSE', icon:'🎯', desc:'Single oversized bullet at 1.6× speed & size.',
    apply(){ UPG.shapeTier=5; }},
  {name:'Bigger Bullets',  tag:'OFFENSE', icon:'🔵', desc:'Output bullets are 35% larger.',
    apply(){ UPG.shotSize*=1.35; }},
  {name:'Faster Bullets',  tag:'OFFENSE', icon:'💨', desc:'Output bullets travel 25% faster.',
    apply(){ UPG.shotSpd*=1.25; }},
  {name:'Critical Hit',    tag:'OFFENSE', icon:'💥', desc:'+20% chance each shot deals double damage.',
    apply(){ UPG.critChance=Math.min(0.8,UPG.critChance+0.2); }},
  // UTILITY
  {name:'Ricochet',        tag:'UTILITY', icon:'↯',  desc:'Your output bullets bounce off walls up to 2 times.',
    apply(){ UPG.bounceTier=Math.max(1,UPG.bounceTier); }},
  {name:'Homing',          tag:'UTILITY', icon:'🌀', desc:'Output bullets curve toward the nearest enemy.',
    apply(){ UPG.homingTier=1; }},
  {name:'Pierce',          tag:'UTILITY', icon:'→',  desc:'Output bullets pass through the first enemy hit.',
    apply(){ UPG.pierceTier=1; }},
  {name:'Quick Harvest',   tag:'UTILITY', icon:'⬇',  desc:'Grey bullets vanish 2s sooner — harvest window tighter but score faster.',
    apply(){ UPG.decayBonus-=2000; }},
  {name:'Decay Extension', tag:'UTILITY', icon:'⏳', desc:'Grey bullets linger 1.5s longer for easier harvest.',
    apply(){ UPG.decayBonus+=1500; }},
  {name:'Charge Cap +5',   tag:'UTILITY', icon:'▣',  desc:'Store 5 more absorbed bullets.',
    apply(){ UPG.maxCharge+=5; }},
  {name:'Charge Cap +10',  tag:'UTILITY', icon:'◆',  desc:'Store 10 more absorbed bullets.',
    apply(){ UPG.maxCharge+=10; }},
  {name:'Wider Absorb',    tag:'UTILITY', icon:'🧲', desc:'Pull grey bullets from 20% farther away.',
    apply(){ UPG.absorbRange+=12; }},
  // SURVIVABILITY
  {name:'Extra Life',      tag:'SURVIVE', icon:'◉',  desc:'Gain 25 max HP and restore it.',
    apply(){ maxHp+=25; hp=Math.min(hp+25,maxHp); }},
  {name:'Ghost Velocity',  tag:'SURVIVE', icon:'👻', desc:'Move 18% faster through the arena.',
    apply(){ UPG.speedMult*=1.18; }},
  {name:'Room Regen',      tag:'SURVIVE', icon:'💚', desc:'Restore 20 HP whenever you clear a room.',
    apply(){ UPG.regenTick+=20; }},
];

function showUpgrades() {
  gstate='upgrade'; cancelAnimationFrame(raf);
  const pool=[...UPGRADES].sort(()=>Math.random()-.5).slice(0,3);
  const c=document.getElementById('up-cards');
  c.innerHTML='';
  for(const u of pool){
    const el=document.createElement('div');
    el.className='up-card';
    const tagColor = u.tag==='OFFENSE'?'#f87171':u.tag==='UTILITY'?'#38bdf8':'#4ade80';
    el.innerHTML=`
      <div class="up-icon">${u.icon}</div>
      <div class="up-name">${u.name}</div>
      <div class="up-desc">${u.desc}</div>
      <div class="up-tag" style="color:${tagColor}">${u.tag}</div>`;
    el.onclick=()=>{
      u.apply();
      document.getElementById('s-up').classList.add('off');
      startRoom(roomIndex+1);
      gstate='playing'; lastT=performance.now();
      raf=requestAnimationFrame(loop);
    };
    c.appendChild(el);
  }
  document.getElementById('s-up').classList.remove('off');
}

function gameOver(){
  gstate='gameover'; cancelAnimationFrame(raf);
  document.getElementById('go-score').textContent=score;
  document.getElementById('go-note').textContent=`Room ${roomIndex+1} · ${kills} enemies eliminated`;
  document.getElementById('s-go').classList.remove('off');
}

function init() {
  score=0; kills=0;
  charge=0; fireT=0; stillTimer=0; prevStill=false; hp=100; maxHp=100;
  player={x:cv.width/2,y:cv.height/2,r:10,vx:0,vy:0,invincible:0,distort:0};
  bullets=[];enemies=[];particles=[];
  joy={active:false,ax:0,ay:0,dx:0,dy:0,mag:0};
  resetUpgrades();
  startRoom(0);
  hudUpdate();
}

// ── MAIN LOOP ─────────────────────────────────────────────────────────────────
function loop(ts){
  if(gstate!=='playing') return;
  const dt=Math.min((ts-lastT)/1000,.05); lastT=ts;
  update(dt,ts); draw(ts); hudUpdate();
  raf=requestAnimationFrame(loop);
}

// ── UPDATE ────────────────────────────────────────────────────────────────────
function update(dt,ts){
  const W=cv.width,H=cv.height;
  const BASE_SPD=165*UPG.speedMult;

  // ── Player movement — virtual joystick
  if(joy.active && joy.mag > JOY_DEADZONE){
    const t = Math.min((joy.mag - JOY_DEADZONE) / (JOY_MAX - JOY_DEADZONE), 1);
    player.vx = joy.dx * BASE_SPD * t;
    player.vy = joy.dy * BASE_SPD * t;
  } else {
    // Finger lifted or in deadzone — hard stop
    player.vx = 0;
    player.vy = 0;
  }
  player.x=Math.max(M+player.r,Math.min(W-M-player.r,player.x+player.vx*dt));
  player.y=Math.max(M+player.r,Math.min(H-M-player.r,player.y+player.vy*dt));
  if(player.invincible>0)player.invincible-=dt;
  if(player.distort>0)player.distort-=dt;

  // ── Room state machine
  roomTimer += dt*1000;

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
      showRoomClear();
    }
  }

  if(roomPhase==='clear'){
    roomClearTimer+=dt*1000;
    if(roomClearTimer>1000){
      roomPhase='reward';
      showUpgrades();
    }
  }

  // 'reward' and 'between' phases are handled by showUpgrades / card click callbacks

  // ── Auto-fire: fires when joystick released (player stopped)
  const isStill = !joy.active || joy.mag <= JOY_DEADZONE;

  if(!isStill){
    stillTimer = 0;
    // don't reset fireT — keep it primed so shot is instant on release
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
        if(hp<=0){gameOver();return;}
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
        if(e.type==='zoner'){for(let i=0;i<e.burst;i++)spawnZB(e.x,e.y,i,e.burst);}
        else{for(let i=0;i<e.burst;i++)spawnEB(e.x,e.y);}
      }
    }
  }

  // ── Bullets
  const absorbR = player.r + 5 + UPG.absorbRange;
  const decayMS = DECAY_BASE + UPG.decayBonus;

  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];

    // Homing for output bullets
    if(b.state==='output'&&b.homing&&enemies.length>0){
      const tgt=enemies.reduce((bst,e)=>{const d=Math.hypot(e.x-b.x,e.y-b.y);return(!bst||d<bst.d)?{e,d}:bst;},null);
      if(tgt){
        const dx=tgt.e.x-b.x,dy=tgt.e.y-b.y,d=Math.hypot(dx,dy);
        b.vx+=(dx/d)*400*dt; b.vy+=(dy/d)*400*dt;
        const sp=Math.hypot(b.vx,b.vy);
        const maxSp=230*UPG.shotSpd*1.2;
        if(sp>maxSp){b.vx=b.vx/sp*maxSp;b.vy=b.vy/sp*maxSp;}
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
        b.state='grey';b.decayStart=ts;
        sparks(b.x,b.y,C.grey,4,35);
      } else if(b.state==='output'){
        if(b.bounceLeft>0){ b.bounceLeft--; }
        else { bullets.splice(i,1); continue; }
      }
    }

    if(b.state==='grey'){
      if(ts-b.decayStart>decayMS){bullets.splice(i,1);continue;}
      b.vx*=Math.pow(.97,dt*60); b.vy*=Math.pow(.97,dt*60);
      if(Math.hypot(b.x-player.x,b.y-player.y)<absorbR+b.r){
        charge=Math.min(UPG.maxCharge,charge+1);
        sparks(b.x,b.y,C.ghost,5,45);
        bullets.splice(i,1);continue;
      }
    }

    if(b.state==='danger'&&player.invincible<=0){
      if(Math.hypot(b.x-player.x,b.y-player.y)<player.r+b.r-2){
        hp-=22; player.invincible=1.2; player.distort=.45;
        sparks(player.x,player.y,C.danger,10,85);
        bullets.splice(i,1);
        if(hp<=0){gameOver();return;}
        continue;
      }
    }

    if(b.state==='output'){
      let hit=false;
      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j];
        if(Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){
          const dmg = b.crit ? 2 : 1;
          e.hp-=dmg;
          sparks(b.x,b.y,b.crit?'#fbbf24':C.green,b.crit?8:5,b.crit?70:55);
          hit=true;
          if(e.hp<=0){
            score+=e.pts*(b.crit?2:1);kills++;
            sparks(e.x,e.y,e.col,14,95);
            // Death bullets scatter as grey
            for(let k=0;k<4;k++){
              const a=Math.random()*Math.PI*2,s=50+Math.random()*50;
              bullets.push({x:e.x,y:e.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,state:'grey',r:4.5,decayStart:ts,bounces:0});
            }
            enemies.splice(j,1);
          }
          if(!b.pierce){break;}
        }
      }
      if(hit&&!b.pierce){bullets.splice(i,1);continue;}
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
    ctx.beginPath();ctx.arc(p.x,p.y,3*p.life,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.restore();

  // Bullets
  for(const b of bullets){
    if(b.state==='danger'){
      const pulse=.75+.25*Math.sin(ts*.014);
      ctx.shadowColor=C.danger;ctx.shadowBlur=16*pulse;
      ctx.fillStyle=C.danger;
      ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle=C.dangerCore;
      ctx.beginPath();ctx.arc(b.x,b.y,b.r*.42,0,Math.PI*2);ctx.fill();

    } else if(b.state==='grey'){
      const age=(ts-b.decayStart)/(DECAY_BASE+UPG.decayBonus);
      ctx.globalAlpha=Math.max(.10,1-age*.9);
      ctx.shadowColor=C.grey;ctx.shadowBlur=5;
      ctx.fillStyle=C.grey;
      ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;ctx.shadowBlur=0;

    } else if(b.state==='output'){
      const col = b.crit?'#fbbf24':C.green;
      ctx.shadowColor=col;ctx.shadowBlur=b.crit?24:18;
      ctx.fillStyle=col;
      ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle='rgba(200,255,220,0.95)';
      ctx.beginPath();ctx.arc(b.x,b.y,b.r*.38,0,Math.PI*2);ctx.fill();
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
    ctx.beginPath();ctx.arc(e.x,e.y,drawR,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;

    // Inner glint
    ctx.fillStyle = inWindup ? `rgba(${e.col},0.5)` : 'rgba(255,255,255,0.18)';
    ctx.fillStyle='rgba(255,255,255,0.18)';
    ctx.beginPath();ctx.arc(e.x,e.y,drawR*.38,0,Math.PI*2);ctx.fill();

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

  // Joystick anchor — tiny subtle dot where finger landed
  if(joy.active){
    ctx.globalAlpha=0.18;
    ctx.strokeStyle='#fff';
    ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(joy.ax,joy.ay,JOY_MAX,0,Math.PI*2);ctx.stroke();
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
  const overload=chargeFrac>=0.95;
  const overloadPulse=overload?Math.sin(t*12)*.3+.7:1;
  const lean=Math.max(-.3,Math.min(.3,player.vx/300));
  const wobble=Math.sin(t*3)*2;
  const size=13+chargeFrac*6;

  ctx.save();
  if(player.distort>0){
    ctx.translate(p.x,p.y+wobble);
    ctx.scale(1+.12*Math.sin(ts*.06),1+.12*Math.cos(ts*.07));
    ctx.rotate(lean);
  } else {
    ctx.translate(p.x,p.y+wobble);
    ctx.rotate(lean);
  }

  // Ambient glow
  const pulse=.55+.45*Math.sin(ts*.0025);
  const ga=ctx.createRadialGradient(0,0,0,0,0,size*3);
  ga.addColorStop(0,overload?`rgba(248,113,113,${0.18*pulse})`:`rgba(184,255,204,${0.18*pulse})`);
  ga.addColorStop(1,'rgba(184,255,204,0)');
  ctx.fillStyle=ga;
  ctx.beginPath();ctx.arc(0,0,size*3,0,Math.PI*2);ctx.fill();

  ctx.shadowBlur=22+chargeFrac*14;
  ctx.shadowColor=overload?'#f87171':C.ghost;

  const inv=player.invincible>0?Math.min(1,player.invincible/.4):0;
  let bodyR,bodyG,bodyB;
  if(overload){
    bodyR=Math.round(184+overloadPulse*64);
    bodyG=Math.round(220-overloadPulse*107);
    bodyB=Math.round(170-overloadPulse*57);
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
  ctx.fillStyle='rgba(74,222,128,0.9)';
  ctx.beginPath();ctx.arc(-4,-size*.3,1.3,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(6, -size*.3,1.3,0,Math.PI*2);ctx.fill();

  if(chargeFrac>0.3){
    ctx.strokeStyle='rgba(0,0,0,0.55)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(0,-size*.1,4.5,.2,Math.PI-.2);ctx.stroke();
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
  document.getElementById('charge-fill').style.width=(charge/UPG.maxCharge*100)+'%';
  document.getElementById('charge-badge').textContent=`${Math.floor(charge)} / ${UPG.maxCharge}`;
  document.getElementById('sps-num').textContent=(UPG.sps*2).toFixed(1);
}

// ── INPUT — virtual joystick ──────────────────────────────────────────────────
function canvasPos(clientX, clientY){
  const r=cv.getBoundingClientRect();
  return {
    x:(clientX-r.left)*(cv.width/r.width),
    y:(clientY-r.top)*(cv.height/r.height)
  };
}

function joyStart(cx,cy){
  if(gstate!=='playing') return;
  const p=canvasPos(cx,cy);
  joy.active=true; joy.ax=p.x; joy.ay=p.y; joy.dx=0; joy.dy=0; joy.mag=0;
  // Prime fireT so the NEXT stop after this drag fires immediately
  fireT = 1/(UPG.sps*2);
}

function joyMove(cx,cy){
  if(!joy.active) return;
  const p=canvasPos(cx,cy);
  const dx=p.x-joy.ax, dy=p.y-joy.ay;
  joy.mag=Math.hypot(dx,dy);
  if(joy.mag>JOY_DEADZONE){ joy.dx=dx/joy.mag; joy.dy=dy/joy.mag; }
  else { joy.dx=0; joy.dy=0; }
}

function joyEnd(){
  joy.active=false; joy.dx=0; joy.dy=0; joy.mag=0;
  // Prime fireT — shot fires on the very next update frame
  fireT = 1/(UPG.sps*2);
}

cv.addEventListener('mousedown',  e=>{ joyStart(e.clientX,e.clientY); });
cv.addEventListener('mousemove',  e=>{ joyMove(e.clientX,e.clientY); });
cv.addEventListener('mouseup',    ()=>joyEnd());
cv.addEventListener('mouseleave', ()=>joyEnd());

cv.addEventListener('touchstart', e=>{ e.preventDefault(); const t=e.touches[0]; joyStart(t.clientX,t.clientY); },{passive:false});
cv.addEventListener('touchmove',  e=>{ e.preventDefault(); const t=e.touches[0]; joyMove(t.clientX,t.clientY); },{passive:false});
cv.addEventListener('touchend',   e=>{ e.preventDefault(); joyEnd(); },{passive:false});
cv.addEventListener('touchcancel',e=>{ e.preventDefault(); joyEnd(); },{passive:false});

document.getElementById('btn-start').onclick=()=>{
  document.getElementById('s-start').classList.add('off');
  init();gstate='playing';lastT=performance.now();raf=requestAnimationFrame(loop);
};
document.getElementById('btn-restart').onclick=()=>{
  document.getElementById('s-go').classList.add('off');
  init();gstate='playing';lastT=performance.now();raf=requestAnimationFrame(loop);
};

draw(0);
