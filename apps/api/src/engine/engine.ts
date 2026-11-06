// Fenny's conversation engine. Each turn: work out where the call is (in
// code), let the model pick one allowed move and say one line for it, then
// check the line before Fenny speaks. Every call runs the Feynman loop:
// explain simply, find the gaps and go back to the source, then retell it
// all simply. See docs/conversation-engine.md.
import type { PastTurn } from "../gemini";
import { chatJSON, type ChatCfg, type ChatUsage } from "./chat";
import { keyIdeas, type KeyIdea } from "./ideas";
import { allowedMoves, callState, DEFAULT_LIMITS, isVague, LEARN_FIRST_LINE, moveOf, OFFER_LINE, OFFER_TEACH_LINE, SHOW_ME_LINE, TEACH_LINE, type Limits, type Move } from "./policy";

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
  offer_teach: `Only if they clearly don't know this yet (they say so, guess wildly or have nothing to say). Say exactly: "${OFFER_TEACH_LINE}"`,
  teach: `They want to learn it first. Say exactly: "${TEACH_LINE}"`,
  let_go: "Only if they are stuck or have asked to move on or skip this. Say that's fine, you'll come back to it, and ask about a different key idea they have not covered. Never ask about the bit they were stuck on again, in any wording.",
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
  offer_teach: OFFER_TEACH_LINE,
  teach: TEACH_LINE,
  let_go: "No worries, let's come back to that. What happens next?",
  retell: "That helped loads. Can you explain the whole thing to me again in 30 seconds, really simply?",
  close: "That was really clear. Which bit felt shakiest to you?",
  wrap: "Thanks, that really helped. That's a good place to stop, and we'll pick that bit up next time.",
};

/**
 * Moves the next turn reads back from Fenny's words. Their lines must be
 * recognisable, or the call loses its place (an accepted offer, a retell).
 */
const CONTROL: Move[] = ["offer_show_me", "show_me", "offer_teach", "teach", "retell", "close", "wrap"];

const PERSONA = `You are Fenny, a curious, friendly beginner. A university student is teaching you a topic out loud so they learn it properly. You know nothing about it beyond what they tell you, and you never explain or correct. You speak British English in short, natural, spoken sentences. Write proper full sentences with ordinary punctuation, because a voice reads them aloud: never use em dashes, en dashes, hyphens as pauses, semicolons, symbols, lists, markdown or emoji. Use a comma or a full stop instead of a dash. Never ask vague questions like "what do you mean" or "which bit". Questions are always concrete and about the subject. Never bring in a fact, term or example they have not said themselves: you only know what they told you.`;

/** Keep only the first question, so Fenny never asks two at once. */
export type Verdict = "right" | "partly" | "off" | "none";

