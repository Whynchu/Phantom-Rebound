const VERSION = { num: '1.16.50', label: 'SUSTAIN BRAKE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
