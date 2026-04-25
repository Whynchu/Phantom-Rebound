const VERSION = { num: '1.20.54', label: 'D18.8 — coop end-screen parity + wait overlay' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






