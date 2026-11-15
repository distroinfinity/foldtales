import type { Vector3 } from '@iwsdk/core';
import { lineIdOf, NARRATOR } from '@tabletop/contracts';
import { createRoomTone, createVoiceChain, type ChainSettings, type RoomToneSettings } from '../../../art/voice/chain.mjs';
import type { ShowManifest } from '../show/manifest.ts';
import type { SoundName } from '../show/sound-marks.ts';
import { createSuspender } from './suspender.ts';

export interface SoundSources {
  sounds: ShowManifest['sounds'];
  voiceLines: ShowManifest['voiceLines'];
  artBase: string;
  /** The run-005 voice: its chain, trim and room tone. Shared by every voiced clip. */
  voice: { chain: ChainSettings; trimDb: number; roomTone: RoomToneSettings };
  /** Each character's own chain and trim, by speaker id. The narrator uses `voice`. */
  voices?: Record<string, { chain: ChainSettings; trimDb: number }>;
}

/** A line being spoken, so a preemption can cut it short. */
export interface Speech {
  stop(fadeMs?: number): void;
  readonly playing: boolean;
}

export type SoundCall = SoundName | 'thump' | 'bloom' | 'tap' | 'rustle' | 'settle' | 'felt' | 'pleased' | 'puzzled' | 'interested' | 'drawer' | 'grab' | 'thunder' | 'gull' | 'wash' | 'shooting';

/**
 * Where a sound plays. The show bus freezes with the story when it pauses; the ui bus never does,
 * so the book's own controls (closing it, the ribbon, a resize) always answer your hands.
 */
export type SoundBus = 'show' | 'ui';

/**
 * Run 009's finished foley and prepared lines, with voiced clips through the paper-radio chain so
 * every voice matches. Every sound plays from a point in the room, so it seems to come from the book.
 * A clip that fails to load falls back to a small synthesized stand-in, so no action is ever silent.
 */
export interface SoundEngine {
  /** Fetches and decodes every clip. Safe before the landing tap. */
  load(): Promise<void>;
  /**
   * A live line (the AI Storyteller's): its audio, as a data URL, is decoded and kept under its line
   * id, so `speak` plays it through the speaker's voice chain like any prepared line. Resolves once
   * it can be played; false if it couldn't be decoded (the line then shows as a caption).
   */
  addLine(lineId: string, url: string, durationMs: number): Promise<boolean>;
  /** Forgets live lines, at the end of an evening. */
  clearLines(): void;
  /** How many clips decoded, for the review build's checks. */
  loaded(): number;
  /** Call from the landing tap: browsers only start audio from a gesture. */
  unlock(): void;
  play(name: SoundCall, at?: Vector3, text?: string, bus?: SoundBus): void;
  /** A prepared line in its speaker's voice, from where they stand. Null if there's no audio for it (captions only). */
  speak(speaker: string, text: string, at?: Vector3): Speech | null;
  setListener(position: Vector3, forward: Vector3, up: Vector3): void;
  /** Freezes the show's sounds in flight; resuming continues them, never replays. The ui bus keeps playing. */
  suspend(): void;
  resume(): void;
  roomTone(on: boolean): void;
  /** A faint warm hum while the ember searches. */
  hum(on: boolean): void;
  /** A room effect's lasting sound (rain or the sea all round you), at a level from 0 to 1, eased. Its looping clip from run 016; rain has a synthesized stand-in, the sea is silent without its clip. */
  ambience(name: 'rain' | 'sea', level: number): void;
  /** A roll of thunder from far off, in the direction `at`. A clip named `thunder` is used if there is one. */
  thunder(at: Vector3): void;
}

interface Bus {
  ctx: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
}

function makeBus(): Bus {
  const ctx = new AudioContext();
  const master = new GainNode(ctx, { gain: 0.9 });
  master.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return { ctx, master, noise };
}

