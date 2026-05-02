const VERSION = { num: '1.8.0', label: 'ORB TUNE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
