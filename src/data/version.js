const VERSION = { num: '1.20.51', label: 'D18.4 — Desktop canvas pinned to phone width' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






