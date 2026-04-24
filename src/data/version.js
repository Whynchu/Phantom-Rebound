const VERSION = { num: '1.20.38', label: 'D12 LATENCY + AUTOFIRE FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






