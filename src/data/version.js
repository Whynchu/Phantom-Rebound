const VERSION = { num: '1.20.86', label: 'R0.4 step 1.5: slot timers wired to simState as canonical truth' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






