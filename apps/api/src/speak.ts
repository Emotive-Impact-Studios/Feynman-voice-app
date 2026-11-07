// Speaks one line Fenny already knows, without a turn: the opening question
// at the start of a call, or a Teach me bite read aloud. Returns the same
// voice payload a live-turn sentence carries, so the phone plays it the same way.
import { speakSonic, SONIC_SAMPLE_RATE } from "./cartesia";
import { speakable } from "./speakable";
import { toSpeechChunks } from "./speech";
import { VOICES, type Voice } from "./live";

type Env = Record<string, string | undefined>;
const MAX_CHARS = 600;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function handleSpeak(req: Request, env: Env = process.env, fetchImpl?: typeof fetch): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Use POST" });
  if (env.PROTOTYPE_TOKEN && req.headers.get("authorization") !== `Bearer ${env.PROTOTYPE_TOKEN}`) return json(401, { error: "Unauthorised" });
  let body: { text?: string; voice?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  const text = speakable(body.text ?? "");
  if (!text) return json(400, { error: "text is required" });
  if (text.length > MAX_CHARS) return json(413, { error: "Text is too long" });
  const voice: Voice = VOICES.includes(body.voice as Voice) ? (body.voice as Voice) : "sonic";
  try {
    if (voice === "sonic") {
      if (!env.CARTESIA_API_KEY) return json(400, { error: "The Sonic voice needs CARTESIA_API_KEY on the server" });
      const pcm = await speakSonic(
        {
          apiKey: env.CARTESIA_API_KEY,
          voiceId: env.SONIC_VOICE_ID ?? "62ae83ad-4f6a-430b-af41-a9bede9286ca",
          model: env.SONIC_MODEL,
          speed: env.SONIC_SPEED ? Number(env.SONIC_SPEED) : undefined,
          fetchImpl,
        },
        text,
      );
      return json(200, { text, audio: Buffer.from(pcm).toString("base64"), sampleRate: SONIC_SAMPLE_RATE, encoding: "pcm_s16le" });
    }
    if (voice === "kitten") return json(200, { text, speech: await toSpeechChunks(text) });
    // Phonon speaks on the phone: the cleaned line is all it needs.
    return json(200, { text });
  } catch (e) {
    console.error("speak", e);
    return json(502, { error: "Could not speak that line" });
  }
}
