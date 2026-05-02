const EXTENDED_ROOM_NAMES = ['FRENZY', 'OVERRUN', 'DELUGE', 'STORM', 'NIGHTMARE', 'ABYSS', 'INFERNO', 'CHAOS'];

function getRoomDef(idx, { roomNames, bossRooms, generateWeightedWave }) {
  const roomNumber = idx + 1;
  const isLegacyBossRoom = roomNumber <= 40 && roomNumber % 10 === 0;
  const isLateBossRoom = [50, 70, 90, 100].includes(roomNumber) || (roomNumber >= 120 && (roomNumber - 120) % 20 === 0);

  if (isLegacyBossRoom || isLateBossRoom) {
    let bossConfig;
    if (bossRooms[idx]) {
      bossConfig = bossRooms[idx];
    } else {
      // Rooms 50+ cycle through boss types, but post-50 bosses only land every 20 rooms.
      const bossKeys = Object.keys(bossRooms).map(Number).sort((a, b) => a - b);
      const lateBossOrdinal = roomNumber <= 50
        ? Math.floor((idx - 9) / 10)
        : 4 + Math.floor((roomNumber - 60) / 20);
      const ci = lateBossOrdinal % bossKeys.length;
      const baseConfig = bossRooms[bossKeys[ci]];
      bossConfig = {
        ...baseConfig,
        name: roomNumber > 50 ? `${baseConfig.name} ++` : `${baseConfig.name} +`,
      };
    }

    const wave = [{ t: bossConfig.bossType, n: 1, d: 0, isBoss: true }];
    for (let i = 0; i < bossConfig.escortCount; i++) {
      wave.push({ t: bossConfig.escortType, n: 1, d: 0 });
    }

    if(roomNumber >= 50) {
      const strongerEscortType = roomNumber >= 90 ? 'orange_zoner' : 'purple_zoner';
      wave.push({ t: strongerEscortType, n: roomNumber >= 90 ? 2 : 1, d: 0 });
      wave.push({ t: 'purple_disruptor', n: 1 + Math.floor(bossConfig.escortCount / 2), d: 0 });
      wave.push({ t: 'triangle', n: roomNumber >= 90 ? 2 : 1, d: 0 });
      wave.push({ t: 'rusher', n: bossConfig.escortCount + 1, d: 0 });
    }

    if(roomNumber === 100) {
      const bossKeys = Object.keys(bossRooms).map(Number).sort((a, b) => a - b);
      const ci = (4 + Math.floor((roomNumber - 60) / 20)) % bossKeys.length;
      const secondaryConfig = bossRooms[bossKeys[(ci + 1) % bossKeys.length]];
      wave.push({ t: secondaryConfig.bossType, n: 1, d: 0, isBoss: true, bossScale: 2 });
      wave[0].bossScale = 2;
      wave.push({ t: 'orange_zoner', n: 2, d: 0 });
      wave.push({ t: 'purple_disruptor', n: 2, d: 0 });
      wave.push({ t: 'triangle', n: 2, d: 0 });
      wave.push({ t: 'rusher', n: 3, d: 0 });
    }

    return {
      name: roomNumber === 100 ? 'DOUBLE EXECUTION' : bossConfig.name,
      chaos: bossConfig.chaos,
      waves: [wave],
      layoutSource: 'boss',
      isBossRoom: true,
      bossType: bossConfig.bossType,
      escortType: bossConfig.escortType,
      escortCount: roomNumber >= 50 ? bossConfig.escortCount + (roomNumber >= 90 ? 2 : 1) : bossConfig.escortCount,
      bossEscortRespawnBonus: roomNumber >= 50 ? 1 : 0,
      bossDamageMultiplier: roomNumber === 100 ? 2 : 1,
    };
  }

  const name = idx < roomNames.length
    ? roomNames[idx]
    : EXTENDED_ROOM_NAMES[(idx - roomNames.length) % EXTENDED_ROOM_NAMES.length];
  const earlyGeneratedChaos = idx >= 12 && idx <= 14 ? 0.06 : 0;
  const chaos = Math.max(0, Math.min(0.65, idx * 0.035 - earlyGeneratedChaos));
  return {
    name,
    chaos,
    waves: [generateWeightedWave(idx)],
    layoutSource: 'generated',
  };
}

function getRoomMaxOnScreen(idx, isBossRoom) {
  if(isBossRoom) return 99;
  if(idx >= 160) return 24;
  if(idx >= 120) return 22;
  if(idx >= 100) return 20;
  if(idx >= 80) return 18;
  if(idx >= 60) return 16;
  if(idx >= 40) return 14;
  if(idx >= 20) return 12;
  return 99;
}

function getReinforcementIntervalMs(idx) {
  if(idx >= 40) return Infinity;
  if(idx >= 160) return 280;
  if(idx >= 120) return 360;
  if(idx >= 100) return 440;
  if(idx >= 80) return 520;
  if(idx >= 60) return 620;
  return 800;
}

function getBossEscortRespawnMs(idx) {
  if(idx >= 160) return 2800;
  if(idx >= 120) return 3400;
  if(idx >= 100) return 4200;
  if(idx >= 80) return 5000;
  if(idx >= 40) return 5800;
  return 9000;
}

export { getRoomDef, getRoomMaxOnScreen, getReinforcementIntervalMs, getBossEscortRespawnMs };
