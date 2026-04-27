const VERSION = { num: '1.20.148', label: 'ROLLBACK INPUT BATCHING' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };