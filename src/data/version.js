const VERSION = { num: '1.20.121', label: 'D20.5 GUEST SIMTICK SYNC FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };