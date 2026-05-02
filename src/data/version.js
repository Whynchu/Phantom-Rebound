const VERSION = { num: '1.5.3', label: 'REWARD STATS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
