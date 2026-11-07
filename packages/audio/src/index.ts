// Microphone, turn-taking and stream helpers shared by the app and tests. Plain TypeScript, no native code.

/**
 * Streaming linear resampler. The phone may deliver 44.1 or 48 kHz even when
 * asked for 16 kHz, and Gemini only needs 16 kHz mono, so we shrink it here
 * before upload (about a third of the size).
 */
export class Resampler {
  private pos = 0; // position of the next output sample, in input samples
  private last = 0; // last input sample of the previous buffer

  constructor(private inRate: number, private outRate = 16000) {}

  push(input: Float32Array): Float32Array {
    if (this.inRate === this.outRate) return input.slice();
    const step = this.inRate / this.outRate;
    const out: number[] = [];
    // Index -1 refers to the last sample of the previous buffer.
    const at = (i: number) => (i < 0 ? this.last : input[i]);
    while (this.pos <= input.length - 1) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const a = at(i);
      const b = i + 1 <= input.length - 1 ? input[i + 1] : a;
      out.push(a + (b - a) * frac);
      this.pos += step;
    }
    this.pos -= input.length;
    if (input.length) this.last = input[input.length - 1];
    return Float32Array.from(out);
  }
}

/**
 * Very simple energy-based speech detector. It counts seconds where the
 * learner is actually talking, which is what the minutes balance will charge
 * for. A short hangover stops gaps between words being counted as silence.
 */
export class SpeechMeter {
  speakingSeconds = 0;
  totalSeconds = 0;
  private hangover = 0;

  constructor(private threshold = 0.015, private hangoverSeconds = 0.35) {}

  push(samples: Float32Array, sampleRate: number): boolean {
    const seconds = samples.length / sampleRate;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / Math.max(1, samples.length));
    this.totalSeconds += seconds;
    if (rms >= this.threshold) {
      this.hangover = this.hangoverSeconds;
      this.speakingSeconds += seconds;
      return true;
    }
    if (this.hangover > 0) {
      const counted = Math.min(seconds, this.hangover);
      this.hangover -= seconds;
      this.speakingSeconds += counted;
      return true;
    }
    return false;
  }
}

export function int16ToFloat32(data: ArrayBuffer): Float32Array {
  const ints = new Int16Array(data);
  const out = new Float32Array(ints.length);
  for (let i = 0; i < ints.length; i++) out[i] = ints[i] / 32768;
  return out;
}

export function concatFloat32(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 without relying on btoa or Buffer, so it behaves the same everywhere. */
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64[n >> 18] + B64[(n >> 12) & 63] + "==";
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + "=";
  }
  return out;
}

/** Root mean square loudness of a buffer, 0 to 1. */
export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

/**
 * Decides when the learner has finished a turn in a live call: once they
 * have spoken for a moment and then gone quiet for long enough. Fed the same
 * speech/silence decisions as SpeechMeter.
 */
export class EndOfTurn {
  private spoken = 0;
  private quiet = 0;

  constructor(
    /** Seconds of quiet that end a turn. Long enough for a breath mid-thought. */
    private silenceSeconds = 2,
    /** Speech needed before quiet can end a turn, so a cough does not. */
    private minSpeechSeconds = 0.6,
  ) {}

  /** Returns true once, at the moment the turn ends. */
  push(isSpeech: boolean, seconds: number): boolean {
    if (isSpeech) {
      this.spoken += seconds;
      this.quiet = 0;
      return false;
    }
    if (this.spoken < this.minSpeechSeconds) return false;
    this.quiet += seconds;
    if (this.quiet >= this.silenceSeconds) {
      this.spoken = 0;
      this.quiet = 0;
      return true;
    }
    return false;
  }

  get hasSpeech(): boolean {
    return this.spoken >= this.minSpeechSeconds;
  }

  reset(): void {
    this.spoken = 0;
    this.quiet = 0;
  }

  /** Change how much quiet ends the next turn. */
  setSilence(seconds: number): void {
    this.silenceSeconds = seconds;
  }
}

/** Quiet that ends a turn after an ordinary question. */
export const TURN_QUIET_SECONDS = 2;
/** Quiet that ends a turn after a "why" or "how" question, which needs thinking time. */
export const THINKING_QUIET_SECONDS = 3;
/**
 * The faster-replies trial: a shorter wait. Safe because the server holds a
 * turn that stopped mid-thought ("wait") and talking on while Fenny thinks
 * carries the turn on.
 */
export const FAST_TURN_QUIET_SECONDS = 1.2;
export const FAST_THINKING_QUIET_SECONDS = 2;

/**
 * How long to wait in silence before the learner's answer to this question
 * counts as finished. "Why" and "how" questions get longer, so a learner who
 * stops to think is not cut off.
 */
export function quietAfter(question: string, fast = false): number {
  const thinking = /\b(why|how)\b/i.test(question);
  if (fast) return thinking ? FAST_THINKING_QUIET_SECONDS : FAST_TURN_QUIET_SECONDS;
  return thinking ? THINKING_QUIET_SECONDS : TURN_QUIET_SECONDS;
}

/**
 * Notices the learner talking over the student. The phone's own speaker
 * leaks into the microphone, so this needs louder sound than normal speech
 * detection, held for a moment, before it counts.
 */
export class BargeIn {
  private loud = 0;

  constructor(private threshold = 0.06, private holdSeconds = 0.3) {}

  push(samples: Float32Array, sampleRate: number): boolean {
    const seconds = samples.length / sampleRate;
    if (rms(samples) >= this.threshold) this.loud += seconds;
    else this.loud = Math.max(0, this.loud - seconds);
    if (this.loud >= this.holdSeconds) {
      this.loud = 0;
      return true;
    }
    return false;
  }

  reset(): void {
    this.loud = 0;
  }
}

/** Decodes little-endian 16-bit PCM (as Sonic sends it) to floats. */
export function pcm16ToFloat32(bytes: Uint8Array): Float32Array {
  const n = Math.floor(bytes.length / 2);
  const out = new Float32Array(n);
  const v = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  for (let i = 0; i < n; i++) out[i] = v.getInt16(i * 2, true) / 32768;
  return out;
}

const B64_INDEX = new Map([...B64].map((c, i) => [c, i]));

/** The inverse of toBase64. */
export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const a = B64_INDEX.get(clean[i])!;
    const b = B64_INDEX.get(clean[i + 1])!;
    const c = B64_INDEX.get(clean[i + 2]);
    const d = B64_INDEX.get(clean[i + 3]);
    out[o++] = (a << 2) | (b >> 4);
    if (c !== undefined) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (c !== undefined && d !== undefined) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

/**
 * Reads a stream of newline-separated JSON, as /api/live-turn sends it,
 * calling `onEvent` for each complete line.
 */
export class NdjsonReader {
  private pending = "";

  push(text: string, onEvent: (event: Record<string, unknown>) => void): void {
    this.pending += text;
    const lines = this.pending.split("\n");
    this.pending = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
  }

  flush(onEvent: (event: Record<string, unknown>) => void): void {
    if (this.pending.trim()) onEvent(JSON.parse(this.pending));
    this.pending = "";
  }
}

/**
 * Makes the student's voice loud on a phone speaker. Each clip is lifted to
 * a speech level well above what the voices send (about -14 dBFS RMS), and
 * a soft limiter rounds off the peaks instead of clipping them, so it gets
 * much louder without crackling. Quiet clips (near silence) are left alone.
 */
export const LOUD_TARGET_RMS = 0.2;
export const LOUD_MAX_GAIN = 6; // about +15 dB

export function louder(samples: Float32Array, targetRms = LOUD_TARGET_RMS, maxGain = LOUD_MAX_GAIN): Float32Array {
  const level = rms(samples);
  const out = new Float32Array(samples.length);
  if (level < 1e-4) {
    out.set(samples);
    return out;
  }
  const gain = Math.min(maxGain, Math.max(1, targetRms / level));
  for (let i = 0; i < samples.length; i++) out[i] = softLimit(samples[i] * gain);
  return out;
}

/** Linear up to 0.6, then curves smoothly towards 1 and never passes it. */
export function softLimit(x: number): number {
  const knee = 0.6;
  const a = Math.abs(x);
  if (a <= knee) return x;
  const over = (a - knee) / (1 - knee);
  return Math.sign(x) * (knee + (1 - knee) * Math.tanh(over));
}
export * from "./film";
