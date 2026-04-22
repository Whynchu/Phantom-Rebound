function computeKillScore(points) {
  return Number(points) || 0;
}

function computeRoomClearBonuses(room) {
  if (!room) return { clear: 0, pace: 0, flawless: 0, boss: 0 };
  const roomNumber = Number(room.room) || 0;
  const clearMs = Number(room.clearMs) || 0;
  const clearSec = clearMs / 1000;

  const clear = 15 + roomNumber * 3;

  let pace = 0;
  if (clearSec > 0 && clearSec < 30) {
    pace = Math.min(90, Math.round((30 - clearSec) * 4));
  }

  const flawless = room.damageless ? (25 + roomNumber * 2) : 0;

  const boss = room.boss ? (200 + roomNumber * 8) : 0;

  return { clear, pace, flawless, boss };
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
