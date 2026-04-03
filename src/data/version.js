const VERSION = { num: '0.81a', label: 'Blue Triangle' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
