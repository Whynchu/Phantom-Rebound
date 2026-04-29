const VERSION = { num: '1.3.2', label: 'EARLY POWER REBALANCE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
