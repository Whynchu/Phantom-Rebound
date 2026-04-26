const VERSION = { num: '1.20.131', label: 'R4 EFFECT DESCRIPTOR AUDIT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };