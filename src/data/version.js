const VERSION = { num: '1.20.152', label: 'PROJECTILE FIXES' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
