const VERSION = { num: '1.7.4', label: 'ORB HOTFIX 2' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
