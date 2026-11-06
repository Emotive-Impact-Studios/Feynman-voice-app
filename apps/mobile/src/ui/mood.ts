// Fenny's moods, for the eyes in the orb (see FennyOrb). Values are in the
// orb shader's units: positions where 1 is half the orb's square.
export type FennyMood = "rest" | "listen" | "think" | "curious" | "lost" | "got";

export interface MoodShape {
  /** 0 = no eyes, just the orb; 1 = eyes showing. */
  eyes: number;
  /** Where the eyes look. Negative y is up. */
  look: [number, number];
  eyeL: number;
  eyeR: number;
  /** 1 = open; lower flattens the eyes. */
  open: number;
  /** Radians. Inner ends lift when lost. */
  slant: number;
  /** 0..1: the eyes turn into smiling arcs. */
  happy: number;
  /** Radians. The face leans. */
  tilt: number;
  /** How bright the core stays behind the eyes (1 = as at rest). */
  core: number;
  /** 0..1: greyer and dimmer. */
  dull: number;
}

const BASE: MoodShape = { eyes: 1, look: [0, 0], eyeL: 1, eyeR: 1, open: 1, slant: 0, happy: 0, tilt: 0, core: 0.26, dull: 0 };

export const MOODS: Record<FennyMood, MoodShape> = {
  rest: { ...BASE, eyes: 0, core: 1 },
  listen: { ...BASE, look: [0.025, 0.02] },
  think: { ...BASE, look: [-0.08, -0.09], open: 0.7 },
  curious: { ...BASE, look: [0.02, -0.02], eyeL: 0.88, eyeR: 1.22, tilt: -0.16 },
  lost: { ...BASE, look: [0, 0.04], open: 0.33, slant: 0.28, core: 0.18, dull: 1 },
  got: { ...BASE, happy: 1, core: 0.5 },
};

/** The engine's moves, grouped by the face Fenny makes while saying them. */
const LOST_MOVES = new Set(["puzzled", "plain_words"]);
const GOT_MOVES = new Set(["retell", "close", "wrap"]);

/**
 * Fenny's mood in a call, from the call's phase and the engine's last move.
 * Listening: eyes on you. Thinking: looking up while it works it out.
 * Speaking: the face for what it is saying (lost, got it, or curious).
 */
export function moodFor(phase: string, move: string | null | undefined): FennyMood {
  if (phase === "loading") return "rest";
  if (phase === "error") return "lost";
  if (phase === "thinking") return "think";
  if (phase === "speaking") {
    if (move && LOST_MOVES.has(move)) return "lost";
    if (move && GOT_MOVES.has(move)) return "got";
    if (move === "listen") return "listen";
    return "curious";
  }
  // ready and listening: Fenny is with you, eyes on you.
  return "listen";
}
