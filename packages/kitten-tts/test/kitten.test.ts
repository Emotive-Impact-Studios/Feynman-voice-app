import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  basicTokenise,
  chunkText,
  encodeWav,
  phonemesToIds,
  phonemiseKeepingPunctuation,
  styleFor,
  SYMBOLS,
  synthesise,
  trimLeadingSilence,
} from "../src/index";

describe("tokenising", () => {
  it("matches Python's \\w+|[^\\w\\s] split on IPA", () => {
    // Expected output taken from running the Python regex on the same string.
    expect(basicTokenise("wˈʌt ɪz ðə pˈɔɪnt, ʌv ɪt?")).toEqual([
      "wˈʌt", "ɪz", "ðə", "pˈɔɪnt", ",", "ʌv", "ɪt", "?",
    ]);
  });

  it("pads ids with zero at both ends and keeps spaces", () => {
    const ids = phonemesToIds("ə,");
    expect(ids[0]).toBe(0);
    expect(ids.at(-1)).toBe(0);
    expect(ids.slice(1, -1).map((i) => SYMBOLS[i]).join("")).toBe("ə ,");
  });

  it("drops characters the model does not know", () => {
    // Like Python, the unknown symbol still splits the word, so its spaces stay.
    const ids = phonemesToIds("a😀b").slice(1, -1).map((i) => SYMBOLS[i]).join("");
    expect(ids).toBe("a  b");
  });
});

describe("chunking", () => {
  it("keeps question marks and splits on sentence ends", () => {
    expect(chunkText("Why? Because it is. Is it")).toEqual(["Why?", "Because it is.", "Is it,"]);
  });

  it("splits a long sentence by words", () => {
    const chunks = chunkText("word ".repeat(200), 50);
    expect(chunks.every((c) => c.length <= 51)).toBe(true);
  });

  it("puts punctuation back after phonemising each clause", async () => {
    const out = await phonemiseKeepingPunctuation("Wait, so why?", async (s) => s.toUpperCase());
    expect(out).toBe("WAIT, SO WHY?");
  });
});

describe("voices", () => {
  it("picks row min(len, rows - 1)", () => {
    const rows = 3, dims = 2;
    const data = Float32Array.from({ length: rows * dims }, (_, i) => i);
    const index = { "expr-voice-5-f": { offset: 0, shape: [rows, dims] as [number, number] } };
    expect([...styleFor(data.buffer, index, "Kiki", 1)]).toEqual([2, 3]);
    expect([...styleFor(data.buffer, index, "Kiki", 99)]).toEqual([4, 5]);
  });
});

describe("wav", () => {
  it("writes a valid 16-bit mono header", () => {
    const wav = encodeWav(new Float32Array(10), 24000);
    const v = new DataView(wav.buffer);
    expect(wav.length).toBe(64);
    expect(v.getUint32(24, true)).toBe(24000);
    expect(v.getUint16(34, true)).toBe(16);
  });

  it("trims leading silence but keeps a short lead-in", () => {
    const s = new Float32Array(10000);
    s[5000] = 0.5;
    expect(trimLeadingSilence(s, 0.01, 100).length).toBe(5100);
  });
});

const MODEL_DIR = process.env.KITTEN_DIR ?? "../../models/kitten";
describe.skipIf(!existsSync(`${MODEL_DIR}/voices.bin`))("real model", () => {
  it("turns a question into a few seconds of audio", async () => {
    const { loadNodeKitten } = await import("../node/runner");
    const { runner, voices } = await loadNodeKitten(MODEL_DIR);
    const audio = await synthesise(runner, voices, [
      { text: "Why two loops?", phonemes: "wˈaɪ tˈuː lˈuːps?" },
    ]);
    const seconds = audio.length / 24000;
    expect(seconds).toBeGreaterThan(0.5);
    expect(seconds).toBeLessThan(5);
    expect(Math.max(...audio.map(Math.abs))).toBeGreaterThan(0.1);
  }, 30000);
});
