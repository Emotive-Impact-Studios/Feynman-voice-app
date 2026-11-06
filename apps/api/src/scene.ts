// Drawn scenes for Teach me. The lesson writer never draws pixels: for each
// bite it fills in one scene from a fixed kit (thirty families covering
// thirty-four devices: scale, comparison, path, fork, loop, network,
// container, plot, stairs, spectrum, Venn, balance, pair, tree, test,
// threshold, units, crowd, grid, timeline, layers, wave, mirror, stack,
// radial, cutaway, funnel, sankey, fan, spiral, zoom, brace, map and things),
// and the app draws it live with Skia. Things are drawn objects (people,
// planets, cells, coins, buildings, metaphors) from the same few marks.
// The look follows the principles of Visual Value, softened for Fenny: one
// idea per picture, silver lines on near-black, only one thing lit.
// One bite per lesson may also carry a "play" slider that changes the scene.
//
// The visual language (see the Fenny Drawing Kit page) is enforced here: the
// model can only choose from these lists, and checkScene() trims anything the
// app could not draw well. A broken scene becomes null, and the app falls back
// to the simple diagram.

export const FAMILIES = [
  "particles", "links", "graph", "balance", "compare", "stairs", "spectrum", "venn", "pair", "tree", "test", "threshold", "units", "crowd",
  "grid", "timeline", "layers", "wave", "mirror", "stack", "radial", "cutaway", "funnel", "sankey", "fan", "spiral", "zoom", "brace", "map", "things",
] as const;
export const MARKS = ["dot", "ring", "blocked"] as const;
export const MOTIONS = ["still", "drift", "jiggle", "cross", "rise", "fall", "orbit", "pulse", "flow"] as const;
export const DIVIDERS = ["none", "wall", "membrane", "sieve"] as const;
export const LAYOUTS = ["line", "fork", "loop", "web"] as const;
export const LINK_KINDS = ["cause", "flow", "tie"] as const;
export const SHAPES = ["rise", "fall", "saturate", "decay", "bell", "s_curve"] as const;
export const HIGHLIGHTS = ["ride", "crossing", "half", "end", "none"] as const;
export const CHANGES = ["appear", "cross", "speed", "grow", "step", "shift", "stretch", "ride", "weigh", "climb", "slide", "overlap", "fill"] as const;
export const COMPARE_STYLES = ["circles", "bars"] as const;
/** The little pictures a pair can set side by side. Each has one meaning. */
export const PAIR_SHAPES = ["line", "curve", "jagged", "smooth", "split", "join", "scatter", "aligned", "one", "many", "loop", "path"] as const;
/** The shape of the many grey lines in a crowd, and of the one that stands out. */
export const CROWD_SHAPES = ["rise", "fall", "flat"] as const;
export const STANDOUT_SHAPES = ["rise", "fall", "flat", "peak", "dip"] as const;
export const TIMELINE_SCALES = ["even", "true"] as const;
export const LAYER_STYLES = ["stack", "nested"] as const;
export const WAVE_KINDS = ["transverse", "longitudinal"] as const;
export const STACK_ACTIONS = ["push", "pop"] as const;
export const THING_LAYOUTS = ["row", "versus", "chain", "orbit", "scale"] as const;
/** Every drawn thing the app knows (apps/mobile/src/teach/scene/things.ts), by group. A test keeps the two lists the same. */
export const THING_GROUPS = {
  "People and the body": ["person", "people", "face", "hand", "eye", "brain", "heart", "lungs", "cell", "dna", "virus", "bacterium", "tooth", "bone", "kidney", "stomach", "neuron", "ear", "chromosome", "mitochondrion", "skeleton", "family"],
  "Earth and space": ["sun", "moon", "planet", "earth", "star", "rocket", "cloud", "raindrop", "lightning", "snowflake", "flame", "mountain", "tree", "leaf", "flower", "sprout", "water", "volcano"],
  "Science": ["atom", "molecule", "flask", "magnet", "battery", "bulb", "gear", "thermometer", "pill", "spring", "microscope", "telescope", "magnifier", "prism", "pendulum", "beaker", "circuit"],
  "Money and society": ["coin", "banknote", "house", "factory", "building", "crown", "flag", "ballot", "justice", "book", "document", "contract", "pin", "graduation", "speech", "handshake", "shop", "gavel", "prison", "hospital", "school"],
  "Technology": ["computer", "phone", "chip", "database", "lock", "key", "envelope", "signal", "robot", "code", "satellite", "camera", "server", "cloudstore"],
  "Time and ideas": ["clock", "hourglass", "calendar", "target", "trophy", "question", "idea", "puzzle", "shield", "umbrella", "thought", "chain", "hammer", "scales", "mirror"],
  "Transport": ["car", "ship", "plane", "train", "bicycle"],
  "Living things": ["apple", "bird", "fish", "cat", "footprint", "dog", "butterfly", "bee", "frog", "mushroom"],
  "Metaphors": ["iceberg", "dominoes", "snowball", "ladder", "bridge", "door", "signpost", "anchor", "funnel", "wall", "seesaw", "maze", "path", "seed", "gift", "rope", "key_hole", "balloon", "tug", "crossroads", "hill", "toolbox", "battery_low", "staircase", "bucket", "flagpeak"],
  "Health and medicine": ["syringe", "stethoscope", "plaster", "medical", "bed", "clipboard", "drip", "wheelchair"],
  "Energy and environment": ["turbine", "solar", "pylon", "plug", "barrel", "recycle", "tap", "smoke"],
  "Maths and data": ["dice", "card", "ruler", "protractor", "triangle", "cube", "barchart", "linechart", "pie", "abacus", "infinity", "compasses"],
  "Arts, music and sport": ["note", "piano", "guitar", "headphones", "microphone", "palette", "brush", "frame", "ball", "runner", "dumbbell", "medal", "theatre"],
  "History and places": ["castle", "sword", "scroll", "pyramid", "helmet", "candle", "globe", "map", "compass", "quill", "wheel", "tent"],
  "Food and farming": ["bread", "carrot", "wheat", "cow", "cup", "egg", "tractor"],
} as const;
export const THING_NAMES = Object.values(THING_GROUPS).flat();
type ThingName = (typeof THING_GROUPS)[keyof typeof THING_GROUPS][number];

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
/** The difference between X and Y: two small pictures side by side, one lit. */
export interface PairSide {
  label: string;
  shape: (typeof PAIR_SHAPES)[number];
  /** For split, join and many: how many. */
  count: number;
  /** A word or two under the picture, or "". */
  note: string;
}
export interface PairScene {
  family: "pair";
  left: PairSide;
  right: PairSide;
  lit: "left" | "right";
}
/** What branches from what: a root, 2 to 4 branches, a few leaves, one path lit. */
export interface TreeScene {
  family: "tree";
  root: string;
  branches: { label: string; leaves: string[] }[];
  /** The path the lesson is about. leaf -1 means the branch itself. */
  lit: { branch: number; leaf: number };
}
/** Does it pass every condition? A case meets each gate in turn. */
export interface TestScene {
  family: "test";
  case: string;
  gates: string[];
  /** The first gate it fails, or -1 if it passes them all. */
  fails: number;
  outcome: string;
}
/** Has it crossed the line? A level rises against one marked line. */
export interface ThresholdScene {
  family: "threshold";
  level: string;
  line: string;
  /** Where the line sits, 0 (bottom) to 1 (top). */
  at: number;
  /** Where the level ends, 0 to 1. Above at means it crosses. */
  value: number;
}
/** How many out of 100: a grid of 100 dots, some lit. */
export interface UnitsScene {
  family: "units";
  lit: number;
  label: string;
  rest: string;
  /** A thing to count with instead of dots (person, coin), or "". */
  thing: string;
}
/** Which one stands out from many: grey lines, one lit and named. */
export interface CrowdScene {
  family: "crowd";
  x: string;
  y: string;
  count: number;
  crowd: (typeof CROWD_SHAPES)[number];
  lit: string;
  litShape: (typeof STANDOUT_SHAPES)[number];
}
/** Where it falls on two scales at once: a two by two with one item placed. */
export interface GridScene {
  family: "grid";
  x: string;
  y: string;
  /** Top left, top right, bottom left, bottom right; "" for none. */
  quadrants: string[];
  item: string;
  /** Where the item sits, 0 to 1 along each axis (y 1 is the top). */
  atX: number;
  atY: number;
}
/** When, and in what order: events along a line, one lit. */
export interface TimelineScene {
  family: "timeline";
  events: { label: string; when: string; t: number }[];
  /** even spaces events equally; true places them by t. */
  scale: (typeof TIMELINE_SCALES)[number];
  at: number;
}
/** What is built on, or inside, what: bands top first, one lit. */
export interface LayersScene {
  family: "layers";
  layers: string[];
  style: (typeof LAYER_STYLES)[number];
  at: number;
  whole: string;
}
/** What repeats as it travels: particles move up and down (or to and fro), the wave moves along. */
export interface WaveScene {
  family: "wave";
  kind: (typeof WAVE_KINDS)[number];
  what: string;
  wavelength: string;
  amplitude: string;
}
/** What is the partner of this: two columns across a mirror line; lighting one lights its partner. */
export interface MirrorScene {
  family: "mirror";
  leftTitle: string;
  rightTitle: string;
  pairs: { left: string; right: string }[];
  lit: number;
}
/** What goes on top, and what comes off first: boxes, bottom first. */
export interface StackScene {
  family: "stack";
  label: string;
  items: string[];
  action: (typeof STACK_ACTIONS)[number];
}
/** What sits round one centre: spokes, or stages round a circle. */
export interface RadialScene {
  family: "radial";
  centre: string;
  spokes: string[];
  lit: number;
  /** True when the spokes are stages gone round in order. */
  cycle: boolean;
}
/** What a whole is made of, and in what shares. */
export interface CutawayScene {
  family: "cutaway";
  whole: string;
  parts: { label: string; share: number }[];
  lit: number;
}
/** How many drop out at each stage. Values fall from the top stage down. */
export interface FunnelScene {
  family: "funnel";
  stages: { label: string; value: number }[];
  lit: number;
}
/** How one flow splits, by amount. */
export interface SankeyScene {
  family: "sankey";
  source: string;
  splits: { label: string; share: number }[];
  lit: number;
}
/** How uncertain a forecast gets further ahead: the past, then a widening fan. */
export interface FanScene {
  family: "fan";
  x: string;
  y: string;
  shape: (typeof CROWD_SHAPES)[number];
  /** Where the past ends, 0.3 to 0.8 of the way along. */
  now: number;
  label: string;
}
/** A loop that climbs: stages gone round again and again, each time further out. */
export interface SpiralScene {
  family: "spiral";
  stages: string[];
  turns: number;
  label: string;
}
/** The same thing at each scale, biggest first. */
export interface ZoomScene {
  family: "zoom";
  levels: { label: string; size: string }[];
  at: number;
}
/** Which belong together: a row of items with braces under groups. */
export interface BraceScene {
  family: "brace";
  items: string[];
  groups: { label: string; from: number; to: number }[];
  lit: number;
}
/** Where places are, and what moves between them. A schematic map, north up. */
export interface MapScene {
  family: "map";
  places: { label: string; x: number; y: number }[];
  routes: { from: number; to: number }[];
  lit: number;
}
/** Real objects, people and places, drawn: in a row, two against each other,
 * one becoming the next, one going round another, or at their real sizes. */
export interface ThingsScene {
  family: "things";
  layout: (typeof THING_LAYOUTS)[number];
  items: { thing: ThingName; label: string; size: number }[];
  lit: number;
}
export type Scene =
  | ParticlesScene
  | LinksScene
  | GraphScene
  | BalanceScene
  | CompareScene
  | StairsScene
  | SpectrumScene
  | VennScene
  | PairScene
  | TreeScene
  | TestScene
  | ThresholdScene
  | UnitsScene
  | CrowdScene
  | GridScene
  | TimelineScene
  | LayersScene
  | WaveScene
  | MirrorScene
  | StackScene
  | RadialScene
  | CutawayScene
  | FunnelScene
  | SankeyScene
  | FanScene
  | SpiralScene
  | ZoomScene
  | BraceScene
  | MapScene
  | ThingsScene;

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
const arr = (items: unknown) => ({ type: "array", items });
const bool = { type: "boolean" };

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
    obj({
      family: en(["pair"]),
      left: obj({ label: str, shape: en(PAIR_SHAPES), count: int, note: str }),
      right: obj({ label: str, shape: en(PAIR_SHAPES), count: int, note: str }),
      lit: en(["left", "right"]),
    }),
    obj({ family: en(["tree"]), root: str, branches: { type: "array", items: obj({ label: str, leaves: strs }) }, lit: obj({ branch: int, leaf: int }) }),
    obj({ family: en(["test"]), case: str, gates: strs, fails: int, outcome: str }),
    obj({ family: en(["threshold"]), level: str, line: str, at: num, value: num }),
    obj({ family: en(["units"]), lit: int, label: str, rest: str, thing: str }),
    obj({ family: en(["crowd"]), x: str, y: str, count: int, crowd: en(CROWD_SHAPES), lit: str, litShape: en(STANDOUT_SHAPES) }),
    obj({ family: en(["grid"]), x: str, y: str, quadrants: strs, item: str, atX: num, atY: num }),
    obj({ family: en(["timeline"]), events: arr(obj({ label: str, when: str, t: num })), scale: en(TIMELINE_SCALES), at: int }),
    obj({ family: en(["layers"]), layers: strs, style: en(LAYER_STYLES), at: int, whole: str }),
    obj({ family: en(["wave"]), kind: en(WAVE_KINDS), what: str, wavelength: str, amplitude: str }),
    obj({ family: en(["mirror"]), leftTitle: str, rightTitle: str, pairs: arr(obj({ left: str, right: str })), lit: int }),
    obj({ family: en(["stack"]), label: str, items: strs, action: en(STACK_ACTIONS) }),
    obj({ family: en(["radial"]), centre: str, spokes: strs, lit: int, cycle: bool }),
    obj({ family: en(["cutaway"]), whole: str, parts: arr(obj({ label: str, share: num })), lit: int }),
    obj({ family: en(["funnel"]), stages: arr(obj({ label: str, value: num })), lit: int }),
    obj({ family: en(["sankey"]), source: str, splits: arr(obj({ label: str, share: num })), lit: int }),
    obj({ family: en(["fan"]), x: str, y: str, shape: en(CROWD_SHAPES), now: num, label: str }),
    obj({ family: en(["spiral"]), stages: strs, turns: int, label: str }),
    obj({ family: en(["zoom"]), levels: arr(obj({ label: str, size: str })), at: int }),
    obj({ family: en(["brace"]), items: strs, groups: arr(obj({ label: str, from: int, to: int })), lit: int }),
    obj({ family: en(["map"]), places: arr(obj({ label: str, x: num, y: num })), routes: arr(obj({ from: int, to: int })), lit: int }),
    obj({ family: en(["things"]), layout: en(THING_LAYOUTS), items: arr(obj({ thing: str, label: str, size: num })), lit: int }),
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

