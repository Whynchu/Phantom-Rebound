const VERSION = { num: '1.20.29', label: 'D4.6 SNAPSHOT CONTRACT FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






