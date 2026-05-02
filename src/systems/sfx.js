const SOUND_COOLDOWN_MS = {
  ghostFire: 22,
  enemyFire: 38,
  bounce: 18,
  hitSplat: 24,
};

let audioCtx = null;
let masterGain = null;
let lowpass = null;
let compressor = null;
const lastPlayedAt = new Map();

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new Ctor();
    lowpass = audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 9200;
    lowpass.Q.value = 0.7;

    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 14;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.28;

    lowpass.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(audioCtx.destination);
  } catch (_) {
    audioCtx = null;
  }
  return audioCtx;
}

function canPlay(kind) {
  const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const cooldown = SOUND_COOLDOWN_MS[kind] || 0;
  const last = lastPlayedAt.get(kind) || -Infinity;
  if (now - last < cooldown) return false;
  lastPlayedAt.set(kind, now);
  return true;
}

function scheduleEnvelope(gainNode, startTime, attack, decay, peak, tail = 0.0001) {
  gainNode.gain.setValueAtTime(tail, startTime);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(tail, peak), startTime + Math.max(0.001, attack));
  gainNode.gain.exponentialRampToValueAtTime(tail, startTime + Math.max(attack + 0.001, decay));
}

function connectToChain(node) {
  if (lowpass) {
    node.connect(lowpass);
    return;
  }
  if (masterGain) {
    node.connect(masterGain);
    return;
  }
  try { node.connect(getAudioContext().destination); } catch (_) {}
}

function makeNoiseBuffer(ctx, durationSec = 0.12) {
  const sampleRate = ctx.sampleRate || 44100;
  const frames = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, frames, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    const t = i / frames;
    const env = Math.max(0, 1 - t);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  return buffer;
}

function playTone(ctx, {
  wave = 'triangle',
  startFreq = 500,
  endFreq = 220,
  duration = 0.09,
  gain = 0.08,
  detune = 0,
  attack = 0.002,
  decay = 0.09,
  noiseGain = 0,
  noiseDuration = 0.08,
  noiseFilter = 1400,
} = {}) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + Math.max(0.01, duration));
  if (detune) osc.detune.setValueAtTime(detune, now);

  scheduleEnvelope(env, now, attack, decay, gain);
  osc.connect(env);
  connectToChain(env);
  osc.start(now);
  osc.stop(now + Math.max(0.04, duration + 0.03));

  if (noiseGain > 0) {
    const noise = ctx.createBufferSource();
    const noiseFilterNode = ctx.createBiquadFilter();
    const noiseEnv = ctx.createGain();
    noise.buffer = makeNoiseBuffer(ctx, noiseDuration);
    noiseFilterNode.type = 'bandpass';
    noiseFilterNode.frequency.value = noiseFilter;
    noiseFilterNode.Q.value = 0.8;
    scheduleEnvelope(noiseEnv, now, 0.001, Math.max(0.025, noiseDuration), noiseGain, 0.0001);
    noise.connect(noiseFilterNode);
    noiseFilterNode.connect(noiseEnv);
    connectToChain(noiseEnv);
    noise.start(now);
    noise.stop(now + Math.max(0.03, noiseDuration + 0.02));
  }
}

function unlockAudio() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try { ctx.resume(); } catch (_) {}
  }
  return true;
}

export function playRetroSfx(kind, opts = {}) {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (!canPlay(kind)) return false;
  unlockAudio();

  const intensity = Math.max(0.25, Math.min(3, Number(opts.intensity) || 1));

  switch (kind) {
    case 'ghostFire':
      playTone(ctx, {
        wave: 'triangle',
        startFreq: 880 + intensity * 40,
        endFreq: 220 + intensity * 30,
        duration: 0.075,
        gain: 0.065 + intensity * 0.008,
        attack: 0.001,
        decay: 0.07,
        noiseGain: 0.022 + intensity * 0.003,
        noiseDuration: 0.03,
        noiseFilter: 1800,
      });
      break;
    case 'enemyFire':
      playTone(ctx, {
        wave: opts.elite ? 'sawtooth' : 'square',
        startFreq: opts.elite ? 360 : 280,
        endFreq: opts.elite ? 120 : 150,
        duration: opts.elite ? 0.09 : 0.07,
        gain: 0.04 + intensity * 0.006,
        detune: opts.elite ? -7 : 0,
        attack: 0.001,
        decay: opts.elite ? 0.085 : 0.065,
        noiseGain: opts.elite ? 0.014 : 0.009,
        noiseDuration: 0.04,
        noiseFilter: opts.elite ? 900 : 1100,
      });
      break;
    case 'bounce':
      playTone(ctx, {
        wave: 'sine',
        startFreq: opts.danger ? 1040 : 920,
        endFreq: opts.danger ? 520 : 640,
        duration: 0.06,
        gain: 0.034 + intensity * 0.006,
        attack: 0.001,
        decay: 0.055,
        noiseGain: opts.danger ? 0.014 : 0.009,
        noiseDuration: 0.025,
        noiseFilter: 2400,
      });
      break;
    case 'hitSplat':
      playTone(ctx, {
        wave: opts.crit ? 'triangle' : 'sine',
        startFreq: opts.crit ? 420 : 260,
        endFreq: opts.crit ? 130 : 95,
        duration: opts.kill ? 0.105 : 0.075,
        gain: (opts.kill ? 0.052 : 0.04) + intensity * 0.004,
        attack: 0.001,
        decay: opts.kill ? 0.1 : 0.07,
        noiseGain: opts.kill ? 0.058 : 0.045,
        noiseDuration: opts.kill ? 0.07 : 0.05,
        noiseFilter: opts.crit ? 1350 : 980,
      });
      break;
    default:
      return false;
  }

  return true;
}

export function unlockRetroAudio() {
  return unlockAudio();
}
