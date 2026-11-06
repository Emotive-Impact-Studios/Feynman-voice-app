// Timing a drawing to a voice, for Teach me's narrated film. Each line Fenny
// says builds the next part of a drawing, and the part should land just as
// Fenny says the word that names it (the cue). The voices tell us when a line
// starts and how long it lasts, not when each word is spoken, so the cue's
// moment is estimated from where it sits in the line.

export interface FilmLine {
  /** One sentence Fenny says. */
  say: string;
  /** One word from say, or "" to land the part just past the middle of the line. */
  cue: string;
}

/** An instant change lands this long before its word, never after (Fenny Visual Language timing). */
export const LIGHT_LEAD_MS = 80;
/** No part builds faster than this, so it reads as drawn, not cut in. */
export const MIN_RAMP_MS = 450;
/** Speaking pace for planning when there is no voice to time against. */
export const WORDS_PER_SECOND = 2.3;

/** Splits text into sentences. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A bite's film, or, for a lesson written before films, its text one sentence per part. */
export function filmLines(film: FilmLine[] | null | undefined, text: string): FilmLine[] {
  const lines = (film ?? []).filter((l) => l.say?.trim());
  if (lines.length) return lines.slice(0, 4);
  return sentences(text)
    .slice(0, 4)
    .map((say) => ({ say, cue: "" }));
}

/** The share of the line spoken before the cue word starts, 0 to 1. */
export function cueShare(say: string, cue: string): number {
  const word = cue.replace(/[^\p{L}\p{N}]/gu, "");
  if (!word) return 0.55;
  const m = new RegExp(`(^|[^\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, "iu").exec(say);
  if (!m) return 0.55;
  const at = m.index + m[1].length;
  return Math.max(0.04, Math.min(0.95, at / Math.max(1, say.length)));
}

/** How long a line takes to say at planning pace, with a short breath after it. */
export function estimateMs(say: string, wordsPerSecond = WORDS_PER_SECOND): number {
  const words = say.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / wordsPerSecond) * 1000) + 300;
}

/**
 * When to build one part. The line lasts durationMs and has already been
 * playing for elapsedMs (negative if it starts later). The part waits
 * delayMs, then eases in over rampMs, arriving just before its cue word.
 */
export function rampFor(line: FilmLine, durationMs: number, elapsedMs = 0): { delayMs: number; rampMs: number } {
  const delayMs = Math.max(0, -elapsedMs);
  const landMs = durationMs * cueShare(line.say, line.cue) - LIGHT_LEAD_MS - elapsedMs;
  return { delayMs, rampMs: Math.round(Math.max(MIN_RAMP_MS, landMs - delayMs)) };
}

/** How far the drawing has built after part k of n (k from 0): parts build in equal steps. */
export function buildAfter(k: number, n: number): number {
  return n <= 0 ? 1 : Math.max(0, Math.min(1, (k + 1) / n));
}
