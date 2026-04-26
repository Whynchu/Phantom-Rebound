const VERSION = { num: '1.20.89', label: 'R0.4 step 4a: bullet homing steer extracted to pure helper' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






