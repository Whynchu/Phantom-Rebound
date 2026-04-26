const VERSION = { num: '1.20.90', label: 'R0.4 step 4b: danger bullet gravity-well steering extracted to pure helper' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






