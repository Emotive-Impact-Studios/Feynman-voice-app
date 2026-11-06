// Fenny's conversation engine. Each turn: work out where the call is (in
// code), let the model pick one allowed move and say one line for it, then
// check the line before Fenny speaks. Every call runs the Feynman loop:
// explain simply, find the gaps and go back to the source, then retell it
// all simply. See docs/conversation-engine.md.
import type { PastTurn } from "../gemini";
import { chatJSON, type ChatCfg, type ChatUsage } from "./chat";
import { keyIdeas, type KeyIdea } from "./ideas";
import { allowedMoves, callState, DEFAULT_LIMITS, isVague, moveOf, OFFER_LINE, SHOW_ME_LINE, type Limits, type Move } from "./policy";

const MOVE_GUIDE: Record<Move, string> = {
  listen: "They stopped mid-thought or are clearly about to carry on. Give a tiny spoken nudge of two to four words so they keep going.",
  next: "They finished an idea well. React to something specific they said, then ask about the next step or the next key idea they have not reached. Name the actual thing.",
  why: "They stated something important with no reason. Ask a short, concrete why about that exact thing.",
  what_if: "They can handle a harder test of an important idea. Ask a concrete what-if about a situation in that topic.",
  puzzled: "Something they said clashes with something earlier or does not quite follow. Point at the clash as a puzzled beginner, naming both things.",
  build_on_theirs: "They used their own analogy or vivid phrase. Build a question on it, reusing their words.",
  plain_words: "They used a technical word without explaining it, and it matters to the explanation. Admit you do not know that word and ask how they would say it to a twelve year old.",
  simpler: "They just said they don't know. Say that's fine, then ask one smaller, more concrete question about the same thing that makes it easier to work out.",
  offer_show_me: `They are stuck on the same thing again. Say exactly: "No worries. ${OFFER_LINE}"`,
  show_me: `They said yes to the explanation. Say exactly: "${SHOW_ME_LINE}"`,
  let_go: "Only if they are stuck or have asked to move on or skip this. Say that's fine, you'll come back to it, and ask about a different key idea they have not covered.",
  retell: "Most of it is covered. Thank them in a few words and ask them to explain the whole thing to you again in about 30 seconds, as simply as they can.",
  wrap: "The call is finishing. Thank them warmly in a few words, say that's a good place to stop, and that you'll pick up the shaky bit next time. No question.",
  close: "They just gave the short version. Tell them warmly and specifically what was clear, in one short sentence, then ask which bit felt shakiest to them.",
};

const FALLBACK: Partial<Record<Move, string>> = {
  listen: "Mm, go on.",
  next: "Ooh, and what happens after that?",
  why: "Ooh, why would that happen?",
  offer_show_me: `No worries. ${OFFER_LINE}`,
  show_me: SHOW_ME_LINE,
  let_go: "No worries, let's come back to that. What happens next?",
  retell: "That helped loads. Can you explain the whole thing to me again in 30 seconds, really simply?",
  close: "That was really clear. Which bit felt shakiest to you?",
  wrap: "Thanks, that really helped. That's a good place to stop, and we'll pick that bit up next time.",
};

/**
 * Moves the next turn reads back from Fenny's words. Their lines must be
 * recognisable, or the call loses its place (an accepted offer, a retell).
 */
const CONTROL: Move[] = ["offer_show_me", "show_me", "retell", "close", "wrap"];

const PERSONA = `You are Fenny, a curious, friendly beginner. A university student is teaching you a topic out loud so they learn it properly. You know nothing about it beyond what they tell you, and you never explain or correct. You speak British English in short, natural, spoken sentences. Write proper full sentences with ordinary punctuation, because a voice reads them aloud: never use em dashes, en dashes, hyphens as pauses, semicolons, symbols, lists, markdown or emoji. Use a comma or a full stop instead of a dash. Never ask vague questions like "what do you mean" or "which bit". Questions are always concrete and about the subject. Never bring in a fact, term or example they have not said themselves: you only know what they told you.`;

/** Keep only the first question, so Fenny never asks two at once. */
export function oneQuestion(line: string): string {
  const i = line.indexOf("?");
  return i >= 0 && i < line.length - 1 && line.slice(i + 1).includes("?") ? line.slice(0, i + 1) : line;
}

