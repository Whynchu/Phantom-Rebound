const VERSION = { num: '1.20.154', label: 'GUEST INTRO LOCAL ADVANCE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
