import { writeJson } from './storage.js';

const RUN_CRASH_REPORT_KEY = 'phantom-rebound-crash-report-v1';

function buildGameLoopCrashReport({
  error,
  entry,
  bulletsCount,
  enemiesCount,
  particlesCount,
  at = Date.now(),
}) {
  const crash = {
    message: String(error?.message || error || 'unknown'),
    stack: String(error?.stack || '').slice(0, 1200),
    at,
  };

  return {
    type: 'game-loop-crash',
    crash,
    entry,
    counts: {
      bullets: bulletsCount,
      enemies: enemiesCount,
      particles: particlesCount,
    },
  };
}

function saveRunCrashReport(report) {
  return writeJson(RUN_CRASH_REPORT_KEY, report);
}

export { RUN_CRASH_REPORT_KEY, buildGameLoopCrashReport, saveRunCrashReport };