const THING_MENU = Object.entries(THING_GROUPS)
  .map(([g, names]) => `  ${g}: ${names.join(", ")}.`)
  .join("\n");

export const SCENE_PROMPT = `Each bite also gets a scene: one small live drawing that makes one point. You do not draw. You pick one device and fill in its slots, and the app draws it in Fenny's style (soft silver lines on near-black, one thing lit, built in a few beats). Use a scene for almost every bite. Use null only when no device fits, and then the picture field is used instead.

How to choose, in this order:
1. Find the question the idea answers (who or what, how much, where, when, how, why). Who or what: things (show the real object, person or place). How much: compare, spectrum, graph, units, cutaway, funnel or things with layout scale. When: timeline, links line or stairs. Where: map, grid or layers. How: links, particles, wave, loop or things with layout chain or orbit. Why: graph or balance. What kind: tree, venn, brace or pair.
2. If the idea is "the difference between X and Y", use pair.
3. If no picture comes to mind, turn the key sentence into a chart: "A and B overlap" is a venn, "more X gives more Y" is a graph.
4. Check it before you answer. Clear at a glance? Builds left to right in the order it is spoken? Uses a real example the student knows? Simple but never wrong, so a lecturer could not mark it wrong? If any answer is no, simplify or use null.

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
- What is the difference between two things? pair.
- What branches from what (kinds of, a family, a classification)? tree.
- Does it pass every condition (a legal test, diagnostic criteria)? test.
- Has it crossed a line (a standard of proof, a quota, a firing threshold)? threshold.
- How many out of how many (a risk, a probability, a proportion)? units.
- Which one stands out from many (one country, case or patient against the rest)? crowd.
- Where does it fall on two scales at once (a two by two, like urgent and important)? grid.
- When did things happen, and in what order over time? timeline.
- What is built on, or inside, what (a protocol stack, the Earth's layers, skin)? layers.
- What repeats as it travels (sound, light, a wave on a rope)? wave.
- What is the partner or opposite of this (a right and its duty, oxidation and reduction)? mirror.
- What goes on top, and what comes off first (last in, first out)? stack.
- What sits round one centre, or goes round in stages (a hub and spokes, a story circle)? radial.
- What is a whole made of, and in what shares (air, a budget, a genome)? cutaway.
- How many drop out at each stage (applicants to offers, visitors to buyers)? funnel.
- How does one flow split, by amount (energy in, useful energy out)? sankey.
- How uncertain is a forecast as it reaches further ahead? fan.
- What cycle builds on itself each time round (the spiral curriculum, compounding practice)? spiral.
- What does it look like at each scale, from big to small (body to cell to molecule)? zoom.
- Which items belong together in groups (ionising and non-ionising radiation)? brace.
- Where are places, and what moves between them (a trade route, a migration, a campaign)? map.
- What does it look like, who is involved, or what real object is it (the Earth and Moon, a cell, a bank and a factory)? things.

The devices:
particles: zones (1 to 3 area labels, left to right, "" for none), divider (none, wall, membrane = dashed and crossable, sieve = gaps), things (1 to 3 groups: name, mark dot = something that moves, ring = an object, blocked = something stopped, at most one group; count 1 to 16; zone it starts in; to = zone it heads to, same as zone if it stays; motion still, drift, jiggle like heat, cross from zone to "to", rise, fall, orbit, pulse, flow).
links: layout line, fork, loop or web. nodes 2 to 7 labels. links from and to node indexes, in the order they happen, kind cause (one light travels the cause links in the order listed, lighting each node it reaches, so list them in the order things happen), flow (stream of dots), tie (faint dashed bond, like an alliance).
graph: x and y axis labels. curves 1 or 2: name, shape (rise, fall = straight lines, saturate = rises then levels off, decay = falls then levels off, bell, s_curve), label of 1 or 2 letters or a short word. highlight ride (a lit point travels the curve), crossing (where two curves meet), half (half height of a saturate curve, like Km), end (value at the right), none.
balance: left and right labels, leftWeight and rightWeight 0 to 6, middle = a short label under the pivot or "".
compare: style circles or bars. items 2 to 6 with a label and a positive value in real proportion (Earth 1, Sun 109). The biggest or most important item is lit.
stairs: steps 2 to 6 labels, bottom step first. at = index of the step that is lit.
spectrum: left and right end labels, min and max numbers, marks 0 to 4 reference points (label, at), at = where the lit marker sits.
venn: a and b labels, both = the label for the overlap, overlap 0 to 1.
pair: left and right, each with a label, a shape and count (2 to 8, only for split, join and many) and a short note or "". lit = the side the lesson points to. Shapes, each with one meaning: line = steady, linear growth; curve = compounding, exponential; jagged = noisy, short-term ups and downs; smooth = the long-run trend; split = one becomes several; join = several become one; scatter = random, unfocused; aligned = ordered, all one way; one = a single whole; many = lots of small parts; loop = repeats in a cycle; path = one way, start to end.
tree: root label, branches 2 to 4 (label, leaves 0 to 3 labels, at most 6 leaves in all), lit = the path the lesson is about: branch index and leaf index (leaf -1 for the branch itself). A light travels from the root down that path.
test: case = what is tested (1 to 3 words), gates = 2 to 5 conditions in the order they are applied (1 or 2 words each), fails = index of the first gate it fails, or -1 if it passes them all, outcome = what follows (1 to 3 words, like "No duty" or "Liable").
threshold: level = what builds up, line = the name of the line, at = where the line sits (0 bottom to 1 top), value = where the level ends (0 to 1). It crosses when value is above at.
units: lit = how many in 100 (a real figure from the notes or standard knowledge, rounded), label = what the lit ones are, rest = what the others are, each 1 to 4 words.
crowd: x and y axis labels, count 8 to 16 grey lines, crowd = their shape (rise, fall, flat), lit = the label of the one that stands out, litShape = its shape (rise, fall, flat, peak, dip).
grid: x and y axis names (the axis grows to the right and upwards), quadrants = 4 short labels in the order top left, top right, bottom left, bottom right ("" for none), item = what is placed, atX and atY = where it sits, 0 to 1.
timeline: events 2 to 6 in time order (label 1 to 3 words, when = a short date like "1914" or "65 Mya", t = a number for that time in one unit, years BC negative), scale even (equal gaps) or true (gaps in proportion to t, only when the gaps are the point), at = index of the lit event.
layers: layers 2 to 6, top or outermost first, style stack (each built on the one below) or nested (each inside the one before, drawn as half rings), at = index of the lit layer, whole = what they make up, or "".
wave: kind transverse (particles move up and down, like a rope or light) or longitudinal (particles move to and fro along the wave, like sound), what = what the particles are (1 to 3 words), wavelength and amplitude = their labels, or "" to leave one out.
mirror: leftTitle and rightTitle name the two sides, pairs 2 to 4 (left and right, partners on the same row), lit = the pair the lesson is about.
stack: label = what the stack is, items 2 to 6, bottom first, action push (the top item arrives last) or pop (the top item comes off).
radial: centre label, spokes 3 to 8 labels clockwise from the top, lit = index of the lit spoke, cycle true when the spokes are stages gone round in order (a light travels round the rim), false for a hub and its parts.
cutaway: whole = what is cut open, parts 2 to 6 (label and share, real percentages that add up to about 100), lit = index of the lit part.
funnel: stages 2 to 6, top first, each with a label and a real value that never rises down the funnel, lit = the stage the lesson is about (often the biggest drop).
sankey: source = what flows in, splits 2 to 5 (label and share, real percentages adding up to 100), lit = index of the lit split.
fan: x and y axis labels, shape = the trend (rise, fall, flat), now = where the record ends and the forecast begins (0.3 to 0.8), label = what the central forecast is.
spiral: stages 2 to 5 for one turn, turns 2 or 3, label = what grows each time round, or "".
zoom: levels 2 to 5, biggest first (label and size, like "Cell" and "10 µm", size "" if unknown), at = index of the lit level.
brace: items 3 to 7 in a row, groups 1 to 3 (label, from and to = the first and last item index in the group, groups never overlap), lit = index of the lit group.
map: places 2 to 6 (label, x = 0 west to 1 east, y = 0 south to 1 north, rough real positions, never invented), routes 0 to 6 (from and to place indexes, in the order they happen), lit = index of the lit place. It draws dots and routes only, never coastlines.
things: drawn objects, people and places from the list below, each with a label (1 to 3 words) and a size. layout row (1 to 5 things side by side: examples of a kind, or one big picture), versus (exactly 2, set against each other), chain (2 to 4, each becoming or causing the next, joined by arrows), orbit (2 or 3: item 1 goes round item 0, and item 2 goes round item 1, like the Sun, Earth and Moon), scale (2 to 4 drawn at their real relative sizes standing on one line; size = a real number in one unit, smallest first). size is 1 for other layouts. lit = index of the lit thing. Only use names from this list; if nothing in it is the thing, use another device:
${THING_MENU}
  A metaphor (iceberg, dominoes, snowball, ladder, bridge and so on) only when the notes use that image or it is the standard teaching image for the idea, never as decoration.
units: also thing = a thing from the list to count with instead of dots (person for people, coin for money), or "".

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
    pair: step (the right side builds in as the slider rises, so the difference appears).
    tree: step (the light walks down the lit path). test: step (the case moves through the gates). threshold: fill (the level rises from empty to full). units: grow (the lit dots count up to lit).
    grid: slide (the item moves from the opposite corner to its place). wave: speed (higher frequency), stretch (longer wavelength), grow (bigger amplitude). fan: grow (the forecast's spread widens).
    timeline, layers, mirror, stack, radial, cutaway, funnel, sankey, spiral, zoom, brace and map: step (the light moves through the parts in order).
    things: step (the light moves through the things in order), speed (for orbit: it goes round faster).

caption: one short sentence under 9 words that states the point, ending with a full stop, like "Water follows the sugar."

What makes a good scene:
- One idea per picture. If you need two pictures, it belongs in two bites.
- Use real names from the notes or topic: "Serbia", never "A" or "State 1". "Sucrose", not "solute 2". Every group or item has a different name.
- Show what the idea needs and nothing else. A demand shift needs the supply curve too. Osmosis needs the solute as well as the water.
- A slider moves the cause so they can watch the effect. Never a slider that only makes things busier unless speed is the idea.
- Be honest. compare values must be real quantities in one unit (convert first: Neptune is 30 AU, Proxima Centauri is about 268,000 AU). Never invent numbers to compare two ideas.
- Labels name real things (Serbia, Supply, Sucrose), never placeholder steps like "One move", "Start" or "Allies react".
- Use a different device for each bite of a lesson, so the student sees something new every time. Most ideas fit more than one device honestly: pick another that fits rather than repeating one.
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
Civil burden of proof: {"family":"balance","left":"Defendant","right":"Claimant","leftWeight":3,"rightWeight":4,"middle":"51%"}
Mitosis and meiosis: {"family":"pair","left":{"label":"Mitosis","shape":"split","count":2,"note":"2 identical cells"},"right":{"label":"Meiosis","shape":"split","count":4,"note":"4 different cells"},"lit":"right"}
Kinds of animal: {"family":"tree","root":"Animals","branches":[{"label":"Vertebrates","leaves":["Mammals","Birds","Fish"]},{"label":"Invertebrates","leaves":["Insects","Molluscs"]}],"lit":{"branch":0,"leaf":0}}
Duty of care (Caparo): {"family":"test","case":"Claim","gates":["Foreseeable","Proximity","Fair"],"fails":2,"outcome":"No duty"}
Action potential: {"family":"threshold","level":"Voltage","line":"Threshold","at":0.6,"value":0.85}
Side effect risk: {"family":"units","lit":4,"label":"get a side effect","rest":"do not","thing":"person"}
Life expectancy in the 1990s: {"family":"crowd","x":"Year","y":"Life expectancy","count":12,"crowd":"rise","lit":"Russia","litShape":"dip"}
Eisenhower matrix: {"family":"grid","x":"Urgent","y":"Important","quadrants":["Schedule","Do now","Drop","Delegate"],"item":"Exam revision","atX":0.3,"atY":0.85}
Life on Earth: {"family":"timeline","events":[{"label":"First life","when":"3.8 bn","t":-3800},{"label":"First animals","when":"600 Mya","t":-600},{"label":"Dinosaurs die","when":"66 Mya","t":-66},{"label":"Humans","when":"0.3 Mya","t":-0.3}],"scale":"true","at":3}
Layers of the Earth: {"family":"layers","layers":["Crust","Mantle","Outer core","Inner core"],"style":"nested","at":2,"whole":"Earth"}
Sound: {"family":"wave","kind":"longitudinal","what":"Air particles","wavelength":"Wavelength","amplitude":""}
Hohfeld: {"family":"mirror","leftTitle":"I have","rightTitle":"You have","pairs":[{"left":"Right","right":"Duty"},{"left":"Privilege","right":"No-right"}],"lit":0}
Call stack: {"family":"stack","label":"Call stack","items":["main","sort","swap"],"action":"push"}
Composition of air: {"family":"cutaway","whole":"Air","parts":[{"label":"Nitrogen","share":78},{"label":"Oxygen","share":21},{"label":"Other","share":1}],"lit":1}
Power station: {"family":"sankey","source":"Fuel energy","splits":[{"label":"Electricity","share":35},{"label":"Heat lost","share":65}],"lit":0}
Levels of organisation: {"family":"zoom","levels":[{"label":"Body","size":"1.7 m"},{"label":"Heart","size":"12 cm"},{"label":"Muscle cell","size":"100 µm"}],"at":2}
Triangular trade: {"family":"map","places":[{"label":"Britain","x":0.55,"y":0.85},{"label":"West Africa","x":0.6,"y":0.4},{"label":"Caribbean","x":0.1,"y":0.5}],"routes":[{"from":0,"to":1},{"from":1,"to":2},{"from":2,"to":0}],"lit":1}
Earth and Moon: {"family":"things","layout":"orbit","items":[{"thing":"sun","label":"Sun","size":1},{"thing":"earth","label":"Earth","size":1},{"thing":"moon","label":"Moon","size":1}],"lit":2}
Growth from a seed: {"family":"things","layout":"chain","items":[{"thing":"seed","label":"Seed","size":1},{"thing":"sprout","label":"Seedling","size":1},{"thing":"tree","label":"Tree","size":1}],"lit":2}
Climbing Everest: {"family":"things","layout":"scale","items":[{"thing":"person","label":"Climber, 1.8 m","size":1.8},{"thing":"house","label":"House, 8 m","size":8},{"thing":"mountain","label":"Everest, 8,849 m","size":8849}],"lit":0}
Visible and hidden costs: {"family":"things","layout":"row","items":[{"thing":"iceberg","label":"Most costs are hidden","size":1}],"lit":0}
Viruses and bacteria: {"family":"things","layout":"versus","items":[{"thing":"virus","label":"Virus","size":1},{"thing":"bacterium","label":"Bacterium","size":1}],"lit":0}
Weather and climate: {"family":"pair","left":{"label":"Weather","shape":"jagged","count":0,"note":"Day to day"},"right":{"label":"Climate","shape":"smooth","count":0,"note":"Over 30 years"},"lit":"right"}`;

