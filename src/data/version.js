const VERSION = { num: '1.09', label: 'Phase 4: Zone Control' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
