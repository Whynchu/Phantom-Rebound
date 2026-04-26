const VERSION = { num: '1.20.118', label: 'D20.2 GUEST FEEL + BOON FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };