// Drawn scenes for Teach me. The lesson writer never draws pixels: for each
// bite it fills in one scene from a fixed kit (eight families covering twelve
// devices: scale, comparison, path, fork, loop, network, container, plot,
// stairs, spectrum, Venn and balance), and the app draws it live with Skia.
// The look follows the principles of Visual Value, softened for Fenny: one
// idea per picture, silver lines on near-black, only one thing lit.
// One bite per lesson may also carry a "play" slider that changes the scene.
//
// The visual language (see the Fenny Drawing Kit page) is enforced here: the
// model can only choose from these lists, and checkScene() trims anything the
// app could not draw well. A broken scene becomes null, and the app falls back
// to the simple diagram.

export const FAMILIES = ["particles", "links", "graph", "balance"] as const;
export const MARKS = ["dot", "ring", "blocked"] as const;
export const MOTIONS = ["still", "drift", "jiggle", "cross", "rise", "fall", "orbit", "pulse", "flow"] as const;
export const DIVIDERS = ["none", "wall", "membrane", "sieve"] as const;
export const LAYOUTS = ["line", "fork", "loop", "web"] as const;
export const LINK_KINDS = ["cause", "flow", "tie"] as const;
export const SHAPES = ["rise", "fall", "saturate", "decay", "bell", "s_curve"] as const;
export const HIGHLIGHTS = ["ride", "crossing", "half", "end", "none"] as const;
export const CHANGES = ["appear", "cross", "speed", "grow", "step", "shift", "stretch", "ride", "weigh", "climb", "slide", "overlap"] as const;
export const COMPARE_STYLES = ["circles", "bars"] as const;

export interface Thing {
  name: string;
  mark: (typeof MARKS)[number];
  count: number;
  zone: number;
  /** For motion "cross" or the "cross" change: the zone it heads to. */
  to: number;
  motion: (typeof MOTIONS)[number];
}
export interface ParticlesScene {
  family: "particles";
  zones: string[];
  divider: (typeof DIVIDERS)[number];
  things: Thing[];
}
export interface LinksScene {
  family: "links";
  layout: (typeof LAYOUTS)[number];
  nodes: string[];
  links: { from: number; to: number; kind: (typeof LINK_KINDS)[number] }[];
}
export interface GraphScene {
  family: "graph";
  x: string;
  y: string;
  curves: { name: string; shape: (typeof SHAPES)[number]; label: string }[];
  highlight: (typeof HIGHLIGHTS)[number];
}
export interface BalanceScene {
  family: "balance";
  left: string;
  right: string;
  leftWeight: number;
  rightWeight: number;
  middle: string;
}
/** Scale or comparison: circles sized by value, or bars. */
export interface CompareScene {
  family: "compare";
  style: (typeof COMPARE_STYLES)[number];
  items: { label: string; value: number }[];
}
/** Levels climbed in order, bottom first. */
export interface StairsScene {
  family: "stairs";
  steps: string[];
  at: number;
}
/** Where something sits between two ends. */
export interface SpectrumScene {
  family: "spectrum";
  left: string;
  right: string;
  min: number;
  max: number;
  marks: { label: string; at: number }[];
  at: number;
}
/** What two things share. overlap is 0 (apart) to 1 (mostly shared). */
export interface VennScene {
  family: "venn";
  a: string;
  b: string;
  both: string;
  overlap: number;
}
export type Scene = ParticlesScene | LinksScene | GraphScene | BalanceScene | CompareScene | StairsScene | SpectrumScene | VennScene;

export interface Play {
  prompt: string;
  low: string;
  high: string;
  /** What to say at the low end, the middle and the high end of the slider. */
  readouts: string[];
  changes: { target: string; does: (typeof CHANGES)[number] }[];
}

// ---- schema (works with OpenAI strict mode and Claude structured output) ----

