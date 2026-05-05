const VERSION = { num: '1.10.0', label: 'BOON SIGNALS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
