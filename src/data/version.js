const VERSION = { num: '1.3.6', label: 'ROOM LAYOUTS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
