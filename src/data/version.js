const VERSION = { num: '0.91', label: 'Critical HP Rebalance' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
