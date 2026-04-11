const VERSION = { num: '1.16.42', label: 'BERSERKER FLOOR' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
