// Fixed simulation world size, decoupled from per-device canvas size.
//
// Phase D0a (2026-04-24): the sim is authoritative over WORLD_W/WORLD_H.
// In solo and ?coopdebug=1, the browser mirrors WORLD_W/WORLD_H from the
// canvas size so existing single-device behavior is byte-identical. In
// online coop the host pins a fixed world size and both peers render the
// same arena scaled into their own canvas via a ctx transform.
//
// Pure module — no DOM references, safe to import in Node tests and in the
// browser sim.

export function createWorldSpace(initialWidth = 0, initialHeight = 0) {
  let width = initialWidth | 0;
  let height = initialHeight | 0;

  function get() {
    return { width, height };
  }

  function set(w, h) {
    const nextW = w | 0;
    const nextH = h | 0;
    if (nextW <= 0 || nextH <= 0) {
      throw new Error(`worldSpace: width/height must be positive (got ${w}, ${h})`);
    }
    width = nextW;
    height = nextH;
  }

  // Compute the scale factors needed to render world-space into a canvas
  // of the given pixel size. Returns {x: 1, y: 1} when canvas matches world.
  function getRenderScale(canvasWidth, canvasHeight) {
    const sx = width > 0 ? canvasWidth / width : 1;
    const sy = height > 0 ? canvasHeight / height : 1;
    return { x: sx, y: sy };
  }

  return {
    get,
    set,
    getRenderScale,
    get width() { return width; },
    get height() { return height; },
  };
}
