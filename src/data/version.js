const VERSION = { num: '1.4.13', label: 'PICKUP POP' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
