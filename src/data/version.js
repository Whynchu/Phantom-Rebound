const VERSION = { num: '1.20.139', label: 'DR-2: fix restoreState P2 fields, double simNowMs, opts.gate resim bug' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };