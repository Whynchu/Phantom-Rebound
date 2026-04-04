const VERSION = { num: '1.02', label: 'Purple Zoner Unlock Delay' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
