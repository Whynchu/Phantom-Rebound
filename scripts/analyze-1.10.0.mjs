// One-off analysis of supabase/scores/1.10.0.txt (CSV).
// Tolerant CSV parser that handles embedded quoted JSON.
import fs from 'node:fs';

const raw = fs.readFileSync('supabase/scores/1.10.0.txt', 'utf8');

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i+1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c === '\r') {}
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const table = parseCSV(raw);
const header = table.shift();
const data = table.filter(r => r.length === header.length).map(r => {
  const o = {};
  header.forEach((h, i) => o[h] = r[i]);
  return o;
});

console.log(`Total entries: ${data.length}`);
console.log(`Columns: ${header.join(', ')}`);
console.log();

// Score / room basics
const scores = data.map(r => +r.score).filter(Number.isFinite).sort((a,b)=>b-a);
const rooms = data.map(r => +r.room).filter(Number.isFinite).sort((a,b)=>b-a);
const median = arr => arr.length ? arr[Math.floor(arr.length/2)] : 0;
const pct = (arr, p) => arr.length ? arr[Math.floor(arr.length * (1-p))] : 0;

console.log('SCORE distribution');
console.log(`  max ${scores[0]} / p90 ${pct(scores,0.9)} / median ${median(scores)} / min ${scores.at(-1)}`);
console.log('ROOM distribution');
console.log(`  max ${rooms[0]} / p90 ${pct(rooms,0.9)} / median ${median(rooms)} / min ${rooms.at(-1)}`);

const roomBuckets = {};
for (const r of rooms) {
  const b = r < 5 ? '01-04' : r < 10 ? '05-09' : r < 15 ? '10-14' : r < 20 ? '15-19' : r < 25 ? '20-24' : r < 30 ? '25-29' : '30+';
  roomBuckets[b] = (roomBuckets[b]||0)+1;
}
console.log('\nROOM buckets (where do players die?)');
for (const k of Object.keys(roomBuckets).sort()) console.log(`  ${k}: ${roomBuckets[k]}`);

// Players
const byName = {};
for (const r of data) {
  byName[r.player_name] = byName[r.player_name] || { runs: 0, best: 0, totalRooms: 0 };
  byName[r.player_name].runs++;
  byName[r.player_name].best = Math.max(byName[r.player_name].best, +r.score||0);
  byName[r.player_name].totalRooms += +r.room||0;
}
const topPlayers = Object.entries(byName).sort((a,b)=>b[1].runs - a[1].runs).slice(0,15);
console.log('\nMOST ACTIVE PLAYERS (runs / best score / avg room)');
for (const [name, s] of topPlayers) console.log(`  ${name.padEnd(14)} runs=${String(s.runs).padStart(3)}  best=${String(s.best).padStart(7)}  avgRoom=${(s.totalRooms/s.runs).toFixed(1)}`);
console.log(`\nUnique players: ${Object.keys(byName).length}`);

// Color distribution
const colors = {};
for (const r of data) colors[r.player_color || 'green'] = (colors[r.player_color||'green']||0)+1;
console.log('\nCOLOR popularity');
for (const [c,n] of Object.entries(colors).sort((a,b)=>b[1]-a[1])) console.log(`  ${c.padEnd(8)} ${n}`);

// Boon analysis
const boonCount = {};
const firstPickCount = {};
const lastBoons = {};
const orderHist = {}; // boon -> sum of order index (avg pick position)
const orderN = {};
let runsWithBoons = 0;
let totalPicks = 0;

const telemetrySources = { healing: {}, charge: {}, hpLost: 0, runs: 0 };
const endsByRoom = {};
const layoutSources = {};
const enemyTypeCount = {};
const roomPressureSamples = [];
const roomClearTimes = []; // per room number
const roomDamage = [];

