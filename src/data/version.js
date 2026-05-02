const VERSION = { num: '1.4.19', label: 'ENEMY CURVE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
