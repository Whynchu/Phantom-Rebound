const VERSION = { num: '1.16.31', label: 'BUILD DIVERSITY PASS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
