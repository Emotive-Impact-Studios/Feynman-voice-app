// Fenny's conversation engine. Each turn: work out where the call is (in
// code), let the model pick one allowed move and say one line for it, then
// check the line before Fenny speaks. Every call runs the Feynman loop:
// explain simply, find the gaps and go back to the source, then retell it
// all simply. See docs/conversation-engine.md.
import type { PastTurn } from "../gemini";
import { chatJSON, type ChatCfg, type ChatUsage } from "./chat";
import { keyIdeas, type KeyIdea } from "./ideas";
import { allowedMoves, callState, DEFAULT_LIMITS, isVague, LEARN_FIRST_LINE, moveOf, OFFER_LINE, OFFER_TEACH_LINE, SHOW_ME_LINE, TEACH_LINE, type Limits, type Move } from "./policy";

// Fenny should never sound scripted. The model writes almost every line
// fresh. The few lines code has to be sure of (an offer the phone shows a
// button for, the goodbye) come from small banks, and pickFresh never repeats
// one Fenny has said lately.

/** A number from some text, so each call picks differently but a retry picks the same. */
export function seedOf(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** One line from the bank that Fenny hasn't said in its recent lines. */
export function pickFresh(bank: string[], recent: string[], seed: number): string {
  const used = new Set(recent.map((l) => l.trim().toLowerCase()));
  const start = seed % bank.length;
  const order = [...bank.slice(start), ...bank.slice(0, start)];
  return order.find((l) => !used.has(l.toLowerCase()) && !recent.some((r) => r.toLowerCase().includes(l.toLowerCase()))) ?? order[0];
}

/** Ways to offer Teach me. Each names the button, so the phone and the next turn both know what it was. */
export const OFFER_TEACH_LINES = [
  OFFER_TEACH_LINE,
  "That's okay, sounds like you haven't met this bit yet. Tap Teach me, have a look, then explain it back to me.",
  "Fair enough, nobody knows everything. Have a go with Teach me, then come back and tell me how it works.",
  "Honestly, that's fine. Tap Teach me and you can learn it quickly, then teach it to me.",
];
const TEACH_LINES = [TEACH_LINE, "Lovely. Take your time with it, and then I want to hear it from you.", "Brilliant. Learn it your way, then come back and explain it to me."];
const LEARN_FIRST_LINES = [
  LEARN_FIRST_LINE,
  "That's fine, this bit is new to you. Have a look at your notes, and come back and teach me next time.",
  "No problem at all. Let's stop here, give it a read, and you can teach me the rest next time.",
];

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
  offer_teach: `Only if they clearly don't know this yet (they say so, guess wildly or have nothing to say). In your own fresh words, kindly say that's fine, name the thing they're stuck on in a few plain words, and suggest they tap Teach me to learn it and then come back and explain it to you. You must say the words "Teach me", with those capitals, because that is the button they tap. No question about the subject. Never word it the way you did before.`,
  teach: "They said yes to learning it first. Tell them, warmly and in a few fresh words, to have a go at it and then come back and explain it to you. No question.",
  let_go: "Only if they are stuck or have asked to move on or skip this. Say that's fine, you'll come back to it, and ask about a different key idea they have not covered. Never ask about the bit they were stuck on again, in any wording.",
  retell: "Most of it is covered. Thank them in a few words and ask them to explain the whole thing to you again in about 30 seconds, as simply as they can.",
  wrap: "The call is finishing. Thank them warmly in a few words, say that's a good place to stop, and that you'll pick up the shaky bit next time. No question.",
  close: "They just gave the short version. Tell them warmly and specifically what was clear, in one short sentence, then ask which bit felt shakiest to them.",
};

/** Used only when the model's line can't be used. Several each, so even these don't repeat. */
const FALLBACK: Partial<Record<Move, string[]>> = {
  listen: ["Mm, go on.", "Keep going.", "I'm listening.", "Carry on."],
  next: ["And what happens after that?", "So what comes next?", "Okay, then what?"],
  why: ["Why would that happen?", "How come?", "What makes it do that?"],
  offer_show_me: [`No worries. ${OFFER_LINE}`],
  show_me: [SHOW_ME_LINE],
  offer_teach: OFFER_TEACH_LINES,
  teach: TEACH_LINES,
  let_go: ["That's fine, let's come back to that. What happens next?", "Let's leave that one for now. What comes after it?", "Fair enough, we'll park that. What else happens?"],
  retell: [
    "That helped loads. Can you explain the whole thing to me again in 30 seconds, really simply?",
    "I think I'm nearly there. Could you give me the whole thing again in 30 seconds, as simply as you can?",
  ],
  close: ["That was really clear. Which bit felt shakiest to you?", "I followed that. Which part felt shakiest for you?"],
  wrap: [
    "Thanks, that really helped. That's a good place to stop, and we'll pick that bit up next time.",
    "That was great, thank you. Let's stop there and come back to the tricky bit next time.",
  ],
};

