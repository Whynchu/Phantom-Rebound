function getProjectileDamageCurve(roomIndex = 0) {
  const room = Number.isFinite(roomIndex) ? roomIndex : 0;
  if(room <= 5) return 0.9;
  if(room <= 10) return 0.9 + (room - 5) * 0.01;
  if(room <= 20) return 0.95;
  if(room <= 30) return 0.95 + (room - 20) * 0.005;
  return 1;
}

function computeProjectileHitDamage({
  roomIndex = 0,
  bossDamageMultiplier = 1,
  damageTakenMultiplier = 1,
  lateBloomDamageTakenMultiplier = 1,
  multiplier = 1,
}) {
  const room = Number.isFinite(roomIndex) ? roomIndex : 0;
  const tierOver = Math.max(0, room - 29);
  const dmgScale = (1 + Math.log(room + 1) * 0.24) * (tierOver > 0 ? 1 + tierOver * 0.04 : 1);
  const rawDamage = Math.ceil(18 * dmgScale * getProjectileDamageCurve(room));
  const finalDamage = rawDamage * bossDamageMultiplier * damageTakenMultiplier * lateBloomDamageTakenMultiplier * multiplier;
  return Math.max(1, Math.ceil(finalDamage));
}

export { getProjectileDamageCurve, computeProjectileHitDamage };
