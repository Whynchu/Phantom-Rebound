const VERSION = { num: '1.20.140', label: 'DR-2: diagnostic logging for guest READY stall' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };