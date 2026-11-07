import { describe, expect, it } from "vitest";
import { checkFilm, checkGuess, sentencesOf } from "../src/film";
import { CLAUDE_LESSON_SCHEMA, checkLesson, LESSON_SCHEMA } from "../src/lesson";

const osmosis = [
  { say: "Here is a membrane with water on both sides.", cue: "membrane" },
  { say: "Now add sugar to the right.", cue: "Sugar." },
  { say: "The water crosses towards the sugar.", cue: "crosses" },
];

describe("film checks", () => {
  it("keeps sentences and matches cues to a word in their sentence", () => {
    const f = checkFilm(osmosis, "");
    expect(f).toHaveLength(3);
    expect(f[1].cue).toBe("sugar");
    expect(f[2]).toEqual({ say: "The water crosses towards the sugar.", cue: "crosses" });
  });

  it("drops a cue that is not in its sentence, so the app places it", () => {
    const f = checkFilm([{ say: "Water moves across.", cue: "osmosis" }], "");
    expect(f[0].cue).toBe("");
  });

  it("cleans dashes out of spoken lines and keeps at most four", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ say: `Line ${i} — with a pause.`, cue: "line" }));
    const f = checkFilm(many, "");
    expect(f).toHaveLength(4);
    expect(f[0].say).not.toMatch(/—/);
  });

  it("falls back to the bite's text, one sentence per part", () => {
    expect(sentencesOf("One. Two? Three!")).toEqual(["One.", "Two?", "Three!"]);
    const f = checkFilm(undefined, "The membrane is picky. Ions need doors.");
    expect(f).toEqual([
      { say: "The membrane is picky.", cue: "" },
      { say: "Ions need doors.", cue: "" },
    ]);
  });

  it("keeps a guess only with two answers and the right one among them", () => {
    const film = checkFilm(osmosis, "");
    const g = { ask: "Which way will the water go?", options: ["Left", "Right"], answer: "right" };
    expect(checkGuess(g, film)).toEqual({ ask: "Which way will the water go?", options: ["Left", "Right"], answer: "Right" });
    expect(checkGuess({ ...g, answer: "Up" }, film)).toBeNull();
    expect(checkGuess({ ...g, options: ["Left", "Right", "Up"] }, film)).toBeNull();
    expect(checkGuess(g, film.slice(0, 1))).toBeNull();
    expect(checkGuess(null, film)).toBeNull();
  });
});

describe("films in a lesson", () => {
  const bite = (title: string, guess: unknown) => ({
    title,
    text: "Water moves towards the side with more sugar.",
    picture: { kind: "compare", labels: ["Dilute", "Concentrated"] },
    scene: {
      family: "particles",
      zones: ["Dilute", "Concentrated"],
      divider: "membrane",
      things: [{ name: "water", mark: "dot", count: 10, zone: 0, to: 1, motion: "cross" }],
    },
    play: null,
    caption: "Water follows the sugar.",
    film: osmosis,
    guess,
    quote: "",
    puzzle: { kind: "true_false", prompt: "Water moves towards more sugar.", options: ["True", "False"], answer: ["True"], why: "Sugar pulls water." },
  });
  const guess = { ask: "Which way will the water go?", options: ["Left", "Right"], answer: "Right" };

  it("keeps one guess per lesson and fills a film for every bite", () => {
    const l = checkLesson({ bites: [bite("A", guess), bite("B", guess)], recap: "r", explainBack: "q" } as never, { topic: "t", idea: "i" });
    expect(l.bites[0].guess?.answer).toBe("Right");
    expect(l.bites[1].guess).toBeNull();
    expect(l.bites.every((b) => b.film.length === 3)).toBe(true);
  });

  it("reads a scene Claude wrote as JSON text", () => {
    const a = bite("A", guess);
    const asText = { ...a, scene: JSON.stringify(a.scene) };
    const l = checkLesson({ bites: [asText, { ...a, scene: "null" }, { ...a, scene: "{broken" }], recap: "r", explainBack: "q" } as never, { topic: "t", idea: "i" });
    expect(l.bites[0].scene?.family).toBe("particles");
    expect(l.bites[1].scene).toBeNull();
    expect(l.bites[2].scene).toBeNull();
  });

  it("keeps Claude's schema small: the scene is text there", () => {
    expect(CLAUDE_LESSON_SCHEMA.properties.bites.items.properties.scene).toEqual({ type: "string" });
    expect(LESSON_SCHEMA.properties.bites.items.properties.scene).toHaveProperty("anyOf");
  });

  it("drops a guess on a bite with no drawing to watch", () => {
    const b = { ...bite("A", guess), scene: null };
    const l = checkLesson({ bites: [b], recap: "r", explainBack: "q" } as never, { topic: "t", idea: "i" });
    expect(l.bites[0].guess).toBeNull();
  });
});
