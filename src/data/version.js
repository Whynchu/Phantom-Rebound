const VERSION = { num: '1.20.93', label: 'R0.4 step 4e: grey bullet decay + expiry extracted to pure helper' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