const str = { type: "string" };
const int = { type: "integer" };
const num = { type: "number" };
const strs = { type: "array", items: str };
const en = (values: readonly string[]) => ({ type: "string", enum: [...values] });
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export const SCENE_SCHEMA = {
  anyOf: [
    obj({
      family: en(["particles"]),
      zones: strs,
      divider: en(DIVIDERS),
      things: { type: "array", items: obj({ name: str, mark: en(MARKS), count: int, zone: int, to: int, motion: en(MOTIONS) }) },
    }),
    obj({
      family: en(["links"]),
      layout: en(LAYOUTS),
      nodes: strs,
      links: { type: "array", items: obj({ from: int, to: int, kind: en(LINK_KINDS) }) },
    }),
    obj({
      family: en(["graph"]),
      x: str,
      y: str,
      curves: { type: "array", items: obj({ name: str, shape: en(SHAPES), label: str }) },
      highlight: en(HIGHLIGHTS),
    }),
    obj({ family: en(["balance"]), left: str, right: str, leftWeight: int, rightWeight: int, middle: str }),
    obj({ family: en(["compare"]), style: en(COMPARE_STYLES), items: { type: "array", items: obj({ label: str, value: num }) } }),
    obj({ family: en(["stairs"]), steps: strs, at: int }),
    obj({ family: en(["spectrum"]), left: str, right: str, min: num, max: num, marks: { type: "array", items: obj({ label: str, at: num }) }, at: num }),
    obj({ family: en(["venn"]), a: str, b: str, both: str, overlap: num }),
    { type: "null" },
  ],
} as const;

export const PLAY_SCHEMA = {
  anyOf: [
    obj({
      prompt: str,
      low: str,
      high: str,
      readouts: strs,
      changes: { type: "array", items: obj({ target: str, does: en(CHANGES) }) },
    }),
    { type: "null" },
  ],
} as const;

export const SCENE_PROMPT = `Each bite also gets a scene: one small live drawing that makes one point. You do not draw. You pick one device and fill in its slots, and the app draws it in Fenny's style (soft silver lines on near-black, one thing lit, built in a few beats). Use a scene for almost every bite. Use null only when no device fits, and then the picture field is used instead.

Pick the device by the question the idea answers:
- How big compared with what? compare (style circles for size, bars for amounts).
- What steps, in what order? links with layout line.
- What choice or branching outcome? links with layout fork (node 0 is the start, the others are the outcomes).
- What goes round and round? links with layout loop (2 nodes on a loop makes a circuit).
- How are many things connected? links with layout web.
- What crosses a boundary, or moves around inside? particles.
- How does one thing change with another? graph.
- What levels are climbed in order? stairs.
- Where does it sit between two ends? spectrum.
- What do two things share? venn.
- Which of two sides wins? balance.

The devices:
particles: zones (1 to 3 area labels, left to right, "" for none), divider (none, wall, membrane = dashed and crossable, sieve = gaps), things (1 to 3 groups: name, mark dot = something that moves, ring = an object, blocked = something stopped, at most one group; count 1 to 16; zone it starts in; to = zone it heads to, same as zone if it stays; motion still, drift, jiggle like heat, cross from zone to "to", rise, fall, orbit, pulse, flow).
links: layout line, fork, loop or web. nodes 2 to 7 labels. links from and to node indexes, in the order they happen, kind cause (arrow with a pulse), flow (stream of dots), tie (faint dashed bond, like an alliance).
graph: x and y axis labels. curves 1 or 2: name, shape (rise, fall = straight lines, saturate = rises then levels off, decay = falls then levels off, bell, s_curve), label of 1 or 2 letters or a short word. highlight ride (a lit point travels the curve), crossing (where two curves meet), half (half height of a saturate curve, like Km), end (value at the right), none.
balance: left and right labels, leftWeight and rightWeight 0 to 6, middle = a short label under the pivot or "".
compare: style circles or bars. items 2 to 6 with a label and a positive value in real proportion (Earth 1, Sun 109). The biggest or most important item is lit.
stairs: steps 2 to 6 labels, bottom step first. at = index of the step that is lit.
spectrum: left and right end labels, min and max numbers, marks 0 to 4 reference points (label, at), at = where the lit marker sits.
venn: a and b labels, both = the label for the overlap, overlap 0 to 1.

play: at most one bite per lesson (usually the first or second) gets a slider that changes its scene, so the student tries the idea with their own hands. Others get null.
  prompt: an instruction under 8 words, like "Add sugar to the right." low and high: 1 to 3 word slider end labels.
  readouts: exactly 3 short lines for the low end, the middle and the high end. Each says what they see and why, under 16 words.
  changes: 1 or 2. target names a thing, curve or compare item, "left" or "right" for balance, "" for links, stairs, spectrum and venn.
    particles: appear (fades in as the slider rises), cross (moves from zone to "to"), speed, grow.
    links: step (links appear one by one, like time passing), speed.
    graph: shift (curve moves right), stretch (levels off later, bell wider), ride (lit point moves along).
    balance: weigh (that side goes from nothing to 6).
    compare: grow (that item's value rises from small to its value), step (items appear one at a time).
    stairs: climb. spectrum: slide (marker moves from min to max). venn: overlap (from apart to mostly shared).

caption: one short sentence under 9 words that states the point, ending with a full stop, like "Water follows the sugar."

What makes a good scene:
- One idea per picture. If you need two pictures, it belongs in two bites.
- Use real names from the notes or topic: "Serbia", never "A" or "State 1". "Sucrose", not "solute 2". Every group or item has a different name.
- Show what the idea needs and nothing else. A demand shift needs the supply curve too. Osmosis needs the solute as well as the water.
- A slider moves the cause so they can watch the effect. Never a slider that only makes things busier unless speed is the idea.
- Be honest. compare values must be real quantities in one unit (convert first: Neptune is 30 AU, Proxima Centauri is about 268,000 AU). Never invent numbers to compare two ideas.
- Labels name real things (Serbia, Supply, Sucrose), never placeholder steps like "One move", "Start" or "Allies react".
- Each bite's scene shows something new. Do not repeat the same scene in two bites; use a different device or null.
- If no device honestly fits, use null. A wrong picture is worse than none.

Examples (scene, then play):
Osmosis: {"family":"particles","zones":["Dilute","Concentrated"],"divider":"membrane","things":[{"name":"water","mark":"dot","count":14,"zone":0,"to":1,"motion":"drift"},{"name":"sugar","mark":"ring","count":8,"zone":1,"to":1,"motion":"still"}]} play {"prompt":"Add sugar to the right.","low":"No sugar","high":"Lots of sugar","readouts":["Same on both sides, so no overall movement.","More sugar on the right, so water starts moving right.","Lots of sugar on the right. Most of the water has crossed."],"changes":[{"target":"sugar","does":"appear"},{"target":"water","does":"cross"}]}
Demand rises: {"family":"graph","x":"Quantity","y":"Price","curves":[{"name":"supply","shape":"rise","label":"S"},{"name":"demand","shape":"fall","label":"D"}],"highlight":"crossing"} play {"prompt":"Raise demand.","low":"Old demand","high":"Demand up","readouts":["Demand meets supply at one price, the equilibrium.","Demand shifts right, so there is a shortage and price is bid up.","New equilibrium with a higher price and more sold."],"changes":[{"target":"demand","does":"shift"}]}
Alliances in 1914: {"family":"links","layout":"web","nodes":["Austria-Hungary","Serbia","Russia","Germany","France","Britain"],"links":[{"from":0,"to":1,"kind":"cause"},{"from":2,"to":1,"kind":"tie"},{"from":3,"to":2,"kind":"cause"},{"from":3,"to":4,"kind":"cause"},{"from":5,"to":3,"kind":"cause"}]} play {"prompt":"Step through summer 1914.","low":"28 June","high":"4 August","readouts":["Austria-Hungary declares war on Serbia.","Russia backs Serbia, so Germany declares war on Russia and France.","Britain joins. A local crisis is now a European war."],"changes":[{"target":"","does":"step"}]}
Size of the Sun: {"family":"compare","style":"circles","items":[{"label":"Earth","value":1},{"label":"Sun","value":109}]}
Maslow: {"family":"stairs","steps":["Body","Safety","Belonging","Esteem","Growth"],"at":0} play {"prompt":"Climb the needs.","low":"Basic","high":"Growth","readouts":["Food, water and sleep come first.","Belonging rests on feeling safe.","Growth only once the steps below hold."],"changes":[{"target":"","does":"climb"}]}
pH: {"family":"spectrum","left":"Acid","right":"Alkaline","min":0,"max":14,"marks":[{"label":"Lemon","at":2},{"label":"Water","at":7},{"label":"Bleach","at":13}],"at":7}
Probability of A and B: {"family":"venn","a":"Rain","b":"Wind","both":"Both","overlap":0.4}
Km: {"family":"graph","x":"Substrate","y":"Rate","curves":[{"name":"rate","shape":"saturate","label":""}],"highlight":"half"}
Civil burden of proof: {"family":"balance","left":"Defendant","right":"Claimant","leftWeight":3,"rightWeight":4,"middle":"51%"}`;

