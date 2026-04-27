const VERSION = { num: '1.20.147', label: 'ROLLBACK INPUT STABILITY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };