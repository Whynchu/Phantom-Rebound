const VERSION = { num: '1.20.95', label: 'R0.5 cross-engine determinism: Fisher-Yates shuffle replaces random-comparator sort' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