// ---- checking ----

const clampInt = (n: unknown, lo: number, hi: number, d: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
};
const short = (s: unknown, words = 3) =>
  String(s ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, words)
    .join(" ")
    .slice(0, 22);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

const ALLOWED: Record<Scene["family"], readonly Play["changes"][number]["does"][]> = {
  particles: ["appear", "cross", "speed", "grow"],
  links: ["step", "speed"],
  graph: ["shift", "stretch", "ride"],
  balance: ["weigh"],
  compare: ["grow", "step"],
  stairs: ["climb"],
  spectrum: ["slide"],
  venn: ["overlap"],
};

/** Trims a scene to what the app can draw well, or returns null if there is nothing usable. */
export function checkScene(s: unknown): Scene | null {
  if (!s || typeof s !== "object") return null;
  const r = s as Record<string, unknown>;
  try {
    if (r.family === "particles") {
      const zones = (Array.isArray(r.zones) ? r.zones : []).slice(0, 3).map((z) => short(z));
      if (!zones.length) zones.push("");
      const zi = (n: unknown) => clampInt(n, 0, zones.length - 1, 0);
      let things: Thing[] = (Array.isArray(r.things) ? r.things : []).slice(0, 3).map((t: Record<string, unknown>) => {
        const zone = zi(t.zone);
        return {
          name: String(t.name ?? "").trim().toLowerCase() || "things",
          mark: oneOf(t.mark, MARKS, "dot"),
          count: clampInt(t.count, 1, 16, 8),
          zone,
          to: t.to === undefined ? zone : zi(t.to),
          motion: oneOf(t.motion, MOTIONS, "drift"),
        };
      });
      // Names are how a slider finds a group, so they must be unique.
      const seen = new Set<string>();
      things = things.map((t, i) => {
        const name = seen.has(t.name) ? `${t.name} ${i + 1}` : t.name;
        seen.add(name);
        return { ...t, name };
      });
      // At most one blocked group, and no more than 36 marks in all.
      let coral = false;
      things = things.map((t) => {
        if (t.mark !== "blocked") return t;
        if (coral) return { ...t, mark: "ring" as const };
        coral = true;
        return { ...t, count: Math.min(t.count, 3) };
      });
      while (things.reduce((n, t) => n + t.count, 0) > 36) {
        const big = things.reduce((a, b) => (b.count > a.count ? b : a));
        big.count -= 1;
      }
      if (!things.length) return null;
      return { family: "particles", zones, divider: zones.length > 1 ? oneOf(r.divider, DIVIDERS, "membrane") : "none", things };
    }
    if (r.family === "links") {
      const nodes = (Array.isArray(r.nodes) ? r.nodes : []).slice(0, 7).map((n) => short(n, 2)).filter(Boolean);
      if (nodes.length < 2) return null;
      const ni = (n: unknown) => clampInt(n, 0, nodes.length - 1, 0);
      const links = (Array.isArray(r.links) ? r.links : [])
        .slice(0, 8)
        .map((l: Record<string, unknown>) => ({ from: ni(l.from), to: ni(l.to), kind: oneOf(l.kind, LINK_KINDS, "cause") }))
        .filter((l) => l.from !== l.to);
      if (!links.length) return null;
      return { family: "links", layout: oneOf(r.layout, LAYOUTS, "line"), nodes, links };
    }
    if (r.family === "graph") {
      const curves = (Array.isArray(r.curves) ? r.curves : []).slice(0, 2).map((c: Record<string, unknown>, i) => ({
        name: String(c.name ?? "").trim().toLowerCase() || `curve${i + 1}`,
        shape: oneOf(c.shape, SHAPES, "rise"),
        label: short(c.label, 2).slice(0, 10),
      }));
      if (!curves.length) return null;
      let highlight = oneOf(r.highlight, HIGHLIGHTS, "ride");
      if (highlight === "crossing" && curves.length < 2) highlight = "ride";
      if (highlight === "half" && !curves.some((c) => c.shape === "saturate")) highlight = "ride";
      return { family: "graph", x: short(r.x), y: short(r.y), curves, highlight };
    }
    if (r.family === "balance") {
      return {
        family: "balance",
        left: short(r.left),
        right: short(r.right),
        leftWeight: clampInt(r.leftWeight, 0, 6, 3),
        rightWeight: clampInt(r.rightWeight, 0, 6, 3),
        middle: short(r.middle).slice(0, 8),
      };
    }
    if (r.family === "compare") {
      const items = (Array.isArray(r.items) ? r.items : [])
        .slice(0, 6)
        .map((it: Record<string, unknown>) => ({ label: short(it.label, 2), value: Math.abs(Number(it.value)) }))
        .filter((it) => it.label && Number.isFinite(it.value) && it.value > 0);
      if (items.length < 2) return null;
      return { family: "compare", style: oneOf(r.style, COMPARE_STYLES, "bars"), items };
    }
    if (r.family === "stairs") {
      const steps = (Array.isArray(r.steps) ? r.steps : []).slice(0, 6).map((x) => short(x, 2)).filter(Boolean);
      if (steps.length < 2) return null;
      return { family: "stairs", steps, at: clampInt(r.at, 0, steps.length - 1, 0) };
    }
    if (r.family === "spectrum") {
      let min = Number(r.min);
      let max = Number(r.max);
      if (!Number.isFinite(min)) min = 0;
      if (!Number.isFinite(max) || max <= min) max = min + 10;
      const inRange = (x: unknown) => Math.max(min, Math.min(max, Number.isFinite(Number(x)) ? Number(x) : (min + max) / 2));
      const marks = (Array.isArray(r.marks) ? r.marks : []).slice(0, 4).map((m: Record<string, unknown>) => ({ label: short(m.label, 2), at: inRange(m.at) })).filter((m) => m.label);
      return { family: "spectrum", left: short(r.left), right: short(r.right), min, max, marks, at: inRange(r.at) };
    }
    if (r.family === "venn") {
      const a = short(r.a);
      const b = short(r.b);
      if (!a || !b) return null;
      const o = Number(r.overlap);
      return { family: "venn", a, b, both: short(r.both), overlap: Number.isFinite(o) ? Math.max(0, Math.min(1, o)) : 0.4 };
    }
  } catch {
    return null;
  }
  return null;
}

