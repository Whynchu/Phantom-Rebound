const VERSION = { num: '1.16.46', label: 'RUN CLOCK FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