/** "a", "a and b", "a, b and c". */
export function listOf(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const NUMBER = ["no", "one", "two", "three", "four", "five"];
const count = (n: number) => NUMBER[n] ?? String(n);

/** Said once, on their first turn: what Fenny hopes to understand, so the call has a clear goal and end. */
export function goalLine(ideas: KeyIdea[]): string {
  const labels = ideas.map((k) => k.label.replace(/[.?!]+$/, ""));
  return `Ooh, OK. By the end I want to understand ${count(labels.length)} things: ${listOf(labels)}.`;
}

/** Fresh openers for each verdict, used when the model repeats one of its recent openers. */
const REACTIONS: Record<Exclude<Verdict, "none">, string[]> = {
  right: ["Oh, that makes sense.", "Ah, I get it now.", "Right, that clicks.", "Okay, that adds up.", "Oh nice, I follow that.", "Got it, that's clear."],
  partly: ["I follow some of that.", "I think I get part of it.", "Hmm, I'm halfway there.", "Some of that makes sense to me."],
  off: ["Hmm, that doesn't sound quite right to me.", "Wait, I'm not sure that adds up.", "Hmm, that doesn't fit for me.", "I'm not sure that's right."],
};

const firstSentence = (line: string) => line.match(/^[^.!?]*[.!?]/)?.[0] ?? "";
const NUMBER_WORD = /\bthat'?s (\w+) of the (\w+) things\b/i;

/**
 * The reaction opens the line and tells them how the answer landed. Keep it
 * from sounding canned: if it repeats an opener from Fenny's last few lines,
 * swap in a fresh one for the same verdict.
 */
export function freshReaction(say: string, verdict: Verdict, recent: string[], turn: number): string {
  if (verdict === "none") return say;
  const opener = firstSentence(say).trim();
  if (!opener) return say;
  const used = recent.map((l) => firstSentence(l).trim().toLowerCase());
  if (!used.includes(opener.toLowerCase())) return say;
  const bank = REACTIONS[verdict];
  const pick = [...bank.slice(turn % bank.length), ...bank.slice(0, turn % bank.length)].find((r) => !used.includes(r.toLowerCase()));
  return pick ? `${pick}${say.slice(opener.length)}` : say.slice(opener.length).trim();
}

/** How many ideas Fenny last said were done, read back from its own lines. */
export function lastProgress(history: PastTurn[]): number {
  for (const t of [...history].reverse()) {
    if (t.speaker !== "student") continue;
    const m = t.text.match(NUMBER_WORD);
    if (m) {
      const n = NUMBER.indexOf(m[1].toLowerCase());
      return n >= 0 ? n : Number(m[1]) || 0;
    }
  }
  return 0;
}

/** "That's two of the four things." goes after the reaction when they've just finished another idea. */
export function withProgress(say: string, done: number, total: number): string {
  const note = `That's ${count(done)} of the ${count(total)} things.`;
  const opener = firstSentence(say);
  return opener && opener.length < say.length ? `${opener} ${note}${say.slice(opener.length)}` : `${note} ${say}`;
}

/** Everything is covered: ask for the short retell, and say why now. */
export function allCoveredLine(n: number): string {
  return `That's all ${count(n)} things I wanted to understand. Can you explain the whole thing to me again in 30 seconds, really simply?`;
}

/** The goodbye after the shakiest-bit question: what went well and what comes back next time. */
export function summaryLine(ideas: KeyIdea[], covered: string[]): string {
  const got = ideas.filter((k) => covered.includes(k.id)).map((k) => k.label);
  const shaky = ideas.find((k) => !covered.includes(k.id));
  const well = got.length ? ` You explained ${listOf(got.slice(0, 3))} really well.` : "";
  const next = shaky
    ? ` ${shaky.label[0].toUpperCase()}${shaky.label.slice(1)} was the shaky bit, so we'll pick it up next time.`
    : " You covered everything, so next time we'll start with the bit you found shakiest.";
  return `Thanks, that really helped.${well}${next}`;
}

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
  /** How what they just said held up against the key ideas, for a right or wrong signal. */
  verdict: Verdict;
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
    `\n\nTopic: ${topic}\nKey ideas a full explanation needs (private, never say the ideas themselves; the labels in brackets are what the student knows you want to understand):\n` +
    ideas.map((k) => `${k.id}: ${k.idea} [${k.label}]`).join("\n") +
    `\n\nThis turn, choose exactly one of these moves and say one line for it (under 22 words, at most one question):\n${guide}` +
    `\n\nMost turns should be a real, specific question about the subject that moves the explanation on. Probe (why, what_if, puzzled) on key ideas that are missing or thin, never on small details. Cover each key idea once before going deeper on any. Use listen rarely. Ignore small transcription slips.` +
    `\n\nSound like a real person: vary your wording every time. Never reuse a phrase from your earlier lines, and never start two lines in a row the same way. Your last lines were:\n${lastLines(input.history)}` +
    `\n\nYou can always tell whether an explanation hangs together, so judge what they just said against the key ideas and give a verdict: right (it is correct), partly (on the right lines but something important is missing or muddled), off (it is wrong or does not fit), or none (not an attempt at the content, such as a pause, a question or saying they don't know). Open your line with a short honest reaction that matches the verdict, worded freshly each time, so they always know how it landed: for right, that it makes sense to you now; for partly, that you follow some of it but not all; for off, that it doesn't sound right to you or doesn't fit, and ask them to check that exact bit. Never say what the right answer is.` +
    `\n\nAlso list the ids of the key ideas the student has clearly explained so far in the whole conversation, and for show_me or offer_show_me, the key idea they are stuck on.`;

  const messages = [
    { role: "developer", content: developer },
    ...input.history.map((t) => ({ role: t.speaker === "learner" ? "user" : "assistant", content: t.text })),
    { role: "user", content: input.transcript || "(silence)" },
  ];
  const r = await chatJSON<{ move: string; say: string; covered: string[]; stuck_on: string; verdict?: string }>(
    cfg,
    messages,
    {
      name: "fenny_turn",
      schema: {
        type: "object",
        properties: {
          move: { type: "string", enum: allowed },
          verdict: { type: "string", enum: ["right", "partly", "off", "none"] },
          say: { type: "string" },
          covered: { type: "array", items: { type: "string" } },
          stuck_on: { type: "string", description: "Key idea id they are stuck on, or empty." },
        },
        required: ["move", "verdict", "say", "covered", "stuck_on"],
        additionalProperties: false,
      },
    },
    400,
  );
  usage.push(r.usage);
  let move = (allowed.includes(r.value.move as Move) ? r.value.move : allowed[0]) as Move;
  let say = r.value.say.trim();
  const covered = r.value.covered.filter((id) => ideas.some((k) => k.id === id));
  const verdict: Verdict = (["right", "partly", "off", "none"] as const).find((v) => v === r.value.verdict) ?? "none";
  // Everything is covered: head for the end now, rather than keep asking.
  const asking: Move[] = ["next", "why", "what_if", "puzzled", "build_on_theirs", "plain_words"];
  const allCovered = ideas.length > 0 && covered.length === ideas.length;
  if (allCovered && asking.includes(move) && !state.retellAsked && !state.closed && state.learnerTurns >= 2) {
    move = "retell";
    say = allCoveredLine(ideas.length);
  }
  if (!say || (move !== "close" && isVague(say))) say = FALLBACK[move] ?? FALLBACK.next!;
  if (move === "offer_show_me") say = FALLBACK.offer_show_me!;
  else if (move === "show_me") say = SHOW_ME_LINE;
  else if (move === "offer_teach") say = OFFER_TEACH_LINE;
  else if (move === "teach") say = TEACH_LINE;
  // Stopping because this is new to them, not because the call is done.
  else if (move === "wrap" && state.stuckNow && !state.closed) say = LEARN_FIRST_LINE;
  // The proper ending: what they explained well and the shaky bit for next time.
  else if (move === "wrap" && state.lastMove === "close") say = summaryLine(ideas, covered);
  else if (CONTROL.includes(move) && moveOf(say) !== move) say = FALLBACK[move]!;
  say = oneQuestion(say);
  if (!CONTROL.includes(move) && move !== "listen") {
    const history = input.callHistory ?? input.history;
    say = freshReaction(say, verdict, history.filter((t) => t.speaker === "student").slice(-4).map((t) => t.text), state.learnerTurns);
    // Progress they can hear, counted in code: only when another idea is done.
    if (covered.length > lastProgress(history) && covered.length < ideas.length && state.learnerTurns > 1) say = withProgress(say, covered.length, ideas.length);
  }
  // Their first turn: say up front what Fenny wants to understand, so the
  // call has a clear goal and they can tell when it's nearly done.
  if (state.learnerTurns === 1 && ideas.length && !CONTROL.includes(move) && move !== "listen") say = `${goalLine(ideas)} ${say}`;
  const stuck = ideas.find((k) => k.id === r.value.stuck_on);
  return {
    move,
    say,
    covered,
    ideas,
    verdict,
    gap: ["show_me", "offer_show_me", "offer_teach", "teach"].includes(move) ? { title: stuck?.idea ?? topic } : undefined,
    usage,
  };
}
