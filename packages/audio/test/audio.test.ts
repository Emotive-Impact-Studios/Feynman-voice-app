import { describe, expect, it } from "vitest";
import { concatFloat32, int16ToFloat32, Resampler, SpeechMeter, toBase64 } from "../src/index";

describe("Resampler", () => {
  it("turns 48 kHz into 16 kHz across buffer boundaries", () => {
    const r = new Resampler(48000, 16000);
    const parts = [];
    for (let b = 0; b < 10; b++) parts.push(r.push(new Float32Array(4800).fill(0.5)));
    const out = concatFloat32(parts);
    expect(Math.abs(out.length - 16000)).toBeLessThanOrEqual(1);
    expect(out.every((s) => Math.abs(s - 0.5) < 1e-6)).toBe(true);
  });

  it("copes with 44.1 kHz and keeps a sine wave smooth", () => {
    const r = new Resampler(44100, 16000);
    const input = Float32Array.from({ length: 44100 }, (_, i) => Math.sin((2 * Math.PI * 200 * i) / 44100));
    const out = concatFloat32([r.push(input.subarray(0, 1000)), r.push(input.subarray(1000))]);
    expect(Math.abs(out.length - 16000)).toBeLessThanOrEqual(1);
    for (let i = 0; i < out.length; i += 997) {
      expect(out[i]).toBeCloseTo(Math.sin((2 * Math.PI * 200 * i) / 16000), 1);
    }
  });
});

describe("SpeechMeter", () => {
  it("counts only loud buffers, plus a short hangover", () => {
    const m = new SpeechMeter(0.1, 0.2);
    const loud = new Float32Array(1600).fill(0.5); // 0.1 s at 16 kHz
    const quiet = new Float32Array(1600);
    for (let i = 0; i < 10; i++) m.push(loud, 16000); // 1 s talking
    for (let i = 0; i < 10; i++) m.push(quiet, 16000); // 1 s silence
    expect(m.totalSeconds).toBeCloseTo(2);
    expect(m.speakingSeconds).toBeCloseTo(1.2);
  });
});

describe("helpers", () => {
  it("converts int16 to float", () => {
    expect([...int16ToFloat32(Int16Array.of(0, 16384, -32768).buffer)]).toEqual([0, 0.5, -1]);
  });

  it("matches Node's base64", () => {
    for (const len of [0, 1, 2, 3, 4, 5, 100]) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37) & 255);
      expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    }
  });
});
