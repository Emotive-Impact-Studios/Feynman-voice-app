// The drawn scenes a lesson can send, mirrored from apps/api/src/scene.ts.
// The server has already checked them, so the app can trust the shapes here.
import { THINGS } from "./things";

export type Mark = "dot" | "ring" | "blocked";
export type Motion = "still" | "drift" | "jiggle" | "cross" | "rise" | "fall" | "orbit" | "pulse" | "flow";

export interface Thing {
  name: string;
  mark: Mark;
  count: number;
  zone: number;
  to: number;
  motion: Motion;
}

export interface ParticlesScene {
  family: "particles";
  zones: string[];
  divider: "none" | "wall" | "membrane" | "sieve";
  things: Thing[];
}

export interface LinksScene {
  family: "links";
  layout: "line" | "fork" | "loop" | "web";
  nodes: string[];
  links: { from: number; to: number; kind: "cause" | "flow" | "tie" }[];
}

export type Shape = "rise" | "fall" | "saturate" | "decay" | "bell" | "s_curve";

export interface GraphScene {
  family: "graph";
  x: string;
  y: string;
  curves: { name: string; shape: Shape; label: string }[];
  highlight: "ride" | "crossing" | "half" | "end" | "none";
}

export interface BalanceScene {
  family: "balance";
  left: string;
  right: string;
  leftWeight: number;
  rightWeight: number;
  middle: string;
}

export interface CompareScene {
  family: "compare";
  style: "circles" | "bars";
  items: { label: string; value: number }[];
}

export interface StairsScene {
  family: "stairs";
  steps: string[];
  at: number;
}

export interface SpectrumScene {
  family: "spectrum";
  left: string;
  right: string;
  min: number;
  max: number;
  marks: { label: string; at: number }[];
  at: number;
}

export interface VennScene {
  family: "venn";
  a: string;
  b: string;
  both: string;
  overlap: number;
}

export type PairShape = "line" | "curve" | "jagged" | "smooth" | "split" | "join" | "scatter" | "aligned" | "one" | "many" | "loop" | "path";

export interface PairSide {
  label: string;
  shape: PairShape;
  count: number;
  note: string;
}

/** The difference between X and Y: two small pictures side by side, one lit. */
export interface PairScene {
  family: "pair";
  left: PairSide;
  right: PairSide;
  lit: "left" | "right";
}

/** What branches from what: a root, branches and leaves, one path lit. */
export interface TreeScene {
  family: "tree";
  root: string;
  branches: { label: string; leaves: string[] }[];
  /** leaf -1 means the branch itself. */
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
  at: number;
  value: number;
}

/** How many out of 100. */
export interface UnitsScene {
  family: "units";
  lit: number;
  label: string;
  rest: string;
  /** A thing to count with instead of dots (person, coin), or "". Older servers leave it out. */
  thing?: string;
}

/** Which one stands out from many. */
export interface CrowdScene {
  family: "crowd";
  x: string;
  y: string;
  count: number;
  crowd: "rise" | "fall" | "flat";
  lit: string;
  litShape: "rise" | "fall" | "flat" | "peak" | "dip";
}

/** Where it falls on two scales at once. quadrants: top left, top right, bottom left, bottom right. */
export interface GridScene {
  family: "grid";
  x: string;
  y: string;
  quadrants: string[];
  item: string;
  atX: number;
  atY: number;
}

/** When, and in what order. */
export interface TimelineScene {
  family: "timeline";
  events: { label: string; when: string; t: number }[];
  scale: "even" | "true";
  at: number;
}

/** What is built on, or inside, what. Top or outermost first. */
export interface LayersScene {
  family: "layers";
  layers: string[];
  style: "stack" | "nested";
  at: number;
  whole: string;
}

/** What repeats as it travels. */
export interface WaveScene {
  family: "wave";
  kind: "transverse" | "longitudinal";
  what: string;
  wavelength: string;
  amplitude: string;
}

/** What is the partner of this. */
export interface MirrorScene {
  family: "mirror";
  leftTitle: string;
  rightTitle: string;
  pairs: { left: string; right: string }[];
  lit: number;
}

/** Last in, first out. Items bottom first. */
export interface StackScene {
  family: "stack";
  label: string;
  items: string[];
  action: "push" | "pop";
}

/** What sits round one centre. */
export interface RadialScene {
  family: "radial";
  centre: string;
  spokes: string[];
  lit: number;
  cycle: boolean;
}

/** A whole and its shares (percentages). */
export interface CutawayScene {
  family: "cutaway";
  whole: string;
  parts: { label: string; share: number }[];
  lit: number;
}

/** Drop off at each stage. */
export interface FunnelScene {
  family: "funnel";
  stages: { label: string; value: number }[];
  lit: number;
}

/** One flow split by amount (percentages). */
export interface SankeyScene {
  family: "sankey";
  source: string;
  splits: { label: string; share: number }[];
  lit: number;
}

/** A forecast that widens. */
export interface FanScene {
  family: "fan";
  x: string;
  y: string;
  shape: "rise" | "fall" | "flat";
  now: number;
  label: string;
}

/** A loop that climbs. */
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

/** Which belong together. */
export interface BraceScene {
  family: "brace";
  items: string[];
  groups: { label: string; from: number; to: number }[];
  lit: number;
}

/** A schematic map, north up. x 0 west to 1 east, y 0 south to 1 north. */
export interface MapScene {
  family: "map";
  places: { label: string; x: number; y: number }[];
  routes: { from: number; to: number }[];
  lit: number;
}

/** Drawn objects, people and places (names from things.ts). */
export interface ThingsScene {
  family: "things";
  layout: "row" | "versus" | "chain" | "orbit" | "scale" | "parts";
  items: { thing: string; label: string; size: number }[];
  /** parts layout: named parts of the one thing, each at a spot on it. Older servers leave it out. */
  parts?: { label: string; at: string }[];
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

/** The families this build of the app can draw. A newer server may send others: those fall back to the simple diagram. */
export const DRAWABLE: readonly string[] = [
  "particles", "links", "graph", "balance", "compare", "stairs", "spectrum", "venn", "pair", "tree", "test", "threshold", "units", "crowd",
  "grid", "timeline", "layers", "wave", "mirror", "stack", "radial", "cutaway", "funnel", "sankey", "fan", "spiral", "zoom", "brace", "map", "things",
];

/** True when this build can draw the scene: a known family, and every thing in it known. */
export function canDraw(scene: Scene | null | undefined): scene is Scene {
  if (!scene || !DRAWABLE.includes(scene.family)) return false;
  if (scene.family === "things") return scene.items.every((t) => !!THINGS[t.thing]);
  return true;
}

export type ChangeKind = "appear" | "cross" | "speed" | "grow" | "step" | "shift" | "stretch" | "ride" | "weigh" | "climb" | "slide" | "overlap" | "fill";
export interface Change {
  target: string;
  does: ChangeKind;
}

export interface Play {
  prompt: string;
  low: string;
  high: string;
  readouts: string[];
  changes: Change[];
}
