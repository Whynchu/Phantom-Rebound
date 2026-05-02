const VERSION = { num: '1.6.1', label: 'ORB SAFETY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
