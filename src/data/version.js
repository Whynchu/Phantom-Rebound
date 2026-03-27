const VERSION = { num: '0.67', label: 'HUD Cleanup' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
