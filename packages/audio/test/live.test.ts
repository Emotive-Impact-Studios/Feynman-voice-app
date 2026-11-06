import { describe, expect, it } from "vitest";
import { BargeIn, EndOfTurn, fromBase64, NdjsonReader, pcm16ToFloat32, quietAfter, toBase64 } from "../src/index";

const tick = 0.1; // seconds per buffer

describe("EndOfTurn", () => {
  it("ends a turn after speech then enough quiet", () => {
    const t = new EndOfTurn(1.2, 0.6);
    const results: boolean[] = [];
    for (let i = 0; i < 10; i++) results.push(t.push(true, tick)); // 1s of speech
    for (let i = 0; i < 12; i++) results.push(t.push(false, tick)); // 1.2s quiet
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.at(-1)).toBe(true);
  });

  it("keeps listening through a short pause", () => {
    const t = new EndOfTurn(1.2, 0.6);
    for (let i = 0; i < 10; i++) t.push(true, tick);
    for (let i = 0; i < 8; i++) expect(t.push(false, tick)).toBe(false);
    t.push(true, tick); // started again
    for (let i = 0; i < 8; i++) expect(t.push(false, tick)).toBe(false);
  });

  it("ignores quiet before any real speech, and a cough", () => {
    const t = new EndOfTurn(1.2, 0.6);
    for (let i = 0; i < 30; i++) expect(t.push(false, tick)).toBe(false);
    t.push(true, 0.2);
    for (let i = 0; i < 30; i++) expect(t.push(false, tick)).toBe(false);
    expect(t.hasSpeech).toBe(false);
  });

  it("waits longer once given more quiet", () => {
    const t = new EndOfTurn(1.2, 0.6);
    t.setSilence(2.5);
    for (let i = 0; i < 10; i++) t.push(true, tick);
    for (let i = 0; i < 20; i++) expect(t.push(false, tick)).toBe(false); // 2s: still thinking
    for (let i = 0; i < 4; i++) t.push(false, tick);
    expect(t.push(false, tick)).toBe(true);
  });
});

describe("quietAfter", () => {
  it("gives why and how questions thinking time", () => {
    expect(quietAfter("Why does the price go up?")).toBe(3);
    expect(quietAfter("So how would that work?")).toBe(3);
    expect(quietAfter("What is an enzyme?")).toBe(2);
    expect(quietAfter("Is that the same as showing?")).toBe(2);
  });
});

describe("BargeIn", () => {
  const loud = new Float32Array(1600).fill(0.2);
  const echo = new Float32Array(1600).fill(0.03);

  it("fires on sustained loud speech, not on quieter echo", () => {
    const b = new BargeIn(0.06, 0.3);
    for (let i = 0; i < 20; i++) expect(b.push(echo, 16000)).toBe(false);
    expect(b.push(loud, 16000)).toBe(false);
    expect(b.push(loud, 16000)).toBe(false);
    expect(b.push(loud, 16000)).toBe(true);
  });
});

describe("pcm and base64", () => {
  it("round-trips base64 and decodes 16-bit PCM", () => {
    const bytes = new Uint8Array([0x00, 0x40, 0x00, 0xc0, 0xff, 0x7f]);
    for (const n of [1, 2, 3, 4, 5, 6]) expect(fromBase64(toBase64(bytes.subarray(0, n)))).toEqual(bytes.subarray(0, n));
    const f = pcm16ToFloat32(bytes);
    expect(f[0]).toBeCloseTo(0.5);
    expect(f[1]).toBeCloseTo(-0.5);
    expect(f[2]).toBeCloseTo(1, 3);
  });
});

describe("NdjsonReader", () => {
  it("handles events split across reads", () => {
    const r = new NdjsonReader();
    const got: unknown[] = [];
    r.push('{"type":"transcript","te', (e) => got.push(e));
    r.push('xt":"hi"}\n{"type":"done"}\n{"type":', (e) => got.push(e));
    r.push('"x"}', (e) => got.push(e));
    r.flush((e) => got.push(e));
    expect(got).toEqual([{ type: "transcript", text: "hi" }, { type: "done" }, { type: "x" }]);
  });
});
