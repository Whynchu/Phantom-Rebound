const VERSION = { num: '1.20.84', label: 'R0.4 chunks 1-2: player movement + substep extracted' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






