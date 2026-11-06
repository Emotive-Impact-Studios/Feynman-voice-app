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
  | "offer_teach"
  | "teach"
  | "let_go"
  | "retell"
  | "close"
  | "wrap";

/** Moves that push the learner. At most one in any two turns. */
export const PROBES: Move[] = ["why", "what_if", "puzzled"];

const STUCK = /\b(i\s*(don'?t|do not)\s*(really\s*)?know|not (really )?sure|no idea|no clue|not a clue|i forget|i can'?t remember|dunno|i'?m (stuck|lost|confused)|haven'?t got a clue|(don'?t|do not) (really )?(understand|get it)|never (learned|learnt|heard of|studied|done) (this|it|that)|haven'?t (learned|learnt|studied|done|covered) (this|it|that))\b/i;
/** "Can we skip that?": move on, not a sign they're stuck. Not when negated ("don't skip this"). */
const SKIP = /^(?!.*\b(don'?t|do not|not|never)\s+(skip|pass|move on)\b)\s*(\w+[,.]?\s+){0,3}?(i'?ll (pass|skip)|pass on (that|this)|(can|could) we (skip|move on)|(i'?d|i would|i want to|i wanna)( like to)? (skip|pass|move on)(?=\s*(on )?((this|that)( one| question| bit)?)?[\s,]*(please)?\s*[.!?]*$)|let'?s (skip|move on)|(just )?skip (that|this)( one)?( please)?\s*[.!?]*$|next question|(pass|skip)\s*[.!,]*$)/i;
const YES = /^\s*(yes|yeah|yep|yup|sure|ok(ay)?|please|go on|go on then|alright|sounds good)\b/i;
const TELL_ME = /\b(just tell me|can you (just )?(tell|explain)|explain it to me|what('?s| is) the answer|show me)\b/i;
/** "Hang on, let me think": not the retell itself. */
const HESITATE = /\b(hang on|hold on|(need|want|have) (a (bit|little) )?(more )?time|a (bit|little) more time|give me a (sec|second|moment|minute)|one (sec|second|moment)|let me think|thinking about it|bear with me|wait a (sec|second|moment))\b/i;
const NO = /^\s*(no|nah|nope|not now|no thanks|i'?m (fine|good)|let me try)\b/i;

export const OFFER_LINE = "Want a quick explanation, then you tell me in your own words?";
export const SHOW_ME_LINE = "Here you go. Have a read, then tell me in your own words.";
export const RETELL_LINE_HINT = "whole thing";
export const OFFER_TEACH_LINE = "No worries, this sounds new to you. Tap Teach me to learn it first, then come back and tell me.";
export const TEACH_LINE = "Great. Have a go at learning it, then come back and tell me in your own words.";
export const LEARN_FIRST_LINE = "No worries, this sounds new to you. Have a read of your notes first, then come back and teach me.";

/** Guess which move an earlier Fenny line was, from its words. */
export function moveOf(line: string): Move {
  const s = line.toLowerCase();
  if (s.includes("quick explanation")) return "offer_show_me";
  if (s.includes("have a read of your notes") || s.includes("come back and teach me")) return "wrap";
  if (s.includes("have a read")) return "show_me";
  if (s.includes("tap teach me")) return "offer_teach";
  if (s.includes("have a go at learning")) return "teach";
  if (s.includes(RETELL_LINE_HINT) && s.includes("seconds")) return "retell";
  if (/\bwhat if\b|what would happen|picture\b|imagine\b/.test(s)) return "what_if";
  if (/\bwait\b|i thought you said|but didn'?t you/.test(s)) return "puzzled";
  if (/\bwhy\b|how come/.test(s)) return "why";
  if (/kid|in plain|simpler words|that word/.test(s)) return "plain_words";
  if (/come back to that|park that|no worries/.test(s)) return "let_go";
  if (/30 seconds|whole thing again/.test(s)) return "retell";
  if (/shakiest/.test(s)) return "close";
  if (/next time|good place to stop/.test(s)) return "wrap";
  if (s.split(/\s+/).length <= 5) return "listen";
  return "next";
}

export interface CallState {
  learnerTurns: number;
  /** Listens among Fenny's last three lines. */
  recentListens: number;
  closed: boolean;
  stuckStreak: number;
  /** They clearly don't know this: they said so, or gave two empty answers in a row. */
  stuckNow: boolean;
  /** Times Fenny has already let a stuck bit go this call. */
  letGos: number;
  lastMove?: Move;
  probedLastTurn: boolean;
  retellAsked: boolean;
  /** The retell was asked for and Fenny has only listened since. */
  retellPending: boolean;
  /** Fenny lines since the retell request (all listens). */
  sinceRetell: number;
  /** Words in what they just said. */
  words: number;
  /** They are pausing to think, not answering yet. */
  hesitating: boolean;
  answeredOffer?: "yes" | "no";
  /** They asked to be told. */
  askedToBeTold: boolean;
  /** They asked to skip this one. */
  skipRequested: boolean;
}

export function callState(history: PastTurn[], transcript: string): CallState {
  const fenny = history.filter((t) => t.speaker === "student").map((t) => moveOf(t.text));
  const learner = [...history.filter((t) => t.speaker === "learner").map((t) => t.text), transcript];
  let stuckStreak = 0;
  for (let i = learner.length - 1; i >= 0 && STUCK.test(learner[i]) && learner[i].split(/\s+/).length < 25; i--) stuckStreak++;
  const lastMove = fenny.at(-1);
  const twoWeak = learner.length >= 2 && learner.slice(-2).every((t) => weak(t));
  const retellAsked = fenny.includes("retell");
  const lastRetell = fenny.lastIndexOf("retell");
  const after = lastRetell >= 0 ? fenny.slice(lastRetell + 1) : [];
  const retellPending = lastRetell >= 0 && after.every((m) => m === "listen");
  return {
    learnerTurns: learner.length,
    recentListens: fenny.slice(-3).filter((m) => m === "listen").length,
    closed: fenny.includes("close"),
    stuckStreak,
    stuckNow: (stuckStreak >= 1 || twoWeak) && !isHesitation(transcript),
    letGos: fenny.filter((m) => m === "let_go").length,
    lastMove,
    probedLastTurn: lastMove ? PROBES.includes(lastMove) : false,
    retellAsked,
    retellPending,
    sinceRetell: after.length,
    words: transcript.trim() ? transcript.trim().split(/\s+/).length : 0,
    hesitating: isHesitation(transcript),
    askedToBeTold: TELL_ME.test(transcript),
    skipRequested: SKIP.test(transcript),
    answeredOffer: lastMove === "offer_show_me" || lastMove === "offer_teach" ? (YES.test(transcript) ? "yes" : NO.test(transcript) ? "no" : undefined) : undefined,
  };
}

const FILLER = /\b(um+|uh+|erm+|er|ah+|oh+|ooh+|okay|ok|right|so|yeah|well|just|about|it|that|the|to|a|me|i|i'?m|need|more|time|think|thinking|little|bit|sec|second|moment|minute|still|let|go|can|could|please|sorry)\b/gi;

/** An empty answer: nothing but filler ("um", "erm, well..."). A short real answer ("Veins.") is not weak. */
function weak(t: string): boolean {
  if (YES.test(t) || NO.test(t)) return false;
  return t.replace(FILLER, " ").replace(/\b(hmm+|mm+)\b/gi, " ").replace(/[^\p{L}\p{N}\s']/gu, " ").trim().split(/\s+/).filter(Boolean).length === 0;
}

/** Only a pause to think ("hang on, give me a moment"), with no real answer in it. */
function isHesitation(t: string): boolean {
  // The pause has to open the reply ("Hang on...", "Um, I need more time"),
  // so "You need more time to heat the water" stays an answer.
  const opening = new RegExp(`^[\\s,.!]*((um+|uh+|erm+|er|ah+|hmm+|oh+|ooh+|okay|ok|right|so|well|sorry|yeah|i|i'?m|i'?ll)[\\s,.!]+)*(${HESITATE.source.slice(2, -2)})`, "i");
  if (!opening.test(t)) return false;
  const rest = t.replace(new RegExp(HESITATE.source, "gi"), " ").replace(FILLER, " ").replace(/[^\p{L}\p{N}\s']/gu, " ");
  return rest.trim().split(/\s+/).filter(Boolean).length < 4;
}

export interface Limits {
  /** Start asking for the 30 second retell from this learner turn. */
  retellFrom: number;
  /** Always ask for it by this turn. */
  retellBy: number;
  /** The phone can show a Show me card during the call. */
  canShowMe: boolean;
  /** The phone has a Teach me mode (lessons and puzzles) it can open. */
  canTeach: boolean;
}

export const DEFAULT_LIMITS: Limits = { retellFrom: 7, retellBy: 12, canShowMe: false, canTeach: false };

/**
 * The moves Fenny may make this turn. A single move means the code has decided;
 * several means the model picks the best fit.
 */
export function allowedMoves(s: CallState, l: Limits = DEFAULT_LIMITS): Move[] {
  if (s.lastMove === "offer_teach" && s.answeredOffer === "yes") return ["teach"];
  if (s.askedToBeTold && l.canTeach) return ["offer_teach"];
  if (s.answeredOffer === "yes" || (s.askedToBeTold && l.canShowMe)) return ["show_me"];
  if (s.askedToBeTold) return ["let_go"];
  if (s.lastMove === "close") return ["wrap"]; // even "can we skip that?" ends the call
  if (s.answeredOffer === "no" || s.skipRequested) return ["let_go"];
  // Close only once they have actually given the short version; a short
  // reply ("give me a sec") gets a nudge, at most twice.
  // After the shakiest-bit question, thank them and stop (the phone can end the
  // call on wrap). A short reply after that ("bye!") gets a goodbye; if they
  // really carry on explaining, follow them.
  if (s.closed && s.lastMove === "wrap" && s.words < 12) return ["wrap"];
  if (s.retellPending && !s.closed) return (s.words >= 8 && !s.hesitating) || s.sinceRetell >= 2 ? ["close"] : ["listen"];
  const done = s.retellAsked || s.closed;
  // They clearly don't know it: stop asking straight away. Offer to teach
  // when the phone can; otherwise move on once, and the second time stop the
  // call so they can learn it first. Never ask the same thing a new way.
  if (s.stuckNow) {
    if (l.canTeach && s.lastMove !== "offer_teach") return ["offer_teach"];
    if (l.canShowMe && s.lastMove !== "offer_show_me") return ["offer_show_me"];
    return [s.letGos >= 1 ? "wrap" : "let_go"];
  }
  if (!done && s.learnerTurns >= l.retellBy) return ["retell"];
  // let_go is always there for a request to move on that the checks above
  // didn't spot; the model only picks it when they ask.
  let moves: Move[] = ["next", "build_on_theirs", "plain_words", "let_go"];
  // Same for a "don't know" the checks missed: the model can offer to teach.
  if (l.canTeach) moves.push("offer_teach");
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

// Words a finished thought never ends on. Speech to text often adds a full
// stop where the learner only paused, so these count whatever follows them.
const TRAILING = /\b(and|but|because|cos|cuz|or|um+|uh+|erm+|er|the|an?|of|to|with|which|whereas|whereby|if|when|than)\W*$/i;
// These finish thoughts too ("I think so.", "I'd like."), so they only count
// with no closing punctuation.
const TRAILING_OPEN = /\b(so|like|then|that|is|are|was|were)\s*$/i;

/**
 * True when the learner clearly stopped mid-thought, so Fenny should keep
 * listening instead of answering. Only clear cases: a trailing connective or
 * filler, or a line that ends on a comma, dash or ellipsis.
 */
export function unfinished(transcript: string): boolean {
  const t = transcript.trim();
  if (!t) return false;
  if (/(,|\.\.\.|…|-|–|—)\s*$/.test(t)) return true;
  return TRAILING.test(t) || TRAILING_OPEN.test(t);
}
