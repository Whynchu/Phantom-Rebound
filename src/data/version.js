const VERSION = { num: '1.20.114', label: 'R4 EFFECTQUEUE DRAIN WIRED' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };