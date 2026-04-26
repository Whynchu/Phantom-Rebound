const VERSION = { num: '1.20.104', label: 'R0.4 step 11 — Region E (shield collision) carved into pure module' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };