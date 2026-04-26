const VERSION = { num: '1.20.115', label: 'R4 PAUSE-INTRO SAFETY + STALL DETECT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };