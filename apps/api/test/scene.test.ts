import { describe, expect, it } from "vitest";
import { checkPlay, checkScene } from "../src/scene";
import { checkLesson } from "../src/lesson";

describe("scene checks", () => {
  it("keeps a good particles scene and trims what the app cannot draw", () => {
    const s = checkScene({
      family: "particles",
      zones: ["Dilute", "Concentrated", "Extra", "Too many"],
      divider: "laser",
      things: [
        { name: "Water", mark: "dot", count: 40, zone: 0, to: 9, motion: "cross" },
        { name: "water", mark: "blocked", count: 9, zone: 1, to: 1, motion: "still" },
        { name: "salt", mark: "blocked", count: 2, zone: 2, to: 2, motion: "sparkle" },
      ],
    });
    expect(s?.family).toBe("particles");
    if (s?.family !== "particles") return;
    expect(s.zones).toHaveLength(3);
    expect(s.divider).toBe("membrane");
    expect(s.things[0]).toMatchObject({ name: "water", count: 16, to: 2, motion: "cross" });
    expect(s.things[1].name).toBe("water 2");
    expect(s.things[1].count).toBe(3);
    // only one coral group
    expect(s.things[2].mark).toBe("ring");
    expect(s.things[2].motion).toBe("drift");
  });

  it("drops scenes with nothing to draw", () => {
    expect(checkScene(null)).toBeNull();
    expect(checkScene({ family: "links", layout: "line", nodes: ["Only one"], links: [] })).toBeNull();
    expect(checkScene({ family: "graph", x: "x", y: "y", curves: [], highlight: "ride" })).toBeNull();
    expect(checkScene({ family: "painting" })).toBeNull();
  });

  it("falls back to a highlight the graph can show", () => {
    const g = checkScene({ family: "graph", x: "Quantity", y: "Price", curves: [{ name: "D", shape: "fall", label: "D" }], highlight: "crossing" });
    expect(g?.family === "graph" && g.highlight).toBe("ride");
  });

  it("keeps a slider only when it points at something in the scene", () => {
    const scene = checkScene({ family: "graph", x: "Quantity", y: "Price", curves: [{ name: "supply", shape: "rise", label: "S" }, { name: "demand", shape: "fall", label: "D" }], highlight: "crossing" });
    const ok = checkPlay({ prompt: "Raise demand.", low: "Old demand", high: "Demand up", readouts: ["a", "b", "c"], changes: [{ target: "Demand", does: "shift" }] }, scene);
    expect(ok?.changes).toEqual([{ target: "demand", does: "shift" }]);
    expect(checkPlay({ prompt: "x", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target: "price", does: "shift" }] }, scene)).toBeNull();
    expect(checkPlay({ prompt: "x", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target: "demand", does: "appear" }] }, scene)).toBeNull();
    expect(checkPlay({ prompt: "x", low: "a", high: "b", readouts: ["a", "c"], changes: [{ target: "demand", does: "shift" }] }, scene)?.readouts).toHaveLength(3);
  });
});

describe("lessons with scenes", () => {
  it("allows only one slider per lesson", () => {
    const scene = { family: "balance", left: "Defendant", right: "Claimant", leftWeight: 3, rightWeight: 4, middle: "51%" };
    const play = { prompt: "Add evidence.", low: "Weak", high: "Strong", readouts: ["a", "b", "c"], changes: [{ target: "right", does: "weigh" }] };
    const bite = { title: "t", text: "x", picture: { kind: "none", labels: [] }, scene, play, quote: "", puzzle: { kind: "true_false", prompt: "p", options: ["True", "False"], answer: ["True"], why: "w" } };
    const l = checkLesson({ bites: [bite, bite], recap: "r", explainBack: "e" } as never, { topic: "Law", idea: "Burden of proof" });
    expect(l.bites[0].play).not.toBeNull();
    expect(l.bites[1].play).toBeNull();
    expect(l.bites[1].scene?.family).toBe("balance");
  });
});