/** Keeps a play slider only if every change points at something in its scene. */
export function checkPlay(p: unknown, scene: Scene | null): Play | null {
  if (!p || typeof p !== "object" || !scene) return null;
  const r = p as Record<string, unknown>;
  const names =
    scene.family === "particles" ? scene.things.map((t) => t.name) : scene.family === "graph" ? scene.curves.map((c) => c.name) : scene.family === "balance" ? ["left", "right"] : scene.family === "compare" ? [...scene.items.map((it) => it.label.toLowerCase()), ""] : [""];
  const changes = (Array.isArray(r.changes) ? r.changes : [])
    .slice(0, 2)
    .map((c: Record<string, unknown>) => ({ target: String(c.target ?? "").trim().toLowerCase(), does: c.does as Play["changes"][number]["does"] }))
    .filter((c) => ALLOWED[scene.family].includes(c.does))
    .map((c) => (["links", "stairs", "spectrum", "venn"].includes(scene.family) || (scene.family === "compare" && c.does === "step") ? { ...c, target: "" } : c))
    .filter((c) => names.includes(c.target));
  const readouts = (Array.isArray(r.readouts) ? r.readouts : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
  if (!changes.length || readouts.length < 2) return null;
  while (readouts.length < 3) readouts.splice(1, 0, readouts[0]);
  return { prompt: String(r.prompt ?? "").trim() || "Move the slider.", low: short(r.low) || "Less", high: short(r.high) || "More", readouts, changes };
}
