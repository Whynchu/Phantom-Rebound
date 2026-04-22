const VERSION = { num: '1.19.25', label: 'BOON HOOKS: ROOM START' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






