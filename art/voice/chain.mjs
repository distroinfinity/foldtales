// The paper-radio voice chain and the shared room tone.
// Plain Web Audio with native nodes only, so it runs the same on prepared and live lines, in any browser context.
// source -> createVoiceChain().input ... .output -> the caller's panner or destination.

const fromDb = (db) => 10 ** (db / 20);

export function saturationCurve(drive) {
  const size = 2049;
  const curve = new Float32Array(size);
  const norm = Math.tanh(drive);
  for (let i = 0; i < size; i += 1) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / norm;
  }
  return curve;
}

function biquad(ctx, type, frequency, q, gainDb = 0) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  node.gain.value = gainDb;
  return node;
}

function gain(ctx, db) {
  const node = ctx.createGain();
  node.gain.value = fromDb(db);
  return node;
}

export function createVoiceChain(ctx, settings, { trimDb = 0 } = {}) {
  const trim = gain(ctx, trimDb);
  // For highpass and lowpass, Web Audio's Q is resonance in dB, and 0 is flat.
  const highpass = biquad(ctx, "highpass", settings.highpassHz, 0);
  const warmth = biquad(ctx, "peaking", settings.warmthHz, settings.warmthQ, settings.warmthDb);
  const presence = biquad(ctx, "peaking", settings.presenceHz, settings.presenceQ, settings.presenceDb);
  const lowpass = biquad(ctx, "lowpass", settings.lowpassHz, 0);

  const saturator = ctx.createWaveShaper();
  saturator.curve = saturationCurve(settings.drive);
  saturator.oversample = "2x";

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = settings.compressor.thresholdDb;
  compressor.knee.value = settings.compressor.kneeDb;
  compressor.ratio.value = settings.compressor.ratio;
  compressor.attack.value = settings.compressor.attackMs / 1000;
  compressor.release.value = settings.compressor.releaseMs / 1000;

  const output = gain(ctx, settings.outputDb);
  [trim, highpass, warmth, presence, lowpass, saturator, compressor, output].reduce((a, b) => a.connect(b));
  return { input: trim, output, filters: [highpass, warmth, presence, lowpass] };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bakeRoomTone(sampleRate, settings) {
  const length = Math.round(settings.loopSeconds * sampleRate);
  const fade = Math.round(0.1 * sampleRate);
  const preroll = Math.round(0.5 * sampleRate);
  const random = mulberry32(settings.seed);
  const data = new Float32Array(preroll + length + fade);
  const lowCoef = 1 - Math.exp((-2 * Math.PI * settings.lowHz) / sampleRate);
  const highCoef = 1 - Math.exp((-2 * Math.PI * settings.highHz) / sampleRate);
  let low1 = 0;
  let low2 = 0;
  let high1 = 0;
  let high2 = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = random() * 2 - 1;
    low1 += lowCoef * (white - low1);
    low2 += lowCoef * (low1 - low2);
    high1 += highCoef * (white - low2 - high1);
    high2 += highCoef * (high1 - high2);
    data[i] = high2;
  }

  // Blend the tail into the head, so the last sample leads straight into the first.
  const shaped = data.slice(preroll, preroll + length);
  for (let i = 0; i < fade; i += 1) {
    const t = (i / fade) * (Math.PI / 2);
    shaped[i] = shaped[i] * Math.sin(t) + data[preroll + length + i] * Math.cos(t);
  }

  // A whole number of drift cycles, so the loop point stays seamless.
  const cycles = 2;
  let energy = 0;
  for (let i = 0; i < length; i += 1) {
    shaped[i] *= fromDb(settings.driftDb * Math.sin((2 * Math.PI * cycles * i) / length));
    energy += shaped[i] * shaped[i];
  }
  const scale = fromDb(settings.rmsDb) / Math.sqrt(energy / length);
  for (let i = 0; i < length; i += 1) shaped[i] *= scale;
  return shaped;
}

export function createRoomTone(ctx, settings) {
  const samples = bakeRoomTone(ctx.sampleRate, settings);
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.copyToChannel(samples, 0);
  const output = ctx.createGain();
  let source = null;
  function stop() {
    if (!source) return;
    source.stop();
    source.disconnect();
    source = null;
  }
  function start(when = 0) {
    stop();
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(output);
    source.start(when);
  }
  return { output, buffer, start, stop };
}
