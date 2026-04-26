const VERSION = { num: '1.20.132', label: 'R4.2 STALL INDICATOR + BUFFER TUNING' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };