const VERSION = { num: '1.3.1', label: 'PROJECTILE FIXES' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
