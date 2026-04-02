const VERSION = { num: '0.79d', label: 'Shield & Rebound' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
