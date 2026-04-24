const VERSION = { num: '1.20.25', label: 'D4B BULLET IDS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






