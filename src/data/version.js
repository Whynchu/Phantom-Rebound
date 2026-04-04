const VERSION = { num: '0.99', label: 'Room 30+ Enemy Balance' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
