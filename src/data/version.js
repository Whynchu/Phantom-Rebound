const VERSION = { num: '0.90', label: 'Legendary Rebalance' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
