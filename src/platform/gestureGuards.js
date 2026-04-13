function bindGestureGuards({
  doc = document,
  now = () => Date.now(),
  doubleTapWindowMs = 320,
} = {}) {
  let lastTouchEndAt = 0;

  const preventDefault = (event) => event.preventDefault();
  const preventDoubleTap = (event) => {
    const target = event.target;
    if(target && target.closest && target.closest('input, textarea, select')) return;
    const currentTime = now();
    if(currentTime - lastTouchEndAt < doubleTapWindowMs) {
      event.preventDefault();
    }
    lastTouchEndAt = currentTime;
  };

  doc.addEventListener('contextmenu', preventDefault);
  doc.addEventListener('dblclick', preventDefault);
  doc.addEventListener('touchend', preventDoubleTap, { passive: false });
  doc.addEventListener('gesturestart', preventDefault, { passive: false });
  doc.addEventListener('gesturechange', preventDefault, { passive: false });
  doc.addEventListener('gestureend', preventDefault, { passive: false });

  return () => {
    doc.removeEventListener('contextmenu', preventDefault);
    doc.removeEventListener('dblclick', preventDefault);
    doc.removeEventListener('touchend', preventDoubleTap, { passive: false });
    doc.removeEventListener('gesturestart', preventDefault, { passive: false });
    doc.removeEventListener('gesturechange', preventDefault, { passive: false });
    doc.removeEventListener('gestureend', preventDefault, { passive: false });
  };
}

export { bindGestureGuards };
