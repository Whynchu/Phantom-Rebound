const VERSION = { num: '1.20.87', label: 'R0.4 step 2: black-box replay harness + hostSimStep wired with player movement' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