export function createSoundEngine(sources?: SoundSources): SoundEngine {
  let buses: Record<SoundBus, Bus> | null = null;
  let showRunning: ReturnType<typeof createSuspender> | null = null;
  let tone: GainNode | null = null;
  let humming: { gain: GainNode; clip: boolean } | null = null;
  const ambiences = new Map<string, GainNode>();
  let voiceIn: AudioNode | null = null;
  const buffers = new Map<string, AudioBuffer>();
  const turns = new Map<string, number>();

  const ensure = (): Record<SoundBus, Bus> | null => {
    if (buses) return buses;
    try {
      buses = { show: makeBus(), ui: makeBus() };
      showRunning = createSuspender(buses.show.ctx);
    } catch {
      buses = null;
    }
    return buses;
  };

  const out = (bus: Bus, at?: Vector3): AudioNode => {
    if (!at) return bus.master;
    const panner = new PannerNode(bus.ctx, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 0.5, rolloffFactor: 1, positionX: at.x, positionY: at.y, positionZ: at.z });
    panner.connect(bus.master);
    return panner;
  };

  const noiseBurst = (bus: Bus, dest: AudioNode, start: number, length: number, filter: BiquadFilterType, freq: number, q: number, peak: number, attack: number, sweepTo?: number) => {
    const c = bus.ctx;
    const src = new AudioBufferSourceNode(c, { buffer: bus.noise, loop: true, loopStart: Math.random(), loopEnd: 1.9 });
    const f = new BiquadFilterNode(c, { type: filter, frequency: freq, Q: q });
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, start + length);
    const g = new GainNode(c, { gain: 0 });
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + length);
    src.connect(f).connect(g).connect(dest);
    src.start(start, Math.random());
    src.stop(start + length + 0.05);
  };

  const tonePing = (bus: Bus, dest: AudioNode, start: number, freq: number, length: number, peak: number, type: OscillatorType = 'sine', endFreq?: number) => {
    const c = bus.ctx;
    const osc = new OscillatorNode(c, { type, frequency: freq });
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + length);
    const g = new GainNode(c, { gain: 0 });
    g.gain.linearRampToValueAtTime(peak, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(g).connect(dest);
    osc.start(start);
    osc.stop(start + length + 0.05);
  };

  /** The small synthesized stand-in, for a clip that didn't load. */
  function synth(name: SoundCall, bus: Bus, dest: AudioNode): void {
    const t = bus.ctx.currentTime + 0.01;
    switch (name) {
      case 'thump':
        tonePing(bus, dest, t, 85, 0.28, 0.5, 'sine', 42);
        noiseBurst(bus, dest, t, 0.12, 'lowpass', 700, 0.7, 0.25, 0.004);
        break;
      case 'bloom':
      case 'chime':
        noiseBurst(bus, dest, t, 1.1, 'bandpass', 2400, 0.6, 0.05, 0.35, 900);
        tonePing(bus, dest, t + 0.05, 660, 1.2, 0.03);
        break;
      case 'cover':
        noiseBurst(bus, dest, t, 0.9, 'bandpass', 900, 0.9, 0.12, 0.25, 500);
        break;
      case 'fold':
        noiseBurst(bus, dest, t, 0.16, 'bandpass', 2600, 1.4, 0.14, 0.02, 900);
        break;
      case 'gust':
        noiseBurst(bus, dest, t, 1.8, 'bandpass', 380, 0.8, 0.32, 0.55, 900);
        break;
      case 'puff':
        noiseBurst(bus, dest, t, 0.22, 'lowpass', 1100, 0.6, 0.3, 0.01);
        break;
      case 'gasp':
        noiseBurst(bus, dest, t, 0.38, 'bandpass', 1800, 1.2, 0.09, 0.22, 2600);
        break;
      case 'tap':
        noiseBurst(bus, dest, t, 0.06, 'bandpass', 3200, 2, 0.1, 0.002);
        break;
      case 'rustle':
        noiseBurst(bus, dest, t, 0.3, 'bandpass', 2000, 0.8, 0.05, 0.08, 1400);
        break;
      case 'settle':
        noiseBurst(bus, dest, t, 0.14, 'lowpass', 900, 0.7, 0.16, 0.004);
        break;
      case 'felt':
        tonePing(bus, dest, t, 140, 0.16, 0.18, 'sine', 90);
        break;
      case 'narration':
      case 'speech':
        break;
      case 'clink':
        tonePing(bus, dest, t, 1450, 0.25, 0.06, 'triangle', 1300);
        tonePing(bus, dest, t + 0.13, 1250, 0.2, 0.04, 'triangle');
        noiseBurst(bus, dest, t + 0.25, 0.9, 'bandpass', 900, 1.5, 0.05, 0.05, 500);
        break;
      case 'flare':
        noiseBurst(bus, dest, t, 0.55, 'lowpass', 1800, 0.6, 0.18, 0.06, 500);
        tonePing(bus, dest, t + 0.02, 520, 0.9, 0.035, 'sine', 780);
        break;
      case 'page':
        noiseBurst(bus, dest, t, 0.75, 'bandpass', 1600, 0.7, 0.13, 0.2, 700);
        break;
      case 'whoosh':
        noiseBurst(bus, dest, t, 1.4, 'bandpass', 500, 0.9, 0.2, 0.5, 1400);
        break;
      case 'creak':
        tonePing(bus, dest, t, 180, 0.35, 0.08, 'sawtooth', 140);
        noiseBurst(bus, dest, t + 0.4, 0.12, 'lowpass', 900, 0.7, 0.18, 0.004);
        break;
      case 'pluck':
        tonePing(bus, dest, t, 330, 0.6, 0.06, 'triangle', 320);
        break;
      case 'rope':
        noiseBurst(bus, dest, t, 0.5, 'bandpass', 700, 1.1, 0.14, 0.12, 1200);
        noiseBurst(bus, dest, t + 0.45, 0.14, 'lowpass', 600, 0.7, 0.15, 0.004);
        break;
      case 'spark':
        noiseBurst(bus, dest, t, 1.6, 'highpass', 5000, 0.7, 0.03, 0.3);
        tonePing(bus, dest, t + 0.1, 880, 2.2, 0.03, 'sine', 1320);
        break;
      case 'lamp':
        tonePing(bus, dest, t, 392, 3, 0.05);
        tonePing(bus, dest, t + 0.12, 587, 2.8, 0.04);
        tonePing(bus, dest, t + 0.24, 784, 2.6, 0.03);
        break;
      case 'satchel':
        noiseBurst(bus, dest, t, 0.3, 'lowpass', 800, 0.7, 0.18, 0.05);
        tonePing(bus, dest, t + 0.25, 1600, 0.25, 0.03, 'triangle');
        break;
      case 'setdown':
        noiseBurst(bus, dest, t, 0.12, 'lowpass', 1400, 0.7, 0.12, 0.004);
        break;
      case 'reeds':
        noiseBurst(bus, dest, t, 0.7, 'bandpass', 2400, 0.8, 0.07, 0.15, 1200);
        break;
      case 'hop':
        noiseBurst(bus, dest, t + 0.5, 0.08, 'lowpass', 1200, 0.7, 0.1, 0.003);
        break;
      case 'pleased':
        tonePing(bus, dest, t, 660, 0.28, 0.035);
        tonePing(bus, dest, t + 0.11, 880, 0.35, 0.035);
        break;
      case 'puzzled':
        tonePing(bus, dest, t, 520, 0.3, 0.03, 'sine', 440);
        tonePing(bus, dest, t + 0.16, 560, 0.3, 0.025, 'sine', 600);
        break;
      case 'interested':
        tonePing(bus, dest, t, 700, 0.18, 0.025, 'sine', 820);
        break;
      case 'drawer':
        noiseBurst(bus, dest, t, 0.7, 'bandpass', 420, 1.2, 0.16, 0.08, 300);
        tonePing(bus, dest, t + 0.68, 120, 0.15, 0.12, 'sine', 80);
        break;
      case 'grab':
        noiseBurst(bus, dest, t, 0.08, 'bandpass', 2600, 1.6, 0.08, 0.003);
        break;
    }
  }

  /** A finished clip for a sound, taking variations in turn, or null to synthesize. */
  const clipFor = (name: string): AudioBuffer | null => {
    const files = sources?.sounds[name]?.files;
    if (!files) return null;
    const turn = turns.get(name) ?? 0;
    turns.set(name, turn + 1);
    return buffers.get(files[turn % files.length]!) ?? null;
  };

  /** The narrator's chain, shared, on the show bus. */
  const narratorChain = (bus: Bus): AudioNode => {
    if (!voiceIn && sources) {
      const chain = createVoiceChain(bus.ctx, sources.voice.chain, { trimDb: sources.voice.trimDb });
      chain.output.connect(bus.master);
      voiceIn = chain.input;
    }
    return voiceIn ?? bus.master;
  };

  /**
   * A voice goes through the paper-radio chain: an unplaced line through the shared chain, a placed
   * one (a character's gasp) through its own chain and then to its place in the room.
   */
  function playClip(bus: Bus, buffer: AudioBuffer, voiced: boolean, at?: Vector3): void {
    const c = bus.ctx;
    const source = new AudioBufferSourceNode(c, { buffer });
    if (voiced && at && sources) {
      const chain = createVoiceChain(c, sources.voice.chain, { trimDb: sources.voice.trimDb });
      const panner = out(bus, at);
      source.connect(chain.input);
      chain.output.connect(panner);
      source.onended = () => {
        chain.output.disconnect();
        panner.disconnect();
      };
    } else if (voiced) {
      source.connect(narratorChain(bus));
    } else {
      const dest = out(bus, at);
      source.connect(dest);
      if (dest !== bus.master) source.onended = () => dest.disconnect();
    }
    source.start();
  }

  /** Room tone dips under a line, then comes back. */
  function duck(bus: Bus, seconds: number): void {
    if (!tone) return;
    const t = bus.ctx.currentTime;
    tone.gain.cancelScheduledValues(t);
    tone.gain.setTargetAtTime(0.5, t, 0.08);
    tone.gain.setTargetAtTime(1, t + seconds, 0.4);
  }

  const live = new Set<string>();
  return {
    loaded: () => buffers.size,
    async addLine(lineId, url, durationMs) {
      if (!sources) return false;
      const b = ensure();
      if (!b) return false;
      try {
        const data = await (await fetch(url)).arrayBuffer();
        const key = `live:${lineId}`;
        buffers.set(key, await b.ui.ctx.decodeAudioData(data));
        sources.voiceLines[lineId as keyof typeof sources.voiceLines] = { url: key, durationMs };
        live.add(lineId);
        return true;
      } catch {
        return false;
      }
    },
    clearLines() {
      if (!sources) return;
      for (const lineId of live) {
        const key = `live:${lineId}`;
        buffers.delete(key);
        delete sources.voiceLines[lineId as keyof typeof sources.voiceLines];
      }
      live.clear();
    },
    async load() {
      if (!sources) return;
      const b = ensure();
      if (!b) return;
      const files = new Set<string>();
      for (const sound of Object.values(sources.sounds)) for (const file of sound.files) files.add(file);
      for (const line of Object.values(sources.voiceLines)) if (line.url) files.add(line.url);
      // An AudioBuffer isn't tied to the context that decoded it, so both buses share these.
      await Promise.all(
        [...files].map(async (file) => {
          try {
            const response = await fetch(`${sources.artBase}/${file}`);
            if (!response.ok) return;
            buffers.set(file, await b.ui.ctx.decodeAudioData(await response.arrayBuffer()));
          } catch {
            // This clip falls back to its synthesized stand-in.
          }
        }),
      );
    },
    unlock() {
      const b = ensure();
      if (!b) return;
      void b.ui.ctx.resume().catch(() => undefined);
      if (showRunning?.running()) void b.show.ctx.resume().catch(() => undefined);
    },
    play(name, at, text, which = 'show') {
      const b = ensure();
      if (!b) return;
      const bus = b[which];
      if (bus.ctx.state === 'closed') return;
      if (name === 'narration') {
        // The narrator is in the room with you, not on the page: unplaced, through the chain.
        const url = text && sources ? sources.voiceLines[lineIdOf(NARRATOR, text)]?.url : null;
        const line = url ? buffers.get(url) : null;
        if (line) {
          playClip(bus, line, true);
          duck(bus, line.duration);
        }
        return;
      }
      const clip = clipFor(name);
      if (clip) playClip(bus, clip, sources?.sounds[name]?.voice ?? false, at);
      else synth(name, bus, out(bus, at));
    },
    speak(speaker, text, at) {
      const b = ensure();
      if (!b || !sources) return null;
      const bus = b.show;
      if (bus.ctx.state === 'closed') return null;
      const url = sources.voiceLines[lineIdOf(speaker, text)]?.url;
      const line = url ? buffers.get(url) : null;
      if (!line) return null;
      const c = bus.ctx;
      const source = new AudioBufferSourceNode(c, { buffer: line });
      const fade = new GainNode(c, { gain: 1 });
      const settings = speaker === NARRATOR ? sources.voice : (sources.voices?.[speaker] ?? sources.voice);
      const chain = createVoiceChain(c, settings.chain, { trimDb: settings.trimDb });
      source.connect(fade).connect(chain.input);
      const dest = speaker === NARRATOR || !at ? bus.master : out(bus, at);
      chain.output.connect(dest);
      let playing = true;
      source.onended = () => {
        playing = false;
        chain.output.disconnect();
        if (dest !== bus.master) dest.disconnect();
      };
      source.start();
      duck(bus, line.duration);
      return {
        get playing() {
          return playing;
        },
        stop(fadeMs = 150) {
          if (!playing) return;
          const t = c.currentTime;
          fade.gain.setTargetAtTime(0, t, fadeMs / 3000);
          try {
            source.stop(t + fadeMs / 1000 + 0.02);
          } catch {
            // Already stopping.
          }
        },
      };
    },
    setListener(position, forward, up) {
      if (!buses) return;
      for (const bus of Object.values(buses)) {
        const l = bus.ctx.listener;
        if (!l.positionX) continue;
        l.positionX.value = position.x;
        l.positionY.value = position.y;
        l.positionZ.value = position.z;
        l.forwardX.value = forward.x;
        l.forwardY.value = forward.y;
        l.forwardZ.value = forward.z;
        l.upX.value = up.x;
        l.upY.value = up.y;
        l.upZ.value = up.z;
      }
    },
    suspend() {
      ensure();
      showRunning?.set(false);
    },
    resume() {
      ensure();
      showRunning?.set(true);
    },
    roomTone(on) {
      const b = ensure();
      if (!b) return;
      const bus = b.show;
      if (!tone) {
        tone = new GainNode(bus.ctx, { gain: 0 });
        tone.connect(bus.master);
        if (sources) {
          const room = createRoomTone(bus.ctx, sources.voice.roomTone);
          room.output.connect(tone);
          room.start();
        } else {
          // The stand-in, about -46 dB: felt more than heard.
          const src = new AudioBufferSourceNode(bus.ctx, { buffer: bus.noise, loop: true });
          const low = new BiquadFilterNode(bus.ctx, { type: 'lowpass', frequency: 2500 });
          const level = new GainNode(bus.ctx, { gain: 0.005 });
          src.connect(low).connect(level).connect(tone);
          src.start();
        }
      }
      tone.gain.setTargetAtTime(on ? 1 : 0, bus.ctx.currentTime, 0.8);
    },
    ambience(name, level) {
      const b = ensure();
      if (!b) return;
      const bus = b.show;
      let gain = ambiences.get(name);
      if (!gain && level <= 0) return;
      if (!gain) {
        gain = new GainNode(bus.ctx, { gain: 0 });
        gain.connect(bus.master);
        const file = sources?.sounds[name]?.files[0];
        const clip = file ? buffers.get(file) : null;
        if (clip) {
          const source = new AudioBufferSourceNode(bus.ctx, { buffer: clip, loop: true });
          source.connect(gain);
          source.start();
        } else if (name === 'rain') {
          // A stand-in if run 016's clip didn't load: a soft hiss of rain, and a brighter patter over it.
          const hiss = new AudioBufferSourceNode(bus.ctx, { buffer: bus.noise, loop: true });
          const high = new BiquadFilterNode(bus.ctx, { type: 'highpass', frequency: 500 });
          const low = new BiquadFilterNode(bus.ctx, { type: 'lowpass', frequency: 5200 });
          const hissLevel = new GainNode(bus.ctx, { gain: 0.05 });
          hiss.connect(high).connect(low).connect(hissLevel).connect(gain);
          const patter = new AudioBufferSourceNode(bus.ctx, { buffer: bus.noise, loop: true, loopStart: 0.37, playbackRate: 1.7 });
          const band = new BiquadFilterNode(bus.ctx, { type: 'bandpass', frequency: 3200, Q: 1.4 });
          const patterLevel = new GainNode(bus.ctx, { gain: 0.03 });
          patter.connect(band).connect(patterLevel).connect(gain);
          hiss.start();
          patter.start();
        }
        ambiences.set(name, gain);
      }
      gain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)), bus.ctx.currentTime, 0.6);
    },
    thunder(at) {
      const b = ensure();
      if (!b) return;
      const file = sources?.sounds.thunder?.files[0];
      if (file && buffers.get(file)) {
        this.play('thunder', at);
        return;
      }
      // A stand-in until sound run 016's clips: a short crack, then a long low rumble rolling away.
      const bus = b.show;
      const now = bus.ctx.currentTime;
      const panner = out(bus, at);
      const rumble = new AudioBufferSourceNode(bus.ctx, { buffer: bus.noise, loop: true, playbackRate: 0.6 });
      const deep = new BiquadFilterNode(bus.ctx, { type: 'lowpass', frequency: 160, Q: 0.9 });
      const rumbleLevel = new GainNode(bus.ctx, { gain: 0 });
      rumbleLevel.gain.setValueAtTime(0, now);
      rumbleLevel.gain.linearRampToValueAtTime(0.9, now + 0.15);
      rumbleLevel.gain.setTargetAtTime(0.35, now + 0.4, 0.5);
      rumbleLevel.gain.setTargetAtTime(0, now + 1.4, 1.1);
      rumble.connect(deep).connect(rumbleLevel).connect(panner);
      const crack = new AudioBufferSourceNode(bus.ctx, { buffer: bus.noise });
      const bright = new BiquadFilterNode(bus.ctx, { type: 'highpass', frequency: 900 });
      const crackLevel = new GainNode(bus.ctx, { gain: 0 });
      crackLevel.gain.setValueAtTime(0.25, now);
      crackLevel.gain.setTargetAtTime(0, now + 0.02, 0.09);
      crack.connect(bright).connect(crackLevel).connect(panner);
      rumble.start(now);
      crack.start(now);
      rumble.stop(now + 6);
      crack.stop(now + 1);
      rumble.onended = () => panner.disconnect();
    },
    hum(on) {
      const b = ensure();
      if (!b) return;
      // The search happens before the story, so the hum lives on the ui bus.
      const bus = b.ui;
      const file = sources?.sounds.hum?.files[0];
      const clip = file ? buffers.get(file) : null;
      if (!humming) {
        const gain = new GainNode(bus.ctx, { gain: 0 });
        gain.connect(bus.master);
        if (clip) {
          const source = new AudioBufferSourceNode(bus.ctx, { buffer: clip, loop: true });
          source.connect(gain);
          source.start();
        } else {
          for (const f of [196, 293.7]) {
            const osc = new OscillatorNode(bus.ctx, { type: 'sine', frequency: f });
            osc.connect(gain);
            osc.start();
          }
        }
        humming = { gain, clip: !!clip };
      }
      humming.gain.gain.setTargetAtTime(on ? (humming.clip ? 1 : 0.012) : 0, bus.ctx.currentTime, on ? 0.6 : 0.25);
    },
  };
}
