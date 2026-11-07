// The narrated film for Teach me. Each bite is spoken as a few short
// sentences, and each sentence makes the next part of the bite's drawing
// appear, landing on the word that names it (the cue). One bite in a lesson
// may pause before its last sentence to ask the student what will happen
// next: predicting first makes the reveal stick.
//
// The app plays these in order, timed by the voice. Older lessons without a
// film still play: the app splits the bite's text into sentences instead.
import { speakable } from "./speakable";

export interface FilmBeat {
  /** One sentence Fenny says. */
  say: string;
  /** One word from say: the change lands as Fenny says it. "" lets the app place it. */
  cue: string;
}

export interface Guess {
  /** Asked before the bite's last sentence, e.g. "Which way will the water go?" */
  ask: string;
  /** Exactly two short answers. */
  options: string[];
  /** The right option, copied from options. */
  answer: string;
}

const str = { type: "string" };
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export const FILM_SCHEMA = { type: "array", items: obj({ say: str, cue: str }) } as const;
export const GUESS_SCHEMA = { anyOf: [obj({ ask: str, options: { type: "array", items: str }, answer: str }), { type: "null" }] } as const;

export const FILM_PROMPT = `film: Fenny also narrates each bite while its scene draws itself, one sentence at a time. Each sentence makes the next part of the drawing appear, so write them in the order the drawing builds (the scene's slots, left to right).
- 2 to 4 sentences, each under 15 words, together under 45 words. Say what text says, as you would say it aloud to a friend, at the lesson's level.
- The first sentence names the parts the drawing starts with. The last names the change or result that is the point.
- cue: one word copied exactly from that sentence, the word that names what appears at that moment (a noun or a verb, never "the", "it" or "this").

guess: exactly one bite in the lesson gets a guess, the one with the clearest cause and effect (usually a scene with movement or a change). The others get null.
- ask: a question under 10 words about what will happen next in the picture, like "Which way will the water go?" It is asked before that bite's last sentence, and the film waits for the student to pick.
- options: exactly 2 short answers, 1 to 4 words each, both believable. answer: the right one, copied exactly.
- The last sentence of that bite then shows the answer, so it must not appear in the sentences before it.`;

/** Lower case words with no punctuation, for matching a cue to its sentence. */
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Splits a bite's text into sentences: the film for a bite the writer gave none. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Keeps 1 to 4 spoken sentences, each cue a word of its sentence. Falls back to the bite's text. */
export function checkFilm(f: unknown, text: string): FilmBeat[] {
  const beats = (Array.isArray(f) ? f : [])
    .map((b: Record<string, unknown>): FilmBeat => {
      const say = speakable(String(b?.say ?? "").trim());
      const cue = words(String(b?.cue ?? ""))[0] ?? "";
      return { say, cue: cue && words(say).includes(cue) ? cue : "" };
    })
    .filter((b) => b.say)
    .slice(0, 4);
  if (beats.length) return beats;
  return sentencesOf(text)
    .slice(0, 4)
    .map((say) => ({ say: speakable(say), cue: "" }));
}

/** A guess needs a question, two different answers and the right one among them. */
export function checkGuess(g: unknown, film: FilmBeat[]): Guess | null {
  if (!g || typeof g !== "object" || film.length < 2) return null;
  const r = g as Record<string, unknown>;
  const ask = speakable(String(r.ask ?? "").trim());
  const options = (Array.isArray(r.options) ? r.options : []).map((o) => String(o).trim()).filter(Boolean);
  if (!ask || options.length !== 2 || options[0].toLowerCase() === options[1].toLowerCase()) return null;
  const answer = options.find((o) => o.toLowerCase() === String(r.answer ?? "").trim().toLowerCase());
  return answer ? { ask, options, answer } : null;
}
