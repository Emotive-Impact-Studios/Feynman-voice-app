import { describe, expect, it } from "vitest";
import { checkPlay, checkScene, FAMILIES, SCENE_PROMPT, THING_NAMES } from "../src/scene";
import { THINGS } from "../../mobile/src/teach/scene/things";

const play = (does: string, target = "x") => ({ prompt: "p", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target, does }] });

describe("the writer's examples", () => {
  // Every example in the prompt must pass the checks unchanged in kind, so the
  // writer is never shown a scene the app would throw away.
  const examples = SCENE_PROMPT.split("\n")
    .map((l) => /^[^{]+: (\{"family".*?\})(?: play (\{.*\}))?$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m);
  it("covers every family", () => {
    const seen = new Set(examples.map((m) => JSON.parse(m[1]).family));
    for (const f of FAMILIES) if (!["fan", "spiral", "radial", "funnel", "brace"].includes(f)) expect(seen.has(f), f).toBe(true);
  });
  it.each(examples.map((m) => [JSON.parse(m[1]).family + ": " + m[0].split(":")[0], m]))("%s passes the checks", (_name, m) => {
    const raw = JSON.parse((m as RegExpExecArray)[1]);
    const s = checkScene(raw);
    expect(s?.family).toBe(raw.family);
    const p = (m as RegExpExecArray)[2];
    if (p) expect(checkPlay(JSON.parse(p), s)).not.toBeNull();
  });
});

describe("the newer devices", () => {
  it("only lets a funnel narrow", () => {
    expect(checkScene({ family: "funnel", stages: [{ label: "Applied", value: 100 }, { label: "Offer", value: 140 }], lit: 0 })).toBeNull();
    const f = checkScene({ family: "funnel", stages: [{ label: "Applied", value: 100 }, { label: "Offer", value: 40 }], lit: 9 });
    expect(f?.family === "funnel" && f.lit).toBe(1);
  });
  it("makes shares add up to 100", () => {
    const c = checkScene({ family: "cutaway", whole: "Air", parts: [{ label: "Nitrogen", share: 7.8 }, { label: "Oxygen", share: 2.1 }, { label: "Other", share: 0.1 }], lit: 1 });
    expect(c?.family === "cutaway" && c.parts.map((x) => x.share)).toEqual([78, 21, 1]);
  });
  it("drops overlapping brace groups", () => {
    const b = checkScene({ family: "brace", items: ["Li", "Na", "K", "F", "Cl"], groups: [{ label: "Metals", from: 0, to: 2 }, { label: "Wrong", from: 2, to: 4 }, { label: "Halogens", from: 3, to: 4 }], lit: 2 });
    expect(b?.family === "brace" && b.groups.map((g) => g.label)).toEqual(["Metals", "Halogens"]);
  });
  it("keeps whole words when it shortens a label", () => {
    const s = checkScene({ family: "spiral", stages: ["Plan", "Build", "Test"], turns: 3, label: "Understanding grows deeper with practice" });
    expect(s?.family === "spiral" && s.label).toBe("Understanding grows deeper with");
  });
  it("blanks slider targets for devices that light parts in order", () => {
    const t = checkScene({ family: "timeline", events: [{ label: "A", when: "1900", t: 1900 }, { label: "B", when: "1950", t: 1950 }], scale: "even", at: 1 });
    expect(checkPlay(play("step", "B"), t)?.changes[0]).toEqual({ target: "", does: "step" });
    expect(checkPlay(play("grow"), t)).toBeNull();
  });
});

describe("things", () => {
  it("knows exactly the things the app can draw", () => {
    expect([...THING_NAMES].sort()).toEqual(Object.keys(THINGS).sort());
  });
  it("drops things it cannot draw and keeps the layout's limits", () => {
    const v = checkScene({ family: "things", layout: "versus", items: [{ thing: "dragon", label: "Dragon", size: 1 }, { thing: "virus", label: "Virus", size: 1 }, { thing: "bacterium", label: "Bacterium", size: 1 }, { thing: "cell", label: "Cell", size: 1 }], lit: 7 });
    expect(v?.family === "things" && v.items.map((t) => t.thing)).toEqual(["virus", "bacterium"]);
    expect(v?.family === "things" && v.lit).toBe(1);
    expect(checkScene({ family: "things", layout: "chain", items: [{ thing: "seed", label: "Seed", size: 1 }], lit: 0 })).toBeNull();
    expect(checkScene({ family: "things", layout: "row", items: [{ thing: "iceberg", label: "Most costs are hidden", size: 1 }], lit: 0 })?.family).toBe("things");
  });
  it("puts a scale smallest first, and refuses one with no real sizes", () => {
    const s = checkScene({ family: "things", layout: "scale", items: [{ thing: "mountain", label: "Everest", size: 8849 }, { thing: "person", label: "Climber", size: 1.8 }], lit: 0 });
    expect(s?.family === "things" && s.items.map((t) => t.label)).toEqual(["Climber", "Everest"]);
    expect(checkScene({ family: "things", layout: "scale", items: [{ thing: "mountain", label: "A", size: 1 }, { thing: "person", label: "B", size: 1 }], lit: 0 })).toBeNull();
  });
  it("lets units count in little pictures, only ones it can draw", () => {
    const u = checkScene({ family: "units", lit: 4, label: "get a side effect", rest: "do not", thing: "person" });
    expect(u?.family === "units" && u.thing).toBe("person");
    const w = checkScene({ family: "units", lit: 4, label: "get a side effect", rest: "do not", thing: "unicorn" });
    expect(w?.family === "units" && w.thing).toBe("");
  });
  it("steps through things and speeds an orbit", () => {
    const o = checkScene({ family: "things", layout: "orbit", items: [{ thing: "sun", label: "Sun", size: 1 }, { thing: "earth", label: "Earth", size: 1 }], lit: 1 });
    expect(checkPlay(play("speed", "Earth"), o)?.changes[0]).toEqual({ target: "", does: "speed" });
    expect(checkPlay(play("weigh"), o)).toBeNull();
  });
});
