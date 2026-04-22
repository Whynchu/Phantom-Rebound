// Panel manager: centralizes the mutual-exclusion open/close behavior for
// the top-level overlay panels (patch notes, version, settings, hats,
// contributors). Each panel registers its element and optional hooks; the
// manager handles the "opening one closes the others" logic, the .off class
// toggle, and the aria-hidden update.
//
// Hook contract per panel:
//   el              — the DOM element (required; panel is a no-op if null)
//   renderOnOpen?   — called before the panel is shown (use for lazy content)
//   beforeOpen?     — called on the transition to open, before renderOnOpen
//   beforeClose?    — called on the transition to close, before the DOM flip
//   afterOpen?      — called after the panel is shown
//   customToggle?   — if provided, replaces the default .off/aria-hidden flip
//                     (receives isOpen). Useful for panels with extra a11y
//                     side-effects (e.g., patch-notes focus management).
function createPanelManager({ panels = {} } = {}) {
  const registry = new Map();
  for (const [id, cfg] of Object.entries(panels)) {
    registry.set(id, cfg);
  }

  function defaultToggle(el, isOpen) {
    el.classList.toggle('off', !isOpen);
    el.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }

  function setOpen(id, isOpen) {
    const cfg = registry.get(id);
    if (!cfg || !cfg.el) return;

    if (isOpen) {
      // Close every other registered panel first so only one is open at a
      // time. We always call setOpen(false) on them (even if they appear
      // closed) so that beforeClose hooks can run the side-effects the
      // legacy code depended on (e.g., restoring the pause panel).
      for (const [otherId, otherCfg] of registry) {
        if (otherId === id) continue;
        if (!otherCfg || !otherCfg.el) continue;
        setOpen(otherId, false);
      }
      cfg.beforeOpen?.();
      cfg.renderOnOpen?.();
    } else {
      cfg.beforeClose?.();
    }

    if (cfg.customToggle) {
      cfg.customToggle(isOpen);
    } else {
      defaultToggle(cfg.el, isOpen);
    }

    if (isOpen) cfg.afterOpen?.();
  }

  return { setOpen };
}

export { createPanelManager };
