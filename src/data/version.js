const VERSION = { num: '1.7.5', label: 'CRIT REWORK' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
