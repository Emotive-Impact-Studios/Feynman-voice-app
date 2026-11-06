import { describe, expect, it } from "vitest";
import { louder, rms, softLimit } from "../src/index";

const sine = (amp: number, n = 24000) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * 220 * i) / 24000));

describe("louder", () => {
  it("lifts a quiet voice a lot", () => {
    const quiet = sine(0.05);
    expect(rms(louder(quiet)) / rms(quiet)).toBeGreaterThan(3.5);
  });

  it("never clips, however loud the input", () => {
    const out = louder(sine(0.9));
    expect(Math.max(...out.map(Math.abs))).toBeLessThan(1);
  });

  it("does not make a voice quieter", () => {
    const loud = sine(0.5);
    expect(rms(louder(loud))).toBeGreaterThanOrEqual(rms(loud) * 0.9);
  });

  it("leaves silence alone", () => {
    const s = new Float32Array(100);
    expect(Array.from(louder(s))).toEqual(Array.from(s));
  });
});

describe("softLimit", () => {
  it("is linear below the knee and bounded above it", () => {
    expect(softLimit(0.3)).toBe(0.3);
    expect(softLimit(-0.5)).toBe(-0.5);
    expect(softLimit(3)).toBeLessThan(1);
    expect(softLimit(-3)).toBeGreaterThan(-1);
    expect(softLimit(0.8)).toBeGreaterThan(0.6);
  });
});