for (const r of data) {
  let b;
  try { b = JSON.parse(r.boons); } catch { continue; }
  if (!b) continue;
  const picks = Array.isArray(b) ? b : (b.picks || []);
  if (!picks.length) continue;
  runsWithBoons++;
  totalPicks += picks.length;
  const nameOf = p => typeof p === 'string' ? p : (p?.name || p?.id || p?.title || JSON.stringify(p).slice(0,40));
  picks.forEach((p, i) => {
    const n = nameOf(p);
    boonCount[n] = (boonCount[n]||0)+1;
    orderHist[n] = (orderHist[n]||0)+i;
    orderN[n] = (orderN[n]||0)+1;
  });
  const fp = nameOf(picks[0]); firstPickCount[fp] = (firstPickCount[fp]||0)+1;
  const lp = nameOf(picks.at(-1)); lastBoons[lp] = (lastBoons[lp]||0)+1;

  // telemetry
  const t = b.telemetry;
  if (t) {
    telemetrySources.runs++;
    if (t.summary) {
      const s = t.summary;
      if (s.heal) for (const [k,v] of Object.entries(s.heal)) telemetrySources.healing[k] = (telemetrySources.healing[k]||0)+v;
      if (s.charge) for (const [k,v] of Object.entries(s.charge)) telemetrySources.charge[k] = (telemetrySources.charge[k]||0)+v;
      if (typeof s.totalHpLost === 'number') telemetrySources.hpLost += s.totalHpLost;
      telemetrySources.kills = (telemetrySources.kills||0) + (s.totalKills||0);
      telemetrySources.shots = (telemetrySources.shots||0) + (s.totalShotsFired||0);
      telemetrySources.chargeSpent = (telemetrySources.chargeSpent||0) + (s.totalChargeSpent||0);
      telemetrySources.chargeWasted = (telemetrySources.chargeWasted||0) + (s.totalChargeWasted||0);
      telemetrySources.fullChargeMs = (telemetrySources.fullChargeMs||0) + (s.totalFullChargeMs||0);
      telemetrySources.firingReadyMs = (telemetrySources.firingReadyMs||0) + (s.totalFiringReadyMs||0);
      telemetrySources.movingNoFireMs = (telemetrySources.movingNoFireMs||0) + (s.totalMovingNoFireMs||0);
      telemetrySources.phaseDashProcs = (telemetrySources.phaseDashProcs||0) + (s.totalPhaseDashProcs||0);
      telemetrySources.mirrorTideProcs = (telemetrySources.mirrorTideProcs||0) + (s.totalMirrorTideProcs||0);
      telemetrySources.shieldBlocks = (telemetrySources.shieldBlocks||0) + (s.totalShieldBlocks||0);
      telemetrySources.dangerBullets = (telemetrySources.dangerBullets||0) + (s.totalDangerBulletsSpawned||0);
    }
    if (Array.isArray(t.rooms)) {
      for (const rm of t.rooms) {
        const peak = rm.pressure?.peakEnemies;
        const dmg = (rm.damage?.contact||0) + (rm.damage?.projectile||0);
        const cms = rm.clearMs;
        if (typeof peak === 'number') roomPressureSamples.push({ room: rm.room, peak });
        if (typeof cms === 'number') roomClearTimes.push({ room: rm.room, ms: cms });
        roomDamage.push({ room: rm.room, dmg });
        // track end-state outcomes per room
        endsByRoom[rm.room] = endsByRoom[rm.room] || {};
        endsByRoom[rm.room][rm.end||'?'] = (endsByRoom[rm.room][rm.end||'?']||0)+1;
        // layout source diversity
        if (rm.layoutSource) layoutSources[rm.layoutSource] = (layoutSources[rm.layoutSource]||0)+1;
        // enemy type usage
        if (Array.isArray(rm.layout)) {
          for (const wave of rm.layout) for (const e of wave||[]) {
            if (e?.t) enemyTypeCount[e.t] = (enemyTypeCount[e.t]||0)+(e.n||1);
          }
        }
      }
    }
  }
}

console.log(`\nBOON DATA: ${runsWithBoons} runs with picks, avg picks/run ${(totalPicks/runsWithBoons).toFixed(1)}`);
console.log('\nTOP 20 PICKED BOONS (count / avg pick order)');
const ranked = Object.entries(boonCount).sort((a,b)=>b[1]-a[1]).slice(0,20);
for (const [name, n] of ranked) console.log(`  ${name.padEnd(20)} ${String(n).padStart(4)}  avgOrder=${(orderHist[name]/orderN[name]).toFixed(1)}`);

console.log('\nLEAST PICKED BOONS (bottom 10)');
for (const [name, n] of Object.entries(boonCount).sort((a,b)=>a[1]-b[1]).slice(0,10)) console.log(`  ${name.padEnd(20)} ${n}`);

console.log('\nMOST COMMON FIRST PICK (opening move)');
for (const [name, n] of Object.entries(firstPickCount).sort((a,b)=>b[1]-a[1]).slice(0,10)) console.log(`  ${name.padEnd(20)} ${n}`);

console.log('\nLATE-RUN FINAL PICKS (what they grab last)');
for (const [name, n] of Object.entries(lastBoons).sort((a,b)=>b[1]-a[1]).slice(0,10)) console.log(`  ${name.padEnd(20)} ${n}`);

