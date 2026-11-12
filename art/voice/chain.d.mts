// Types for chain.mjs, so the client can import the one voice chain directly.
export interface ChainSettings {
  highpassHz: number;
  warmthHz: number;
  warmthQ: number;
  warmthDb: number;
  presenceHz: number;
  presenceQ: number;
  presenceDb: number;
  lowpassHz: number;
  drive: number;
  compressor: { thresholdDb: number; kneeDb: number; ratio: number; attackMs: number; releaseMs: number };
  outputDb: number;
}
export interface RoomToneSettings {
  enabled?: boolean;
  seed: number;
  loopSeconds: number;
  lowHz: number;
  highHz: number;
  rmsDb: number;
  driftDb: number;
}
export function saturationCurve(drive: number): Float32Array;
export function createVoiceChain(ctx: BaseAudioContext, settings: ChainSettings, options?: { trimDb?: number }): { input: AudioNode; output: AudioNode; filters: BiquadFilterNode[] };
export function createRoomTone(ctx: BaseAudioContext, settings: RoomToneSettings): { output: GainNode; buffer: AudioBuffer; start(when?: number): void; stop(): void };
