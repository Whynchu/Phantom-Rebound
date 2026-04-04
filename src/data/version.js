const VERSION = { num: '1.11.6', label: 'Phase 6: Active Abilities' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
