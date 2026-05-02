const VERSION = { num: '1.8.1', label: 'DAMAGE FLOOR' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
