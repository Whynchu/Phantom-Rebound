function computeKillScore(points) {
  return Number(points) || 0;
}

function computeRoomClearBonuses(room, context = {}) {
  if (!room) return { clear: 0, pace: 0, efficiency: 0, flawless: 0, boss: 0, density: 0, clutch: 0, accuracy: 0, dodge: 0 };
  const maxHp = Math.max(1, Number(context.maxHp) || 100);
  const roomNumber = Number(room.room) || 0;
  const clearMs = Number(room.clearMs) || 0;
  const clearSec = Math.max(0.1, clearMs / 1000);
  const hpLost = Math.max(0, Number(room.hpLost) || 0);
  const hpEnd = Math.max(0, Number(room.hpEnd) || 0);
  const kills = Math.max(0, Number(room.kills) || 0);
  const shotsFired = Math.max(0, Number(room.shotsFired) || 0);
  const nearMisses = Math.max(0, Number(room.nearMisses) || 0);

  const depthScale = 1 + roomNumber * 0.08;

  const clear = Math.round(15 * depthScale + roomNumber * 2);

  // Continuous pace curve: every second matters, diminishing returns, no hard cap
  const paceBase = 600 / (clearSec + 3);
  const pace = Math.round(paceBase * depthScale);

  // HP efficiency: scales with % HP kept. Only awarded when damage was taken
  // (flawless has its own separate, larger bonus so zero-damage rooms don't get both).
  const hpPctKept = Math.max(0, Math.min(1, 1 - hpLost / maxHp));
  const efficiencyCap = Math.round(30 * depthScale + roomNumber);
  const efficiency = hpLost > 0 ? Math.round(hpPctKept * efficiencyCap) : 0;

  const flawless = room.damageless ? Math.round(25 * depthScale + roomNumber * 2) : 0;

  const boss = room.boss ? Math.round(200 * depthScale + roomNumber * 5) : 0;

  // Combat density: kills per second. Rewards AOE / sweep builds.
  const kps = kills / clearSec;
  const density = Math.round(kps * 10 * depthScale);

  // Clutch: ended room at <=25% HP after taking damage this room. Rewards risk-takers.
  const clutch = (hpLost > 0 && hpEnd / maxHp <= 0.25) ? Math.round(60 * depthScale) : 0;

  // Accuracy: kills / shots fired. Rewards precision builds.
  const accuracy = shotsFired > 0
    ? Math.round((kills / shotsFired) * (40 * depthScale + roomNumber))
    : 0;

  // Dodge: near-miss count. Rewards evasion.
  const dodge = Math.round(nearMisses * (4 + roomNumber * 0.3) * depthScale);

  return { clear, pace, efficiency, flawless, boss, density, clutch, accuracy, dodge };
}

function computeFiveRoomCheckpointBonus(rooms) {
  if(!Array.isArray(rooms) || rooms.length < 5) return 0;
  const recentRooms = rooms.slice(-5);
  if(recentRooms.some((room) => room.end !== 'clear')) return 0;

  const lastRoom = recentRooms[recentRooms.length - 1];
  const roomNumber = Number(lastRoom?.room) || 0;
  if(roomNumber % 5 !== 0) return 0;

  const totalClearMs = recentRooms.reduce((sum, room) => sum + (room.clearMs || 0), 0);
  const totalHpLost = recentRooms.reduce((sum, room) => sum + (room.hpLost || 0), 0);
  const damagelessCount = recentRooms.reduce((sum, room) => sum + (room.damageless ? 1 : 0), 0);
  const avgClearSeconds = Math.max(6, (totalClearMs / recentRooms.length) / 1000);
  const baseBonus = 260 + roomNumber * 26;
  const paceMultiplier = Math.max(0.65, Math.min(1.75, 26 / avgClearSeconds));
  const avoidanceMultiplier = Math.max(0.55, Math.min(1.4, 1.35 - totalHpLost / 320));
  const consistencyBonus = damagelessCount * 40;

  return Math.round(baseBonus * paceMultiplier * avoidanceMultiplier + consistencyBonus);
}

export { computeKillScore, computeRoomClearBonuses, computeFiveRoomCheckpointBonus };
