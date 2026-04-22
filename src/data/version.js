const VERSION = { num: '1.19.9', label: 'HAT EXTRACTION (REFACTOR)' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






