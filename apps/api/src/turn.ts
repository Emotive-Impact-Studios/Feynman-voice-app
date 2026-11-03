import { askStudent, GeminiError, type PastTurn } from "./gemini";
import { costOf, pricesFromEnv } from "./pricing";
import { toSpeechChunks } from "./speech";

const MAX_AUDIO_BYTES = 3 * 1024 * 1024; // keeps us under the 4.5MB serverless body limit once base64 encoded
const ALLOWED_MIME = new Set(["audio/wav", "audio/x-wav", "audio/aac", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/flac", "audio/webm"]);

export interface TurnRequest {
  audioBase64: string;
  mimeType: string;
  audioSeconds: number;
  history?: PastTurn[];
  topic?: string;
  notes?: string;
}

type Env = Record<string, string | undefined>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** POST /api/turn. Framework free: takes a Request, returns a Response. */
export async function handleTurn(req: Request, env: Env = process.env, fetchImpl?: typeof fetch): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Use POST" });
  if (env.PROTOTYPE_TOKEN && req.headers.get("authorization") !== `Bearer ${env.PROTOTYPE_TOKEN}`) {
    return json(401, { error: "Missing or wrong prototype token" });
  }
  if (!env.GEMINI_API_KEY) return json(500, { error: "GEMINI_API_KEY is not set on the server" });

  let body: TurnRequest;
  try {
    body = (await req.json()) as TurnRequest;
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  if (!body.audioBase64 || typeof body.audioBase64 !== "string") return json(400, { error: "audioBase64 is required" });
  if (!ALLOWED_MIME.has(body.mimeType)) return json(400, { error: `Unsupported mimeType ${body.mimeType}` });
  if (body.audioBase64.length * 0.75 > MAX_AUDIO_BYTES) return json(413, { error: "Turn is too long. Keep it under a minute." });
  const audioSeconds = Number(body.audioSeconds) || 0;

  const t0 = Date.now();
  let reply;
  try {
    reply = await askStudent(
      {
        apiKey: env.GEMINI_API_KEY,
        model: env.GEMINI_MODEL ?? "gemini-3.8-flash",
        thinkingLevel: env.GEMINI_THINKING_LEVEL,
        fetchImpl,
      },
      {
        audioBase64: body.audioBase64,
        mimeType: body.mimeType,
        history: (body.history ?? []).slice(-20),
        topic: body.topic,
        notes: body.notes,
      },
    );
  } catch (e) {
    if (e instanceof GeminiError) return json(502, { error: e.message, detail: e.detail });
    throw e;
  }
  const geminiMs = Date.now() - t0;
  const speech = await toSpeechChunks(reply.question);
  const phonemeMs = Date.now() - t0 - geminiMs;

  const cost = costOf(reply.usage, pricesFromEnv(env));
  return json(200, {
    transcript: reply.transcript,
    question: reply.question,
    speech,
    audioSeconds,
    cost: {
      ...cost,
      pencePerLearnerMinute: audioSeconds > 0 ? cost.pence / (audioSeconds / 60) : null,
    },
    usage: reply.usage,
    timingMs: { gemini: geminiMs, phonemes: phonemeMs },
  });
}
