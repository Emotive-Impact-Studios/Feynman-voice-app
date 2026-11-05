// Cartesia: Ink for hearing the learner, Sonic for the student's voice.
// Both bill in credits: Ink 1 credit a second of audio, Sonic 1 credit a character.
import { ProviderError } from "./openai";

const BASE = "https://api.cartesia.ai";
export const CARTESIA_VERSION = "2026-08-14";

export interface CartesiaConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

function headers(cfg: CartesiaConfig): Record<string, string> {
  return { authorization: `Bearer ${cfg.apiKey}`, "cartesia-version": CARTESIA_VERSION };
}

/** Batch transcription of one recorded turn with Ink. */
export async function transcribeCartesia(
  cfg: CartesiaConfig & { model?: string },
  audio: Uint8Array,
  mimeType: string,
): Promise<{ text: string }> {
  const f = cfg.fetchImpl ?? fetch;
  const form = new FormData();
  const ext = mimeType.includes("wav") ? "wav" : mimeType.split("/")[1] ?? "wav";
  form.append("file", new Blob([audio as BlobPart], { type: mimeType }), `turn.${ext}`);
  form.append("model", cfg.model ?? "ink-whisper");
  form.append("language", "en");
  const res = await f(`${BASE}/stt`, { method: "POST", headers: headers(cfg), body: form });
  if (!res.ok) throw new ProviderError("Cartesia transcription", res.status, (await res.text()).slice(0, 500));
  const body = (await res.json()) as { text?: string };
  return { text: (body.text ?? "").trim() };
}

export const SONIC_SAMPLE_RATE = 24000;

/** Sonic's pace for the student, from 0.6 (slowest) to 1.5. 1.0 is Sonic's own default. */
export const SONIC_SPEED = 1;

/**
 * One sentence of the student's voice from Sonic, as 16-bit PCM at 24 kHz.
 * 16-bit rather than float halves what we send to the phone.
 */
export async function speakSonic(
  cfg: CartesiaConfig & { model?: string; voiceId: string; speed?: number },
  text: string,
): Promise<Uint8Array> {
  const f = cfg.fetchImpl ?? fetch;
  const res = await f(`${BASE}/tts/bytes`, {
    method: "POST",
    headers: { ...headers(cfg), "content-type": "application/json" },
    body: JSON.stringify({
      model_id: cfg.model ?? "sonic-3.6",
      transcript: text,
      voice: { mode: "id", id: cfg.voiceId },
      language: "en",
      output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: SONIC_SAMPLE_RATE },
      generation_config: { speed: sonicSpeed(cfg.speed) },
    }),
  });
  if (!res.ok) throw new ProviderError("Cartesia Sonic", res.status, (await res.text()).slice(0, 500));
  return new Uint8Array(await res.arrayBuffer());
}

/** A speed Sonic accepts: the given one if valid, otherwise the default. */
export function sonicSpeed(speed?: number): number {
  return speed != null && Number.isFinite(speed) && speed >= 0.6 && speed <= 1.5 ? speed : SONIC_SPEED;
}
