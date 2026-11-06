import { describe, expect, it } from "vitest";
import { buildAfter, cueShare, estimateMs, filmLines, MIN_RAMP_MS, rampFor, sentences } from "../src/film";

describe("narrated film timing", () => {
  it("finds where the cue word starts, whole words only", () => {
    const say = "Now add sugar to the right side.";
    expect(cueShare(say, "sugar")).toBeCloseTo(8 / say.length, 5);
    expect(cueShare(say, "Sugar.")).toBeCloseTo(8 / say.length, 5);
    // "ugar" is not a word of the line, so the part lands past the middle.
    expect(cueShare(say, "ugar")).toBe(0.55);
    expect(cueShare(say, "")).toBe(0.55);
  });

  it("lands a part just before its word, and never faster than a draw", () => {
    const line = { say: "So the water crosses towards the sugar.", cue: "crosses" };
    const r = rampFor(line, 3000);
    expect(r.delayMs).toBe(0);
    expect(r.rampMs).toBe(Math.round(3000 * cueShare(line.say, "crosses") - 80));
    // A cue at the very start still takes a short draw.
    expect(rampFor({ say: "Membranes let water through.", cue: "membranes" }, 2000).rampMs).toBe(MIN_RAMP_MS);
  });

  it("allows for a line that has already been playing, or starts later", () => {
    const line = { say: "Water molecules jiggle about on both sides.", cue: "jiggle" };
    const fresh = rampFor(line, 3000, 0).rampMs;
    expect(rampFor(line, 3000, 400).rampMs).toBe(Math.max(MIN_RAMP_MS, fresh - 400));
    const later = rampFor(line, 3000, -500);
    expect(later.delayMs).toBe(500);
    expect(later.rampMs).toBe(fresh);
  });

  it("falls back to the bite's sentences when a lesson has no film", () => {
    expect(sentences("One. Two? Three!")).toEqual(["One.", "Two?", "Three!"]);
    expect(filmLines(undefined, "The membrane is picky. Ions need doors.")).toEqual([
      { say: "The membrane is picky.", cue: "" },
      { say: "Ions need doors.", cue: "" },
    ]);
    expect(filmLines([{ say: "Here.", cue: "here" }], "ignored")).toEqual([{ say: "Here.", cue: "here" }]);
  });

  it("builds in equal steps and estimates speaking time", () => {
    expect([0, 1, 2].map((k) => buildAfter(k, 3))).toEqual([1 / 3, 2 / 3, 1]);
    expect(buildAfter(0, 0)).toBe(1);
    expect(estimateMs("one two three four five six")).toBe(Math.round((6 / 2.3) * 1000) + 300);
  });
});
