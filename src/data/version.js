const VERSION = { num: '1.6.2', label: 'ORB SAFETY 2' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
