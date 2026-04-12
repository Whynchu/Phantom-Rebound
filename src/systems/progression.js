function applyDamagelessRoomProgression({
  tookDamageThisRoom,
  damagelessRooms,
  boonRerolls,
  streakThreshold = 3,
  rerollCap = 3,
}) {
  if(tookDamageThisRoom) {
    return {
      damagelessRooms: 0,
      boonRerolls,
      awardedReroll: false,
    };
  }

  const nextDamagelessRooms = damagelessRooms + 1;
  if(nextDamagelessRooms >= streakThreshold) {
    return {
      damagelessRooms: 0,
      boonRerolls: Math.min(rerollCap, boonRerolls + 1),
      awardedReroll: true,
    };
  }

  return {
    damagelessRooms: nextDamagelessRooms,
    boonRerolls,
    awardedReroll: false,
  };
}

export { applyDamagelessRoomProgression };
