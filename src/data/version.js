const VERSION = { num: '1.20.71', label: 'D19.6a/b/c - snapshot rate 4 to 3, slot-1 speedMult parity, obstacle-aware reconciler replay' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






