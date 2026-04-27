const VERSION = { num: '1.20.152', label: 'H1+H2 COOP SNAPSHOT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
