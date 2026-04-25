const VERSION = { num: '1.20.79', label: 'R0.4 chunk 6 - bridge slot 0 body + metrics into SimState' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






