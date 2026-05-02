const VERSION = { num: '1.4.7', label: 'ESCORT BLINK' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
