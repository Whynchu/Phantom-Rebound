const VERSION = { num: '1.15.1', label: 'Color Overhaul' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
