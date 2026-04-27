const VERSION = { num: '1.20.149', label: 'ROLLBACK INTRO BARRIER' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };