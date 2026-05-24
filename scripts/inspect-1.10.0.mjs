// Dump structure of one boons cell + telemetry for inspection.
import fs from 'node:fs';
const raw = fs.readFileSync('supabase/scores/1.10.0.txt', 'utf8');
function parseCSV(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')q=false;else cell+=c}else{if(c==='"')q=true;else if(c===',')row.push(cell),cell='';else if(c==='\n')row.push(cell),rows.push(row),row=[],cell='';else if(c==='\r'){}else cell+=c}}if(cell.length||row.length){row.push(cell);rows.push(row)}return rows}
const t = parseCSV(raw); const h = t.shift();
const data = t.filter(r=>r.length===h.length).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])));
const b = JSON.parse(data[0].boons);
console.log('TOP KEYS:', Object.keys(b));
console.log('PICK[0]:', JSON.stringify(b.picks?.[0], null, 2));
console.log('PICK[3]:', JSON.stringify(b.picks?.[3], null, 2));
if (b.telemetry) {
  console.log('\nTELEMETRY KEYS:', Object.keys(b.telemetry));
  console.log('SUMMARY:', JSON.stringify(b.telemetry.summary, null, 2)?.slice(0, 1500));
  console.log('\nROOMS[0]:', JSON.stringify(b.telemetry.rooms?.[0], null, 2));
  console.log('ROOMS[5]:', JSON.stringify(b.telemetry.rooms?.[5], null, 2));
  console.log('SNAPSHOT[0]:', JSON.stringify(b.telemetry.snapshots?.[0], null, 2)?.slice(0, 800));
}
console.log('\nboon_order sample:', data[0].boon_order?.slice(0, 300));
