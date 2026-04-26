const VERSION = { num: '1.20.88', label: 'R0.4 step 3: post-movement tick block extracted to pure helper' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