// ---- checking ----

const clampInt = (n: unknown, lo: number, hi: number, d: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
};
const short = (s: unknown, words = 3, max = 22) => {
  // Whole words only, up to max characters, so a cut never leaves half a word.
  const ws = String(s ?? "").trim().split(/\s+/).filter(Boolean).slice(0, words);
  let out = ws.length ? ws[0].slice(0, max) : "";
  let cut = ws.length > 0 && ws[0].length > max;
  for (let i = 1; i < ws.length; i++) {
    if (out.length + 1 + ws[i].length > max) { cut = true; break; }
    out += " " + ws[i];
  }
  if (String(s ?? "").trim().split(/\s+/).filter(Boolean).length > ws.length) cut = true;
  // A cut that leaves a bracket open drops the bracketed part: "Before (per" is "Before".
  out = out.replace(/\s*\([^)]*$/, "").replace(/[\s,;:]+$/, "");
  // A cut never ends on a little joining word: "Add to cart" cut short is "Add", not "Add to".
  if (cut) while (/\s(to|of|the|a|an|and|or|for|in|on|at|by|with|from|into|as|is|are)$/i.test(out)) out = out.replace(/\s+\S+$/, "");
  return out;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

const num01 = (x: unknown, d: number, lo = 0, hi = 1) => (Number.isFinite(Number(x)) ? Math.max(lo, Math.min(hi, Number(x))) : d);
const labels = (x: unknown, max: number, words = 3) => (Array.isArray(x) ? x : []).map((v) => short(v, words)).filter(Boolean).slice(0, max);
/** Shares as fractions adding to 1, or equal shares if they are missing. */
const isThing = (x: unknown) => typeof x === "string" && (THING_NAMES as readonly string[]).includes(x);
const shares = (xs: number[]) => {
  const ok = xs.every((v) => Number.isFinite(v) && v > 0);
  const total = ok ? xs.reduce((a, b) => a + b, 0) : 0;
  return xs.map((v) => (ok && total > 0 ? v / total : 1 / xs.length));
};

const ALLOWED: Record<Scene["family"], readonly Play["changes"][number]["does"][]> = {
  particles: ["appear", "cross", "speed", "grow"],
  links: ["step", "speed"],
  graph: ["shift", "stretch", "ride"],
  balance: ["weigh"],
  compare: ["grow", "step"],
  stairs: ["climb"],
  spectrum: ["slide"],
  venn: ["overlap"],
  pair: ["step"],
  tree: ["step"],
  test: ["step"],
  threshold: ["fill"],
  units: ["grow"],
  crowd: [],
  grid: ["slide"],
  timeline: ["step"],
  layers: ["step"],
  wave: ["speed", "stretch", "grow"],
  mirror: ["step"],
  stack: ["step"],
  radial: ["step"],
  cutaway: ["step"],
  funnel: ["step"],
  sankey: ["step"],
  fan: ["grow"],
  spiral: ["step"],
  zoom: ["step"],
  brace: ["step"],
  map: ["step"],
  things: ["step", "speed"],
};
/** Families whose slider changes name a thing in the scene. All others use "". */
const NAMED_TARGETS: readonly string[] = ["particles", "graph", "balance", "compare"];

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
        label: short(c.label, 2, 10),
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
        middle: short(r.middle, 3, 8),
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
    if (r.family === "pair") {
      const side = (x: unknown): PairSide | null => {
        if (!x || typeof x !== "object") return null;
        const o = x as Record<string, unknown>;
        const label = short(o.label);
        if (!label) return null;
        const shape = oneOf(o.shape, PAIR_SHAPES, "path");
        const counted = shape === "split" || shape === "join" || shape === "many";
        return { label, shape, count: counted ? clampInt(o.count, 2, 8, shape === "many" ? 8 : 2) : 0, note: short(o.note, 4, 26) };
      };
      const left = side(r.left);
      const right = side(r.right);
      if (!left || !right) return null;
      return { family: "pair", left, right, lit: r.lit === "left" ? "left" : "right" };
    }
    if (r.family === "tree") {
      let room = 6;
      const branches = (Array.isArray(r.branches) ? r.branches : [])
        .slice(0, 4)
        .map((b: Record<string, unknown>) => {
          const leaves = (Array.isArray(b.leaves) ? b.leaves : []).map((x) => short(x, 2)).filter(Boolean).slice(0, Math.min(3, room));
          room -= leaves.length;
          return { label: short(b.label, 2), leaves };
        })
        .filter((b) => b.label);
      if (branches.length < 2) return null;
      const lit = (r.lit ?? {}) as Record<string, unknown>;
      const branch = clampInt(lit.branch, 0, branches.length - 1, 0);
      const leaves = branches[branch].leaves.length;
      const leaf = leaves ? clampInt(lit.leaf, -1, leaves - 1, 0) : -1;
      return { family: "tree", root: short(r.root, 2) || "All", branches, lit: { branch, leaf } };
    }
    if (r.family === "test") {
      const gates = (Array.isArray(r.gates) ? r.gates : []).slice(0, 5).map((g) => short(g, 2)).filter(Boolean);
      if (gates.length < 2) return null;
      return { family: "test", case: short(r.case) || "Case", gates, fails: clampInt(r.fails, -1, gates.length - 1, -1), outcome: short(r.outcome) };
    }
    if (r.family === "threshold") {
      const unit = (x: unknown, d: number) => (Number.isFinite(Number(x)) ? Math.max(0.05, Math.min(0.95, Number(x))) : d);
      return { family: "threshold", level: short(r.level), line: short(r.line, 4, 26), at: unit(r.at, 0.6), value: unit(r.value, 0.8) };
    }
    if (r.family === "units") {
      const label = short(r.label, 4, 26);
      if (!label) return null;
      return { family: "units", lit: clampInt(r.lit, 1, 99, 10), label, rest: short(r.rest, 4, 26), thing: isThing(r.thing) ? (r.thing as string) : "" };
    }
    if (r.family === "crowd") {
      const lit = short(r.lit, 2);
      if (!lit) return null;
      return {
        family: "crowd",
        x: short(r.x),
        y: short(r.y),
        count: clampInt(r.count, 6, 16, 12),
        crowd: oneOf(r.crowd, CROWD_SHAPES, "rise"),
        lit,
        litShape: oneOf(r.litShape, STANDOUT_SHAPES, "peak"),
      };
    }
    if (r.family === "grid") {
      const q = (Array.isArray(r.quadrants) ? r.quadrants : []).slice(0, 4).map((v) => short(v, 2));
      while (q.length < 4) q.push("");
      const item = short(r.item, 3);
      if (!item) return null;
      return { family: "grid", x: short(r.x, 2), y: short(r.y, 2), quadrants: q, item, atX: num01(r.atX, 0.7, 0.06, 0.94), atY: num01(r.atY, 0.7, 0.06, 0.94) };
    }
    if (r.family === "timeline") {
      const events = (Array.isArray(r.events) ? r.events : [])
        .slice(0, 6)
        .map((e: Record<string, unknown>) => ({ label: short(e.label, 3, 18), when: short(e.when, 2, 12), t: Number(e.t) }))
        .filter((e) => e.label);
      if (events.length < 2) return null;
      // True spacing needs times in order with real gaps; otherwise space them evenly.
      const ordered = events.every((e, i) => Number.isFinite(e.t) && (i === 0 || e.t > events[i - 1].t));
      const scale = r.scale === "true" && ordered ? "true" : "even";
      return { family: "timeline", events: events.map((e, i) => ({ ...e, t: Number.isFinite(e.t) ? e.t : i })), scale, at: clampInt(r.at, 0, events.length - 1, events.length - 1) };
    }
    if (r.family === "layers") {
      const layers = labels(r.layers, 6);
      if (layers.length < 2) return null;
      return { family: "layers", layers, style: oneOf(r.style, LAYER_STYLES, "stack"), at: clampInt(r.at, 0, layers.length - 1, 0), whole: short(r.whole, 3) };
    }
    if (r.family === "wave") {
      return { family: "wave", kind: oneOf(r.kind, WAVE_KINDS, "transverse"), what: short(r.what, 3), wavelength: short(r.wavelength, 2), amplitude: short(r.amplitude, 2) };
    }
    if (r.family === "mirror") {
      const pairs = (Array.isArray(r.pairs) ? r.pairs : [])
        .slice(0, 4)
        .map((x: Record<string, unknown>) => ({ left: short(x.left, 2, 16), right: short(x.right, 2, 16) }))
        .filter((x) => x.left && x.right);
      if (pairs.length < 2) return null;
      return { family: "mirror", leftTitle: short(r.leftTitle, 3), rightTitle: short(r.rightTitle, 3), pairs, lit: clampInt(r.lit, 0, pairs.length - 1, 0) };
    }
    if (r.family === "stack") {
      const items = labels(r.items, 6);
      if (items.length < 2) return null;
      return { family: "stack", label: short(r.label, 3), items, action: oneOf(r.action, STACK_ACTIONS, "push") };
    }
    if (r.family === "radial") {
      const spokes = labels(r.spokes, 8, 2);
      if (spokes.length < 3) return null;
      return { family: "radial", centre: short(r.centre, 2, 12), spokes, lit: clampInt(r.lit, 0, spokes.length - 1, 0), cycle: r.cycle === true };
    }
    if (r.family === "cutaway" || r.family === "sankey") {
      const list = (Array.isArray(r.family === "cutaway" ? r.parts : r.splits) ? ((r.family === "cutaway" ? r.parts : r.splits) as Record<string, unknown>[]) : [])
        .slice(0, r.family === "cutaway" ? 6 : 5)
        .map((x) => ({ label: short(x.label, 2), share: Number(x.share) }))
        .filter((x) => x.label);
      if (list.length < 2) return null;
      const fr = shares(list.map((x) => x.share));
      const parts = list.map((x, i) => ({ label: x.label, share: Math.round(fr[i] * 1000) / 10 }));
      const lit = clampInt(r.lit, 0, parts.length - 1, 0);
      return r.family === "cutaway"
        ? { family: "cutaway", whole: short(r.whole, 2), parts, lit }
        : { family: "sankey", source: short(r.source, 3), splits: parts, lit };
    }
    if (r.family === "funnel") {
      const stages = (Array.isArray(r.stages) ? r.stages : [])
        .slice(0, 6)
        .map((x: Record<string, unknown>) => ({ label: short(x.label, 3, 18), value: Math.abs(Number(x.value)) }))
        .filter((x) => x.label && Number.isFinite(x.value) && x.value > 0);
      if (stages.length < 2) return null;
      // A funnel only narrows.
      for (let i = 1; i < stages.length; i++) if (stages[i].value > stages[i - 1].value) return null;
      return { family: "funnel", stages, lit: clampInt(r.lit, 0, stages.length - 1, stages.length - 1) };
    }
    if (r.family === "fan") {
      return { family: "fan", x: short(r.x), y: short(r.y), shape: oneOf(r.shape, CROWD_SHAPES, "rise"), now: num01(r.now, 0.55, 0.3, 0.8), label: short(r.label, 2) };
    }
    if (r.family === "spiral") {
      const stages = labels(r.stages, 5, 2);
      if (stages.length < 2) return null;
      return { family: "spiral", stages, turns: clampInt(r.turns, 2, 3, 2), label: short(r.label, 5, 32) };
    }
    if (r.family === "zoom") {
      const levels = (Array.isArray(r.levels) ? r.levels : [])
        .slice(0, 5)
        .map((x: Record<string, unknown>) => ({ label: short(x.label, 2, 18), size: short(x.size, 2, 12) }))
        .filter((x) => x.label);
      if (levels.length < 2) return null;
      return { family: "zoom", levels, at: clampInt(r.at, 0, levels.length - 1, levels.length - 1) };
    }
    if (r.family === "brace") {
      const items = labels(r.items, 7, 2);
      if (items.length < 3) return null;
      const ii = (n: unknown, d: number) => clampInt(n, 0, items.length - 1, d);
      const groups: { label: string; from: number; to: number }[] = [];
      for (const g of (Array.isArray(r.groups) ? r.groups : []).slice(0, 3) as Record<string, unknown>[]) {
        const label = short(g.label, 3);
        let from = ii(g.from, 0);
        let to = ii(g.to, from);
        if (to < from) [from, to] = [to, from];
        // Groups never overlap: drop one that does.
        if (!label || groups.some((h) => from <= h.to && to >= h.from)) continue;
        groups.push({ label, from, to });
      }
      if (!groups.length) return null;
      groups.sort((a, b) => a.from - b.from);
      return { family: "brace", items, groups, lit: clampInt(r.lit, 0, groups.length - 1, 0) };
    }
    if (r.family === "map") {
      const places = (Array.isArray(r.places) ? r.places : [])
        .slice(0, 6)
        .map((x: Record<string, unknown>) => ({ label: short(x.label, 2), x: num01(x.x, 0.5), y: num01(x.y, 0.5) }))
        .filter((x) => x.label);
      if (places.length < 2) return null;
      const pi = (n: unknown) => clampInt(n, 0, places.length - 1, 0);
      const routes = (Array.isArray(r.routes) ? r.routes : [])
        .slice(0, 6)
        .map((x: Record<string, unknown>) => ({ from: pi(x.from), to: pi(x.to) }))
        .filter((x) => x.from !== x.to);
      return { family: "map", places, routes, lit: clampInt(r.lit, 0, places.length - 1, 0) };
    }
    if (r.family === "things") {
      const layout = oneOf(r.layout, THING_LAYOUTS, "row");
      const max = { row: 5, versus: 2, chain: 4, orbit: 3, scale: 4 }[layout];
      let items = (Array.isArray(r.items) ? r.items : [])
        .filter((t: Record<string, unknown>) => t && isThing(t.thing))
        .slice(0, max)
        .map((t: Record<string, unknown>) => ({ thing: t.thing as ThingName, label: short(t.label, layout === "row" || layout === "scale" ? 4 : 3, 26), size: Number(t.size) > 0 ? Number(t.size) : 1 }));
      const min = layout === "row" ? 1 : 2;
      if (items.length < min) return null;
      if (layout === "scale") {
        // Smallest first, and only real sizes: drop a scale whose sizes are all the same.
        items = items.sort((a, b) => a.size - b.size);
        if (items[items.length - 1].size <= items[0].size) return null;
      } else items = items.map((t) => ({ ...t, size: 1 }));
      return { family: "things", layout, items, lit: clampInt(r.lit, 0, items.length - 1, items.length - 1) };
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
    .map((c) => (!NAMED_TARGETS.includes(scene.family) || (scene.family === "compare" && c.does === "step") ? { ...c, target: "" } : c))
    .filter((c) => names.includes(c.target));
  const readouts = (Array.isArray(r.readouts) ? r.readouts : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
  if (!changes.length || readouts.length < 2) return null;
  while (readouts.length < 3) readouts.splice(1, 0, readouts[0]);
  return { prompt: String(r.prompt ?? "").trim() || "Move the slider.", low: short(r.low) || "Less", high: short(r.high) || "More", readouts, changes };
}
