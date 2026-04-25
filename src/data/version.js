const VERSION = { num: '1.20.46', label: 'D14 — Per-peer boon picks (slot-1 safe whitelist)' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






