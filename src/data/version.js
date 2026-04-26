const VERSION = { num: '1.20.134', label: 'DR-0: hostRemoteInputProcessor + bulletSpawnDetector retired' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };