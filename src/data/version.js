const VERSION = { num: '1.4.18', label: 'ENEMY DAMAGE RANGE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
