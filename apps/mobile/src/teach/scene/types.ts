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

export type Scene = ParticlesScene | LinksScene | GraphScene | BalanceScene | CompareScene | StairsScene | SpectrumScene | VennScene;

export type ChangeKind = "appear" | "cross" | "speed" | "grow" | "step" | "shift" | "stretch" | "ride" | "weigh" | "climb" | "slide" | "overlap";
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
