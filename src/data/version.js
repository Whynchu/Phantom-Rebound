const VERSION = { num: '1.20.49', label: 'Guest local-slot aim triangle + invuln blink' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