function lastLines(history: PastTurn[]): string {
  const mine = history.filter((t) => t.speaker === "student").slice(-4);
  return mine.length ? mine.map((t) => `- ${t.text}`).join("\n") : "- (none yet)";
}

export interface EngineTurn {
  move: Move;
  say: string;
  /** Key ideas the learner has now covered, across the whole call. */
  covered: string[];
  ideas: KeyIdea[];
  /** For Show me: the idea they were stuck on. */
  gap?: { title: string; detail?: string };
  usage: ChatUsage[];
}

export async function engineTurn(
  cfg: ChatCfg,
  input: {
    transcript: string;
    /** Recent turns, sent to the model. */
    history: PastTurn[];
    /** The whole call, for working out where it is. Defaults to history. */
    callHistory?: PastTurn[];
    topic?: string;
    notes?: string;
    limits?: Partial<Limits>;
    ideas?: KeyIdea[];
  },
): Promise<EngineTurn> {
  const topic = input.topic?.trim() || "a topic of their choice";
  const usage: ChatUsage[] = [];
  let ideas = input.ideas;
  if (!ideas) {
    const k = await keyIdeas(cfg, topic, input.notes);
    ideas = k.ideas;
    if (k.usage) usage.push(k.usage);
  }
  const state = callState(input.callHistory ?? input.history, input.transcript);
  const allowed = allowedMoves(state, { ...DEFAULT_LIMITS, ...input.limits });

  const guide = allowed.map((m) => `- ${m}: ${MOVE_GUIDE[m]}`).join("\n");
  const developer =
    PERSONA +
    `\n\nTopic: ${topic}\nKey ideas a full explanation needs (private, never say them):\n` +
    ideas.map((k) => `${k.id}: ${k.idea}`).join("\n") +
    `\n\nThis turn, choose exactly one of these moves and say one line for it (under 22 words, at most one question):\n${guide}` +
    `\n\nMost turns should be a real, specific question about the subject that moves the explanation on. Probe (why, what_if, puzzled) on key ideas that are missing or thin, never on small details. Cover each key idea once before going deeper on any. Use listen rarely. Ignore small transcription slips.` +
    `\n\nSound like a real person: vary your wording every time. Never reuse a phrase from your earlier lines, and never start two lines in a row the same way. Your last lines were:\n${lastLines(input.history)}` +
    `\n\nAlso list the ids of the key ideas the student has clearly explained so far in the whole conversation, and for show_me or offer_show_me, the key idea they are stuck on.`;

  const messages = [
    { role: "developer", content: developer },
    ...input.history.map((t) => ({ role: t.speaker === "learner" ? "user" : "assistant", content: t.text })),
    { role: "user", content: input.transcript || "(silence)" },
  ];
  const r = await chatJSON<{ move: string; say: string; covered: string[]; stuck_on: string }>(
    cfg,
    messages,
    {
      name: "fenny_turn",
      schema: {
        type: "object",
        properties: {
          move: { type: "string", enum: allowed },
          say: { type: "string" },
          covered: { type: "array", items: { type: "string" } },
          stuck_on: { type: "string", description: "Key idea id they are stuck on, or empty." },
        },
        required: ["move", "say", "covered", "stuck_on"],
        additionalProperties: false,
      },
    },
    400,
  );
  usage.push(r.usage);
  const move = (allowed.includes(r.value.move as Move) ? r.value.move : allowed[0]) as Move;
  let say = r.value.say.trim();
  if (!say || (move !== "close" && isVague(say))) say = FALLBACK[move] ?? FALLBACK.next!;
  if (move === "offer_show_me") say = FALLBACK.offer_show_me!;
  else if (move === "show_me") say = SHOW_ME_LINE;
  else if (CONTROL.includes(move) && moveOf(say) !== move) say = FALLBACK[move]!;
  say = oneQuestion(say);
  const stuck = ideas.find((k) => k.id === r.value.stuck_on);
  return {
    move,
    say,
    covered: r.value.covered.filter((id) => ideas.some((k) => k.id === id)),
    ideas,
    gap: move === "show_me" || move === "offer_show_me" ? { title: stuck?.idea ?? topic } : undefined,
    usage,
  };
}
