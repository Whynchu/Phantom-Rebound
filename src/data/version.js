const VERSION = { num: '1.20.105', label: 'R1 — coordinatorStep wired into game loop (skipSimStepOnForward)' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };