const VERSION = { num: '1.20.64', label: 'D18.15a - spectators can walk + frown' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






