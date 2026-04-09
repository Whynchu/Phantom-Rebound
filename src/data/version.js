const VERSION = { num: '1.16.22', label: 'GLOBAL SPEED LIFT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
