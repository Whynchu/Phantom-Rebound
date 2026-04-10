const VERSION = { num: '1.16.29', label: 'LOW CAP KINETIC' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
