function bindGestureGuards({
  doc = document,
  now = () => Date.now(),
  doubleTapWindowMs = 320,
} = {}) {
  let lastTouchEndAt = 0;
  let lastTouchStartAt = 0;

  const isFormTarget = (target) => Boolean(target && target.closest && target.closest('input, textarea, select'));

  const preventDefault = (event) => event.preventDefault();
  const preventSelectionOutsideInputs = (event) => {
    if(isFormTarget(event.target)) return;
    event.preventDefault();
  };
  const preventTouchStartDoubleTap = (event) => {
    if(isFormTarget(event.target)) return;
    const currentTime = now();
    if(currentTime - lastTouchStartAt < doubleTapWindowMs) {
      event.preventDefault();
    }
    lastTouchStartAt = currentTime;
  };
  const preventDoubleTap = (event) => {
    if(isFormTarget(event.target)) return;
    const currentTime = now();
    if(currentTime - lastTouchEndAt < doubleTapWindowMs) {
      event.preventDefault();
    }
    lastTouchEndAt = currentTime;
  };

  doc.addEventListener('contextmenu', preventDefault);
  doc.addEventListener('dblclick', preventDefault);
  doc.addEventListener('selectstart', preventSelectionOutsideInputs);
  doc.addEventListener('touchstart', preventTouchStartDoubleTap, { passive: false });
  doc.addEventListener('touchend', preventDoubleTap, { passive: false });
  doc.addEventListener('gesturestart', preventDefault, { passive: false });
  doc.addEventListener('gesturechange', preventDefault, { passive: false });
  doc.addEventListener('gestureend', preventDefault, { passive: false });

  return () => {
    doc.removeEventListener('contextmenu', preventDefault);
    doc.removeEventListener('dblclick', preventDefault);
    doc.removeEventListener('selectstart', preventSelectionOutsideInputs);
    doc.removeEventListener('touchstart', preventTouchStartDoubleTap, { passive: false });
    doc.removeEventListener('touchend', preventDoubleTap, { passive: false });
    doc.removeEventListener('gesturestart', preventDefault, { passive: false });
    doc.removeEventListener('gesturechange', preventDefault, { passive: false });
    doc.removeEventListener('gestureend', preventDefault, { passive: false });
  };
}

export { bindGestureGuards };
