const VERSION = { num: '1.20.91', label: 'R0.4 step 4c: bullet substep integration + wall bounce extracted to pure helper' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






