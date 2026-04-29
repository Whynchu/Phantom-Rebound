const VERSION = { num: '1.3.3', label: 'EARLY POWER FOLLOW-UP' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
