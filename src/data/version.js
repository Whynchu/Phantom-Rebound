const VERSION = { num: '1.4.16', label: 'DAMAGE RANGE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
