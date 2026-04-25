const VERSION = { num: '1.20.47', label: 'Coop end-of-run rematch screen' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






