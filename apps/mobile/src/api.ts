import { NdjsonReader } from "@feynman/audio";
import type { PhonemeChunk } from "@feynman/kitten-tts";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
const TOKEN = process.env.EXPO_PUBLIC_PROTOTYPE_TOKEN ?? "";

export interface Turn {
  speaker: "learner" | "student";
  text: string;
}

export interface TurnResponse {
  transcript: string;
  question: string;
  speech: PhonemeChunk[];
  audioSeconds: number;
  brain: "openai" | "gemini";
  cost: { pence: number; usd: number; lines: { label: string; pence: number }[] };
  timingMs: { brain: number; phonemes: number; transcribe?: number; chat?: number };
}

export async function sendTurn(input: {
  audioBase64: string;
  audioSeconds: number;
  history: Turn[];
  topic: string;
}, signal?: AbortSignal): Promise<TurnResponse> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/turn`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ ...input, mimeType: "audio/wav" }),
    signal,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Server returned ${res.status}`);
  return body as TurnResponse;
}

// Live call mode -----------------------------------------------------------

export type LiveVoice = "phonon" | "sonic" | "kitten";
export type LiveEars = "auto" | "openai" | "cartesia";

export type LiveEvent =
  | { type: "transcript"; text: string }
  | { type: "sentence"; index: number; text: string; speech?: PhonemeChunk[]; audio?: string; sampleRate?: number }
  | {
      type: "done";
      transcript: string;
      question: string;
      voice: LiveVoice;
      stt: "openai" | "cartesia";
      cost: { pence: number; usd: number; lines: { label: string; pence: number }[] };
      timingMs: { transcribe: number; brain: number; firstSentence: number; total: number };
    }
  | { type: "error"; error: string; detail?: string }
  /** Fenny's conversation engine: the move it made this turn. "wrap" is the goodbye. */
  | { type: "engine"; move: string; covered: string[]; ideas: { id: string; idea: string }[] }
  /** They clearly don't know this bit yet: show Teach me. */
  | { type: "teach_offer"; gap: { title: string } }
  /** They said yes to the offer: open teach mode now. */
  | { type: "teach"; gap: { title: string } };

/** Base URL of the Phonon model bundle the API serves for iPhones to download. */
export const PHONON_BUNDLE_URL = API_URL ? `${API_URL.replace(/\/$/, "")}/phonon/31m-en-0.6.0` : "";

/**
 * Send one finished turn and receive the reply as a stream of events, so the
 * student can start speaking its first sentence before the rest is written.
 */
export async function streamLiveTurn(
  input: {
    audioBase64: string;
    audioSeconds: number;
    history: Turn[];
    topic: string;
    voice: LiveVoice;
    ears: LiveEars;
    /** What this phone can handle. "wait": the server may say the learner isn't finished. */
    features?: string[];
  },
  onEvent: (e: LiveEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const { ears, ...rest } = input;
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/live-turn`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ ...rest, mimeType: "audio/wav", ...(ears === "auto" ? {} : { stt: ears }) }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Server returned ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const lines = new NdjsonReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    lines.push(decoder.decode(value, { stream: true }), (e) => onEvent(e as LiveEvent));
  }
  lines.flush((e) => onEvent(e as LiveEvent));
}

// Teach me -----------------------------------------------------------------

export type PictureKind = "flow" | "compare" | "cycle" | "layers" | "parts" | "none";
export type PuzzleKind = "true_false" | "choose" | "fill_gap" | "order" | "match";

export interface LessonPuzzle {
  kind: PuzzleKind;
  prompt: string;
  options: string[];
  answer: string[];
  why: string;
}

export interface LessonBite {
  title: string;
  text: string;
  picture: { kind: PictureKind; labels: string[] };
  quote: string;
  fromNotes: boolean;
  puzzle: LessonPuzzle;
}

export interface Lesson {
  idea: string;
  bites: LessonBite[];
  recap: string;
  explainBack: string;
}

/** A short lesson on one idea the learner is stuck on, built on the server from their notes. */
export async function fetchLesson(input: { topic: string; idea: string; notes?: string; said?: string }, signal?: AbortSignal): Promise<Lesson> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/lesson`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(input),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Server returned ${res.status}`);
  return (body as { lesson: Lesson }).lesson;
}

/** One line in Fenny's voice, without a turn (the opening question, a lesson bite). */
export async function speakLine(
  input: { text: string; voice: LiveVoice },
  signal?: AbortSignal,
): Promise<{ text: string; audio?: string; sampleRate?: number; speech?: PhonemeChunk[] }> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/speak`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(input),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Server returned ${res.status}`);
  return body as { text: string; audio?: string; sampleRate?: number; speech?: PhonemeChunk[] };
}