// Telemetry digest
if (telemetrySources.runs) {
  console.log(`\nTELEMETRY (${telemetrySources.runs} runs)`);
  console.log('  Total HP lost:', telemetrySources.hpLost);
  console.log('  Healing by source (top 8):');
  for (const [k,v] of Object.entries(telemetrySources.healing).sort((a,b)=>b[1]-a[1]).slice(0,8)) console.log(`    ${k.padEnd(20)} ${v.toFixed(0)}`);
  console.log('  Charge by source (top 8):');
  for (const [k,v] of Object.entries(telemetrySources.charge).sort((a,b)=>b[1]-a[1]).slice(0,8)) console.log(`    ${k.padEnd(20)} ${v.toFixed(0)}`);
}

// Room pressure / damage by room number
const roomAgg = {};
for (const s of roomPressureSamples) {
  roomAgg[s.room] = roomAgg[s.room] || { peaks: [], dmgs: [], times: [] };
  roomAgg[s.room].peaks.push(s.peak);
}
for (const s of roomDamage) (roomAgg[s.room] = roomAgg[s.room]||{peaks:[],dmgs:[],times:[]}).dmgs.push(s.dmg);
for (const s of roomClearTimes) (roomAgg[s.room] = roomAgg[s.room]||{peaks:[],dmgs:[],times:[]}).times.push(s.ms);
const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;

console.log('\nROOM-LEVEL PRESSURE & DAMAGE (room: avg peak / avg dmg / avg clear sec / n)');
const sortedRooms = Object.keys(roomAgg).map(Number).sort((a,b)=>a-b);
for (const rn of sortedRooms.slice(0, 35)) {
  const a = roomAgg[rn];
  console.log(`  R${String(rn).padStart(2)}  peak=${avg(a.peaks).toFixed(2)}  dmg=${avg(a.dmgs).toFixed(1)}  clear=${(avg(a.times)/1000).toFixed(1)}s  n=${a.peaks.length}`);
}

console.log('\nENEMY TYPE EXPOSURE (sum across all rooms in all runs)');
for (const [k,v] of Object.entries(enemyTypeCount).sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(16)} ${v}`);

console.log('\nLAYOUT SOURCE FREQUENCY (top 20)');
for (const [k,v] of Object.entries(layoutSources).sort((a,b)=>b[1]-a[1]).slice(0,20)) console.log(`  ${k.padEnd(24)} ${v}`);

console.log('\nROOM OUTCOMES (death = end != clear) — rooms where players actually die');
const deathRooms = Object.entries(endsByRoom).map(([r,obj])=>{
  const total = Object.values(obj).reduce((a,b)=>a+b,0);
  const deaths = total - (obj.clear||0);
  return { r:+r, total, deaths, rate: deaths/total };
}).filter(x=>x.deaths>0).sort((a,b)=>b.deaths-a.deaths).slice(0,20);
for (const d of deathRooms) console.log(`  R${String(d.r).padStart(2)}  deaths=${d.deaths}/${d.total}  (${(d.rate*100).toFixed(0)}%)`);

console.log('\nKEY RATIOS');
const tt = telemetrySources;
const accuracy = tt.kills && tt.shots ? (tt.kills / tt.shots * 100).toFixed(1) : 'n/a';
const wasteRatio = tt.chargeSpent ? (tt.chargeWasted / (tt.chargeSpent + tt.chargeWasted) * 100).toFixed(1) : 'n/a';
console.log(`  Kills per shot: ${accuracy}%  (${tt.kills} kills / ${tt.shots} shots)`);
console.log(`  Charge wasted: ${wasteRatio}%  (overflow at full charge)`);
console.log(`  Time at full charge (cap waiting): ${(tt.fullChargeMs/1000).toFixed(0)}s across all runs`);
console.log(`  Moving-no-fire time: ${(tt.movingNoFireMs/1000).toFixed(0)}s (player dodging without shooting)`);
console.log(`  PhaseDash procs: ${tt.phaseDashProcs}  MirrorTide: ${tt.mirrorTideProcs}  Shield blocks: ${tt.shieldBlocks}`);
console.log(`  Danger bullets spawned: ${tt.dangerBullets}  HP lost: ${tt.hpLost}`);

// Duration
const durs = data.map(r => +r.duration_seconds).filter(n => Number.isFinite(n) && n > 0).sort((a,b)=>a-b);
if (durs.length) {
  console.log(`\nDURATION (s): min=${durs[0]}  median=${durs[Math.floor(durs.length/2)]}  p90=${durs[Math.floor(durs.length*0.9)]}  max=${durs.at(-1)}`);
}
