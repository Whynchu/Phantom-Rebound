const VERSION = { num: '1.4.12', label: 'LOUDER POP' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
