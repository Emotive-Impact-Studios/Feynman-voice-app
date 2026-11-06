// Fenny's reactions: short one-off moves layered on top of the mood, the way
// a character app's state machine fires a "celebrate" or "confused" clip
// over the idle pose. Here they are plain data, played by FennyOrb with
// Reanimated, so no animation editor or extra runtime is needed.
//
// Each reaction is a set of tracks. A track is a list of [ms, value] keys
// for one channel; it starts from the channel's neutral value at 0 ms and,
// after its last key, springs back to neutral (a soft wobble on the way, so
// it settles like something with a little weight to it).
//
// Channels, in the orb shader's units (1 = half the orb's square):
//   sx, sy  body and face scale, for squash and stretch (neutral 1)
//   hop     vertical offset, negative is up (neutral 0)
//   pop     eye size (neutral 1)
//   tilt    extra lean in radians (neutral 0)
//   happy   extra smile, 0..1 (neutral 0)
//   lx, ly  extra look offset (neutral 0)
//   squint  0..1 closes the eyes a little (neutral 0)
//   wake    0..1 brings the eyes up even on a resting orb (neutral 0)

export type Channel = "sx" | "sy" | "hop" | "pop" | "tilt" | "happy" | "lx" | "ly" | "squint" | "wake";
export type Track = [ms: number, value: number][];
export type Reaction = Partial<Record<Channel, Track>>;

export const NEUTRAL: Record<Channel, number> = {
  sx: 1,
  sy: 1,
  hop: 0,
  pop: 1,
  tilt: 0,
  happy: 0,
  lx: 0,
  ly: 0,
  squint: 0,
  wake: 0,
};

export type ReactionName = "hello" | "aha" | "yay" | "hmm" | "oops" | "boop";

export const REACTIONS: Record<ReactionName, Reaction> = {
  // A call starts: dip, rise with a smile, land softly.
  hello: {
    sx: [[140, 1.07], [360, 0.95], [520, 1.04]],
    sy: [[140, 0.93], [360, 1.07], [520, 0.97]],
    hop: [[140, 0.01], [360, -0.06], [560, 0]],
    happy: [[200, 1], [1100, 1]],
    wake: [[120, 1], [1300, 1]],
  },
  // They said something worth asking about: eyes widen, a small lift.
  aha: {
    pop: [[120, 1.18], [420, 1.1]],
    sy: [[120, 1.04]],
    sx: [[120, 0.97]],
    hop: [[140, -0.025]],
    ly: [[140, -0.02], [420, -0.02]],
    wake: [[80, 1], [600, 1]],
  },
  // Got it: two little hops and a big smile.
  yay: {
    sx: [[110, 1.08], [280, 0.94], [420, 1.06], [580, 0.96], [700, 1.03]],
    sy: [[110, 0.92], [280, 1.08], [420, 0.94], [580, 1.06], [700, 0.98]],
    hop: [[110, 0.01], [280, -0.07], [420, 0], [580, -0.045], [720, 0]],
    happy: [[140, 1], [1300, 1]],
    pop: [[140, 1.1], [900, 1.08]],
    wake: [[100, 1], [1500, 1]],
  },
  // Lost: sinks a little, leans, squints, then a slow lean the other way.
  hmm: {
    sx: [[260, 1.05], [900, 1.04]],
    sy: [[260, 0.94], [900, 0.95]],
    hop: [[260, 0.02], [900, 0.02]],
    tilt: [[300, 0.2], [700, 0.2], [1000, -0.08]],
    squint: [[260, 0.35], [900, 0.3]],
    lx: [[300, -0.03], [700, -0.03], [1000, 0.02]],
    wake: [[120, 1], [1100, 1]],
  },
  // Not quite: a gentle shake of the head, kind rather than sad.
  oops: {
    lx: [[90, 0.045], [220, -0.045], [350, 0.03], [470, -0.015]],
    tilt: [[90, -0.07], [220, 0.07], [350, -0.04], [470, 0.02]],
    sy: [[120, 0.97]],
    squint: [[120, 0.2], [500, 0.15]],
    wake: [[80, 1], [800, 1]],
  },
  // Tapped: a quick squish, a bounce back and a happy blink.
  boop: {
    sx: [[70, 1.13], [200, 0.93], [320, 1.04]],
    sy: [[70, 0.86], [200, 1.08], [320, 0.97]],
    hop: [[70, 0.015], [200, -0.03], [330, 0]],
    happy: [[60, 1], [700, 1]],
    wake: [[50, 1], [900, 1]],
  },
};

/** The longest key in a reaction, in ms (before the settle spring). */
export function reactionLength(r: Reaction): number {
  let end = 0;
  for (const track of Object.values(r)) if (track && track.length) end = Math.max(end, track[track.length - 1][0]);
  return end;
}

/** A reaction to play, and a counter so the same one can play twice in a row. */
export interface Cue {
  name: ReactionName;
  n: number;
}

/** The engine's moves that get a reaction when Fenny starts saying them. */
const LOST_MOVES = new Set(["puzzled", "plain_words"]);
const GOT_MOVES = new Set(["retell", "close", "wrap"]);

/**
 * What Fenny does when the call changes, or null. Pure, so the session can
 * call it from an effect with the previous and current state.
 *   the call starts            -> hello
 *   the learner finishes a turn -> aha
 *   Fenny says it's lost       -> hmm
 *   Fenny says "got it"        -> yay
 */
export function reactionFor(
  prev: { phase: string; move: string | null | undefined },
  next: { phase: string; move: string | null | undefined },
): ReactionName | null {
  const started = (prev.phase === "ready" || prev.phase === "loading") && (next.phase === "speaking" || next.phase === "listening");
  if (started) return "hello";
  if (prev.phase === "listening" && next.phase === "thinking") return "aha";
  const nowSpeaking = next.phase === "speaking" && (prev.phase !== "speaking" || prev.move !== next.move);
  if (nowSpeaking && next.move) {
    if (LOST_MOVES.has(next.move)) return "hmm";
    if (GOT_MOVES.has(next.move)) return "yay";
  }
  return null;
}
