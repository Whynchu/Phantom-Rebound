const VERSION = { num: '1.10', label: 'Phase 5: Bullet Alchemy' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
