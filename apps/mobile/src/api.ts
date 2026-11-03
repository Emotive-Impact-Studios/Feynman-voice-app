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
  cost: { pence: number; usd: number; audioInTokens: number; textInTokens: number; outTokens: number };
  timingMs: { gemini: number; phonemes: number };
}

export async function sendTurn(input: {
  audioBase64: string;
  audioSeconds: number;
  history: Turn[];
  topic: string;
}): Promise<TurnResponse> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/turn`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ ...input, mimeType: "audio/wav" }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Server returned ${res.status}`);
  return body as TurnResponse;
}
