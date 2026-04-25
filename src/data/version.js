const VERSION = { num: '1.20.74', label: 'R0.4 chunk 1 - nextEnemyId migrated to SimState' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






