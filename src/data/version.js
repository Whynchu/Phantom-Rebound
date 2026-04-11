const VERSION = { num: '1.16.43', label: 'BOSS SCAR TUNING' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
