// The engine's limits, in code so the model cannot drift past them. Works out
// where the call is from the history alone, so the server stays stateless.
import type { PastTurn } from "../gemini";

export type Move =
  | "listen"
  | "next"
  | "why"
  | "what_if"
  | "puzzled"
  | "build_on_theirs"
  | "plain_words"
  | "simpler"
  | "offer_show_me"
  | "show_me"
  | "let_go"
  | "retell"
  | "close";

/** Moves that push the learner. At most one in any two turns. */
export const PROBES: Move[] = ["why", "what_if", "puzzled"];

const STUCK = /\b(i\s*(don'?t|do not)\s*know|not sure|no idea|i forget|i can'?t remember|dunno|pass|i'?m stuck|haven'?t got a clue)\b/i;
const YES = /^\s*(yes|yeah|yep|yup|sure|ok(ay)?|please|go on|go on then|alright|sounds good)\b/i;
const TELL_ME = /\b(just tell me|can you (just )?(tell|explain)|explain it to me|what('?s| is) the answer|show me)\b/i;
const NO = /^\s*(no|nah|nope|not now|no thanks|i'?m (fine|good)|let me try)\b/i;

export const OFFER_LINE = "Want a quick explanation, then you tell me in your own words?";
export const SHOW_ME_LINE = "Here you go. Have a read, then tell me in your own words.";
export const RETELL_LINE_HINT = "whole thing";

/** Guess which move an earlier Fenny line was, from its words. */
export function moveOf(line: string): Move {
  const s = line.toLowerCase();
  if (s.includes("quick explanation")) return "offer_show_me";
  if (s.includes("have a read")) return "show_me";
  if (s.includes(RETELL_LINE_HINT) && s.includes("seconds")) return "retell";
  if (/\bwhat if\b|what would happen|picture\b|imagine\b/.test(s)) return "what_if";
  if (/\bwait\b|i thought you said|but didn'?t you/.test(s)) return "puzzled";
  if (/\bwhy\b|how come/.test(s)) return "why";
  if (/kid|in plain|simpler words|that word/.test(s)) return "plain_words";
  if (/come back to that|park that|no worries/.test(s)) return "let_go";
  if (/30 seconds|whole thing again/.test(s)) return "retell";
  if (/shakiest/.test(s)) return "close";
  if (s.split(/\s+/).length <= 5) return "listen";
  return "next";
}

export interface CallState {
  learnerTurns: number;
  /** Listens among Fenny's last three lines. */
  recentListens: number;
  closed: boolean;
  stuckStreak: number;
  lastMove?: Move;
  probedLastTurn: boolean;
  retellAsked: boolean;
  justRetold: boolean;
  answeredOffer?: "yes" | "no";
  /** They asked to be told. */
  askedToBeTold: boolean;
}

export function callState(history: PastTurn[], transcript: string): CallState {
  const fenny = history.filter((t) => t.speaker === "student").map((t) => moveOf(t.text));
  const learner = [...history.filter((t) => t.speaker === "learner").map((t) => t.text), transcript];
  let stuckStreak = 0;
  for (let i = learner.length - 1; i >= 0 && STUCK.test(learner[i]) && learner[i].split(/\s+/).length < 25; i--) stuckStreak++;
  const lastMove = fenny.at(-1);
  const retellAsked = fenny.includes("retell");
  return {
    learnerTurns: learner.length,
    recentListens: fenny.slice(-3).filter((m) => m === "listen").length,
    closed: fenny.includes("close"),
    stuckStreak,
    lastMove,
    probedLastTurn: lastMove ? PROBES.includes(lastMove) : false,
    retellAsked,
    justRetold: lastMove === "retell",
    askedToBeTold: TELL_ME.test(transcript),
    answeredOffer: lastMove === "offer_show_me" ? (YES.test(transcript) ? "yes" : NO.test(transcript) ? "no" : undefined) : undefined,
  };
}

export interface Limits {
  /** Start asking for the 30 second retell from this learner turn. */
  retellFrom: number;
  /** Always ask for it by this turn. */
  retellBy: number;
  /** The phone can show a Show me card during the call. */
  canShowMe: boolean;
}

export const DEFAULT_LIMITS: Limits = { retellFrom: 7, retellBy: 12, canShowMe: false };

/**
 * The moves Fenny may make this turn. A single move means the code has decided;
 * several means the model picks the best fit.
 */
export function allowedMoves(s: CallState, l: Limits = DEFAULT_LIMITS): Move[] {
  if (s.answeredOffer === "yes" || (s.askedToBeTold && l.canShowMe)) return ["show_me"];
  if (s.askedToBeTold) return ["let_go"];
  if (s.answeredOffer === "no") return ["let_go"];
  if (s.justRetold) return ["close"];
  const done = s.retellAsked || s.closed;
  if (s.stuckStreak >= 2) return [l.canShowMe ? "offer_show_me" : "let_go"];
  if (s.stuckStreak === 1) return ["simpler"];
  if (!done && s.learnerTurns >= l.retellBy) return ["retell"];
  let moves: Move[] = ["next", "build_on_theirs", "plain_words"];
  if (s.recentListens === 0) moves.push("listen");
  if (!s.probedLastTurn && s.learnerTurns > 1) moves.push(...PROBES);
  if (!done && s.learnerTurns >= l.retellFrom) moves.push("retell");
  // Never the same move twice running, except listening.
  if (s.lastMove && s.lastMove !== "listen") moves = moves.filter((m) => m !== s.lastMove);
  return moves;
}

const VAGUE = /\b(what do you mean|what did you mean|which bit|what part|which part|can you clarify|could you clarify|say more|tell me more about that|elaborate|expand on)\b/i;

/** Is this line one of the vague, naggy questions Fenny must never ask? */
export function isVague(line: string): boolean {
  return VAGUE.test(line);
}
