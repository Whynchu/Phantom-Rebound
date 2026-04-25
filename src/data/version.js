const VERSION = { num: '1.20.85', label: 'R0.4 step 1: simState schema + restore coverage for slot timers' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






