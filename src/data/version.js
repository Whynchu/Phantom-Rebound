const VERSION = { num: '1.20.76', label: 'R0.4 chunk 3 - score/kills/scoreBreakdown bridged to SimState' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