/**
 * Moves the next turn reads back from Fenny's words. Their lines must be
 * recognisable, or the call loses its place (an accepted offer, a retell).
 */
const CONTROL: Move[] = ["offer_show_me", "show_me", "offer_teach", "teach", "retell", "close", "wrap"];

const PERSONA = `You are Fenny, a curious, friendly beginner. A university student is teaching you a topic out loud so they learn it properly. You know nothing about it beyond what they tell you, and you never explain or correct. You speak British English in short, natural, spoken sentences, with contractions (it's, that's, don't, you're) the way people really talk. Write proper full sentences with ordinary punctuation, because a voice reads them aloud: never use em dashes, en dashes, hyphens as pauses, semicolons, symbols, lists, markdown or emoji. Use a comma or a full stop instead of a dash. Never ask vague questions like "what do you mean" or "which bit". Questions are always concrete and about the subject. Never bring in a fact, term or example they have not said themselves: you only know what they told you.`;

/** Keep only the first question, so Fenny never asks two at once. */
export type Verdict = "right" | "partly" | "off" | "none";

/** "a", "a and b", "a, b and c". */
export function listOf(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const NUMBER = ["no", "one", "two", "three", "four", "five"];
const count = (n: number) => NUMBER[n] ?? String(n);

const GOALS: ((n: string, list: string) => string)[] = [
  (n, list) => `Okay, I'm with you. By the end I'd love to understand ${n} things: ${list}.`,
  (_, list) => `Right, here's what I'm hoping to get my head round: ${list}.`,
  (n, list) => `Nice start. There are ${n} things I want to understand by the end: ${list}.`,
  (_, list) => `Got it. If I can understand ${list} by the end, I'll be really happy.`,
  (n, list) => `Okay. I'd like to come away understanding ${n} things: ${list}.`,
];

/** Said once, on their first turn: what Fenny hopes to understand, so the call has a clear goal and end. */
export function goalLine(ideas: KeyIdea[], seed = 0): string {
  const labels = ideas.map((k) => k.label.replace(/[.?!]+$/, ""));
  return GOALS[seed % GOALS.length](count(labels.length), listOf(labels));
}

/** Fresh openers for each verdict, used when the model repeats one of its recent openers. */
const REACTIONS: Record<Exclude<Verdict, "none">, string[]> = {
  right: ["Oh, that makes sense.", "Ah, I get it now.", "Right, that clicks.", "That adds up.", "Oh nice, I follow that.", "Got it, that's clear.", "Ahh, okay.", "That's really clear."],
  partly: ["I follow some of that.", "I think I get part of it.", "Hmm, I'm halfway there.", "Some of that makes sense to me.", "I'm getting there.", "Nearly with you."],
  off: ["Hmm, that doesn't sound quite right to me.", "Wait, I'm not sure that adds up.", "Hmm, that doesn't fit for me.", "I'm not sure that's right.", "Hang on, that confuses me a bit."],
};

const firstSentence = (line: string) => line.match(/^[^.!?]*[.!?]/)?.[0] ?? "";
const sentences = (line: string) => line.match(/[^.!?]+[.!?]*/g)?.map((x) => x.trim().toLowerCase()) ?? [];
/** "two of the four", "two out of four": how progress is said, so it can be read back. */
const NUMBER_WORD = /(?:^|[.!?]\s+|that'?s |that makes )(\w+) (?:of|out of) (?:the )?(\w+)(?: things| done)?\./gi;

/** A word Fenny opens with. Saying the same one line after line is what makes it sound canned. */
const OPENER = /^(ooh+|oh+|ah+|hmm+|mm+|right|okay|ok|great|nice|lovely|brilliant|no worries|that'?s (?:completely |totally )?(?:fine|okay|alright)|that is (?:completely |totally )?(?:fine|okay|alright)|fair enough|got it|wow|ah right|oh nice)\b[,.!]?\s*/i;

/** Drop the opening "Ooh," or "No worries," if Fenny opened one of its recent lines with it too. */
export function noRepeatOpener(say: string, recent: string[]): string {
  // A short opening sentence that starts like one of the recent lines ("That's fine." after "That's fine, ...") goes.
  const first = firstSentence(say).trim();
  const rest0 = say.slice(first.length).trim();
  const start = (x: string) => x.toLowerCase().replace(/’/g, "'").replace(/[^a-z' ]/g, "").replace(/\bthat is\b/g, "that's").split(/\s+/).slice(0, 2).join(" ");
  if (first && rest0 && first.split(/\s+/).length <= 6 && recent.some((l) => sentences(l).some((x) => start(x) === start(first)))) return noRepeatOpener(rest0, recent);
  const m = say.match(OPENER);
  if (!m) return say;
  const word = m[1].toLowerCase().replace(/^that is/, "that's").replace(/ (completely|totally)/, "");
  const norm = (x: string) => x.replace(/^that is/, "that's").replace(/ (completely|totally)/, "");
  const used = recent.some((l) => sentences(l).some((x) => norm(x).startsWith(word)));
  if (!used) return say;
  const rest = say.slice(m[0].length).replace(/^[\s,.!—–-]+/, "");
  return rest ? `${rest[0].toUpperCase()}${rest.slice(1)}` : say;
}

/**
 * The reaction opens the line and tells them how the answer landed. Keep it
 * from sounding canned: if it repeats an opener from Fenny's last few lines,
 * swap in a fresh one for the same verdict.
 */
export function freshReaction(say: string, verdict: Verdict, recent: string[], turn: number): string {
  if (verdict === "none") return say;
  const opener = firstSentence(say).trim();
  if (!opener) return say;
  // Any sentence of the recent lines counts, not just their openers.
  const used = recent.flatMap(sentences);
  if (!used.includes(opener.toLowerCase())) return say;
  // Every other time, no spoken reaction at all: Fenny's face already shows how it landed.
  const rest = say.slice(opener.length).trim();
  if (turn % 2 === 1 && rest) return rest;
  const bank = REACTIONS[verdict];
  const pick = [...bank.slice(turn % bank.length), ...bank.slice(0, turn % bank.length)].find((r) => !used.includes(r.toLowerCase()));
  return pick ? `${pick}${say.slice(opener.length)}` : rest;
}

/** How many ideas Fenny last said were done, read back from its own lines. */
export function lastProgress(history: PastTurn[]): number {
  for (const t of [...history].reverse()) {
    if (t.speaker !== "student") continue;
    for (const m of t.text.matchAll(NUMBER_WORD)) {
      const n = NUMBER.indexOf(m[1].toLowerCase());
      if (n > 0 && NUMBER.indexOf(m[2].toLowerCase()) > 0) return n;
    }
  }
  return 0;
}

const PROGRESS: ((d: string, t: string) => string)[] = [
  (d, t) => `That's ${d} of the ${t} things.`,
  (d, t) => `So that's ${d} out of ${t}.`,
  (d, t) => `${d[0].toUpperCase()}${d.slice(1)} of the ${t} done.`,
  (d, t) => `That makes ${d} out of the ${t}.`,
];

/** "That's two of the four things." goes after the reaction when they've just finished another idea. */
export function withProgress(say: string, done: number, total: number, seed = 0): string {
  const note = PROGRESS[(seed + done) % PROGRESS.length](count(done), count(total));
  const opener = firstSentence(say);
  return opener && opener.length < say.length ? `${opener} ${note}${say.slice(opener.length)}` : `${note} ${say}`;
}

/** Everything is covered: ask for the short retell, and say why now. */
export function allCoveredLine(n: number, seed = 0): string {
  const lines = [
    `That's all ${count(n)} things I wanted to understand. Can you explain the whole thing to me again in 30 seconds, really simply?`,
    `I think I've got all ${count(n)} now. Could you give me the whole thing again in 30 seconds, as simply as you can?`,
    `That's everything I wanted to know. Try the whole thing again in about 30 seconds, nice and simple?`,
  ];
  return lines[seed % lines.length];
}

/** The goodbye after the shakiest-bit question: what went well and what comes back next time. */
const THANKS = ["Thanks, that really helped.", "That was brilliant, thank you.", "Thank you, I learnt loads.", "That really helped me, thanks."];

export function summaryLine(ideas: KeyIdea[], covered: string[], seed = 0): string {
  const got = ideas.filter((k) => covered.includes(k.id)).map((k) => k.label);
  const shaky = ideas.find((k) => !covered.includes(k.id));
  const well = got.length ? ` You explained ${listOf(got.slice(0, 3))} really well.` : "";
  const next = shaky
    ? ` ${shaky.label[0].toUpperCase()}${shaky.label.slice(1)} was the shaky bit, so we'll pick it up next time.`
    : " You covered everything, so next time we'll start with the bit you found shakiest.";
  return `${THANKS[seed % THANKS.length]}${well}${next}`;
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

  // Stopping because it's new to them is a different goodbye from the end of a call.
  const guideFor = (m: Move) =>
    m === "wrap" && state.stuckNow && !state.closed
      ? "They don't know this part yet, and it's time to stop. Kindly say it's fine that it's new, suggest they have a look at their notes, and say they can come back and teach you next time. Use the words next time. No question. Fresh words, not ones you have used."
      : MOVE_GUIDE[m];
  const guide = allowed.map((m) => `- ${m}: ${guideFor(m)}`).join("\n");
  const allMine = (input.callHistory ?? input.history).filter((t) => t.speaker === "student").map((t) => t.text);
  const openers = [...new Set(allMine.map((l) => l.split(/\s+/).slice(0, 2).join(" ").replace(/[,.!?]+$/, "")).filter(Boolean))];
  const seed = seedOf(`${topic}|${input.transcript}|${state.learnerTurns}`);
  const developer =
    PERSONA +
    `\n\nTopic: ${topic}\nKey ideas a full explanation needs (private, never say the ideas themselves; the labels in brackets are what the student knows you want to understand):\n` +
    ideas.map((k) => `${k.id}: ${k.idea} [${k.label}]`).join("\n") +
    `\n\nThis turn, choose exactly one of these moves and say one line for it (under 22 words, at most one question):\n${guide}` +
    `\n\nMost turns should be a real, specific question about the subject that moves the explanation on. Probe (why, what_if, puzzled) on key ideas that are missing or thin, never on small details. Cover each key idea once before going deeper on any. Use listen rarely. Ignore small transcription slips.` +
    `\n\nSound like a real person on a call, not a script: vary your wording every time, follow what they actually said, and let the conversation drift naturally. Never reuse a phrase from your earlier lines. Don't open with a sound like "Ooh" or "Oh" or with "No worries" more than once a call. When they say they don't know, react the way a friend would to that exact moment, never with a stock phrase. Your last lines were:\n${lastLines(input.history)}` +
    (openers.length ? `\nYou have already opened lines with: ${openers.map((o) => `"${o}"`).join(", ")}. Open differently this time.` : "") +
    `\n\nYou can always tell whether an explanation hangs together, so judge what they just said against the key ideas and give a verdict: right (it is correct), partly (on the right lines but something important is missing or muddled), off (it is wrong or does not fit), or none (not an attempt at the content, such as a pause, a question or saying they don't know). Your face already shows the verdict, so a spoken reaction is optional: give one when it adds something, in fresh words, and often just go straight to your question. When you do react: for right, that it makes sense to you; for partly, that you follow some of it but not all; for off, that it doesn't sound right to you or doesn't fit, and ask them to check that exact bit. Never say what the right answer is.` +
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
    say = allCoveredLine(ideas.length, seed);
  }
  const recent = allMine.slice(-6);
  const fallback = () => pickFresh(FALLBACK[move] ?? FALLBACK.next!, recent, seed);
  if (!say || (move !== "close" && isVague(say))) say = fallback();
  if (move === "offer_show_me") say = FALLBACK.offer_show_me![0];
  else if (move === "show_me") say = SHOW_ME_LINE;
  // The model words the offer itself; it only has to name the button.
  else if (move === "offer_teach") say = /\bTeach me\b/.test(say) && moveOf(say) === "offer_teach" ? say : fallback();
  else if (move === "teach") say = say.includes("?") ? fallback() : say;
  // Stopping because this is new to them, not because the call is done.
  else if (move === "wrap" && state.stuckNow && !state.closed) say = moveOf(say) === "wrap" && !say.includes("?") && /\b(new|notes|learn|read|look)\b/i.test(say) ? say : pickFresh(LEARN_FIRST_LINES, recent, seed);
  // The proper ending: what they explained well and the shaky bit for next time.
  else if (move === "wrap" && state.lastMove === "close") say = summaryLine(ideas, covered, seed);
  else if (CONTROL.includes(move) && moveOf(say) !== move) say = fallback();
  say = oneQuestion(say);
  if (!CONTROL.includes(move) && move !== "listen") {
    const history = input.callHistory ?? input.history;
    say = freshReaction(say, verdict, recent.slice(-4), state.learnerTurns);
    // Progress they can hear, counted in code: only when another idea is done.
    if ((verdict === "right" || verdict === "partly") && covered.length > lastProgress(history) && covered.length < ideas.length && state.learnerTurns > 1) say = withProgress(say, covered.length, ideas.length, seed);
  }
  // Never open with the same "Ooh," or "No worries," as a recent line.
  if (move !== "show_me" && move !== "offer_show_me") say = noRepeatOpener(say, recent);
  // Their first turn: say up front what Fenny wants to understand, so the
  // call has a clear goal and they can tell when it's nearly done.
  if (state.learnerTurns === 1 && ideas.length && !CONTROL.includes(move) && move !== "listen") say = `${goalLine(ideas, seed)} ${say}`;
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
