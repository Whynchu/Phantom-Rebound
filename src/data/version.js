const VERSION = { num: '1.20.83', label: 'R2 rollback buffer + R3.1 coordinator wired (flag-gated)' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






