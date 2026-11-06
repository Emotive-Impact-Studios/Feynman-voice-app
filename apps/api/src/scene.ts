// Drawn scenes for Teach me. The lesson writer never draws pixels: for each
// bite it fills in one scene from a fixed kit (four families, a handful of
// marks and motions), and the app draws it live with Skia in Fenny's own look.
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
export const LAYOUTS = ["line", "loop", "web"] as const;
export const LINK_KINDS = ["cause", "flow", "tie"] as const;
export const SHAPES = ["rise", "fall", "saturate", "decay", "bell", "s_curve"] as const;
export const HIGHLIGHTS = ["ride", "crossing", "half", "end", "none"] as const;
export const CHANGES = ["appear", "cross", "speed", "grow", "step", "shift", "stretch", "ride", "weigh"] as const;

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
export type Scene = ParticlesScene | LinksScene | GraphScene | BalanceScene;

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

export const SCENE_PROMPT = `Each bite also gets a scene: a small live drawing the app animates. You do not draw. You pick one of four families and fill it in. Use a scene whenever something moves, changes amount, connects or is weighed. Use null only when nothing visual helps, and then the picture field is used instead.

The look is fixed: steel-blue dots are things that move (water, heat, money, current, signals), thin silver rings are objects that stay put (molecules, cells, people, firms), coral ("blocked") is only for something stopped or wrong, at most one group. Labels are 1 to 3 words.

particles: stuff moving between places.
  zones: 1 to 3 area labels, left to right (use "" for no label).
  divider between zones: none, wall, membrane (dashed, things can cross), sieve (gaps, small things pass).
  things: 1 to 3 groups. mark dot, ring or blocked. count 1 to 16. zone = index of the zone it starts in. to = zone it heads to (same as zone if it stays).
  motion: still, drift (slow wander), jiggle (vibrating, like heat), cross (travels from zone to "to" and loops), rise, fall, orbit (circles the zone centre), pulse, flow (streams across everything).
links: things joined in a chain.
  layout: line (a sequence left to right), loop (a cycle, or a circuit when there are 2 nodes), web (a network).
  nodes: 2 to 7 labels. links: from and to are node indexes, in the order they happen. kind cause (an arrow with a pulse), flow (a stream of dots), tie (a faint dashed bond, like an alliance).
graph: one thing changes with another.
  x and y: axis labels. curves: 1 or 2. shape rise, fall (straight lines), saturate (rises then levels off), decay (falls then levels off), bell, s_curve. label: 1 or 2 letters or a short word shown at its end.
  highlight: ride (a lit point travels the curve), crossing (where two curves meet, with guides to both axes), half (the halfway height of a saturate curve, for things like Km), end (the value at the right-hand end), none.
balance: two sides being weighed. left and right labels, leftWeight and rightWeight 1 to 6, middle = a short label under the pivot, or "".

play: at most one bite per lesson (usually the first or second) gets a slider that changes its scene, so the student can try the idea with their own hands. Others get null. Only add play when moving the slider really shows the idea.
  prompt: an instruction under 8 words, like "Add sugar to the right." low and high: 1 to 3 word slider end labels.
  readouts: exactly 3 short lines, said at the low end, the middle and the high end. Each states what they see and why, under 16 words.
  changes: 1 or 2. target is a thing or curve name, "left" or "right" for balance, "" for links.
    particles: appear (the group fades in as the slider rises), cross (the group moves from zone to "to"), speed (the group moves faster), grow (gets bigger).
    links: step (links appear one by one in their order, like time passing), speed (pulses run faster).
    graph: shift (the curve moves right), stretch (saturate and decay level off later, bell gets wider), ride (the lit point moves along the curve).
    balance: weigh (that side gets heavier, from nothing to 6).

What makes a good scene:
- Draw the real thing with its real names from the notes or topic: "Serbia" and "Russia", never "A", "State 1" or "Ally". "Sucrose", not "solute 2".
- Show everything the idea needs. A demand shift needs the supply curve too. Osmosis needs the solute as well as the water.
- Give every group a different name. Do not split one substance into two groups.
- A slider must move the cause and let them watch the effect: add the solute and watch the water cross, raise demand and watch price and quantity rise, step through dates and watch the war spread. Never a slider that only makes things faster or busier unless speed is the idea.
- Most ideas fit a family, even abstract ones. A legal test, an argument or a decision is often a links chain (Advert, then Customer offers, then Shop accepts, then Contract) or a balance. A trend or a rate is a graph.

Examples (scene, then play):
Osmosis: {"family":"particles","zones":["Dilute","Concentrated"],"divider":"membrane","things":[{"name":"water","mark":"dot","count":14,"zone":0,"to":1,"motion":"drift"},{"name":"sugar","mark":"ring","count":8,"zone":1,"to":1,"motion":"still"}]} play {"prompt":"Add sugar to the right.","low":"No sugar","high":"Lots of sugar","readouts":["Same on both sides, so no overall movement.","More sugar on the right, so water starts moving right.","Lots of sugar on the right. Most of the water has crossed."],"changes":[{"target":"sugar","does":"appear"},{"target":"water","does":"cross"}]}
Demand rises: {"family":"graph","x":"Quantity","y":"Price","curves":[{"name":"supply","shape":"rise","label":"S"},{"name":"demand","shape":"fall","label":"D"}],"highlight":"crossing"} play {"prompt":"Raise demand.","low":"Old demand","high":"Demand up","readouts":["Demand meets supply at one price, the equilibrium.","Demand shifts right, so there is a shortage and price is bid up.","New equilibrium with a higher price and more sold."],"changes":[{"target":"demand","does":"shift"}]}
Alliances in 1914: {"family":"links","layout":"web","nodes":["Austria-Hungary","Serbia","Russia","Germany","France","Britain"],"links":[{"from":0,"to":1,"kind":"cause"},{"from":2,"to":1,"kind":"tie"},{"from":3,"to":2,"kind":"cause"},{"from":3,"to":4,"kind":"cause"},{"from":5,"to":3,"kind":"cause"}]} play {"prompt":"Step through summer 1914.","low":"28 June","high":"4 August","readouts":["Austria-Hungary declares war on Serbia.","Russia backs Serbia, so Germany declares war on Russia and France.","Britain joins. A local crisis is now a European war."],"changes":[{"target":"","does":"step"}]}
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
      // At most one coral group, and no more than 36 marks in all.
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
    scene.family === "particles" ? scene.things.map((t) => t.name) : scene.family === "graph" ? scene.curves.map((c) => c.name) : scene.family === "balance" ? ["left", "right"] : [""];
  const changes = (Array.isArray(r.changes) ? r.changes : [])
    .slice(0, 2)
    .map((c: Record<string, unknown>) => ({ target: String(c.target ?? "").trim().toLowerCase(), does: c.does as Play["changes"][number]["does"] }))
    .filter((c) => ALLOWED[scene.family].includes(c.does))
    .map((c) => (scene.family === "links" ? { ...c, target: "" } : c))
    .filter((c) => names.includes(c.target));
  const readouts = (Array.isArray(r.readouts) ? r.readouts : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
  if (!changes.length || readouts.length < 2) return null;
  while (readouts.length < 3) readouts.splice(1, 0, readouts[0]);
  return { prompt: String(r.prompt ?? "").trim() || "Move the slider.", low: short(r.low) || "Less", high: short(r.high) || "More", readouts, changes };
}
