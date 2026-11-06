// The drawn scenes a lesson can send, mirrored from apps/api/src/scene.ts.
// The server has already checked them, so the app can trust the shapes here.

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
  | CrowdScene;

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
