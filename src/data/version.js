const VERSION = { num: '1.20.50', label: 'Coop unified teardown + disconnect watchdog' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






