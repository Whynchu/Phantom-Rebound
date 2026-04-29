const VERSION = { num: '1.3.4', label: 'EARLY POWER HOTFIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
