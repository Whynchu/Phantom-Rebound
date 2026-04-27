const VERSION = { num: '1.20.143', label: 'DR-2: fix W/H scope errors in simStepOpts crashing coordinator step' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };