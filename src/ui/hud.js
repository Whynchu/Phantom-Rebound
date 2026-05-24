function formatRunTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderHud({
  roomIndex,
  runElapsedMs,
  score,
  charge,
  maxCharge,
  sps,
  overflowBuffer = 0,
  overflowBufferMax = 0,
  elements,
}) {
  if(!elements) return;
  elements.roomCounter.textContent = `ROOM ${roomIndex + 1} • ${formatRunTime(runElapsedMs)}`;
  elements.scoreText.textContent = score;
  const chargePct = Math.max(0, Math.min(100, (charge / maxCharge) * 100));
  elements.chargeFill.style.width = `${chargePct}%`;
  // 1.11.0 OVERFLOW PROTOCOL — buffer overlay rides past the main fill.
  if (elements.chargeBufferFill) {
    const bufferPct = overflowBufferMax > 0
      ? Math.max(0, Math.min(100 - chargePct, (overflowBuffer / maxCharge) * 100))
      : 0;
    elements.chargeBufferFill.style.left = `${chargePct}%`;
    elements.chargeBufferFill.style.width = `${bufferPct}%`;
  }
  const bufferDisplay = overflowBuffer >= 1 ? ` +${Math.floor(overflowBuffer)}` : '';
  elements.chargeBadge.textContent = `${Math.floor(charge)} / ${maxCharge}${bufferDisplay}`;
  elements.spsNumber.textContent = sps.toFixed(1);
}

export { formatRunTime, renderHud };
