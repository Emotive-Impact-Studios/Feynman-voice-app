import { askStudent, GeminiError, type PastTurn } from "./gemini";
import { askStudentOpenAI, ProviderError } from "./openai";
import { costOf, openAIPricesFromEnv, pricesFromEnv, wavSeconds, type CostLine } from "./pricing";
import { toSpeechChunks } from "./speech";
import { speakable } from "./speakable";

const MAX_AUDIO_BYTES = 3 * 1024 * 1024; // keeps us under the 4.5MB serverless body limit once base64 encoded
const ALLOWED_MIME = new Set(["audio/wav", "audio/x-wav", "audio/aac", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/flac", "audio/webm"]);

export interface TurnRequest {
  audioBase64: string;
  mimeType: string;
  /** Seconds the learner was actually speaking (what their minutes are charged for). */
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
  const brain = (env.BRAIN ?? "openai").toLowerCase();
  if (brain === "openai" && !env.OPENAI_API_KEY) return json(500, { error: "OPENAI_API_KEY is not set on the server" });
  if (brain === "gemini" && !env.GEMINI_API_KEY) return json(500, { error: "GEMINI_API_KEY is not set on the server" });
  if (brain !== "openai" && brain !== "gemini") return json(500, { error: `Unknown BRAIN ${brain}` });

  let body: TurnRequest;
  try {
    body = (await req.json()) as TurnRequest;
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  if (!body.audioBase64 || typeof body.audioBase64 !== "string") return json(400, { error: "audioBase64 is required" });
  if (!ALLOWED_MIME.has(body.mimeType)) return json(400, { error: `Unsupported mimeType ${body.mimeType}` });
  if (body.audioBase64.length * 0.75 > MAX_AUDIO_BYTES) return json(413, { error: "Turn is too long. Keep it under a minute." });
  const audio = Uint8Array.from(Buffer.from(body.audioBase64, "base64"));
  const speakingSeconds = Number(body.audioSeconds) || 0;
  const recordedSeconds = wavSeconds(audio) ?? speakingSeconds;
  const history = (body.history ?? []).slice(-20);

  const t0 = Date.now();
  let transcript: string;
  let question: string;
  let lines: CostLine[];
  let usage: unknown;
  let stages: Record<string, number>;
  try {
    if (brain === "openai") {
      const r = await askStudentOpenAI(
        {
          apiKey: env.OPENAI_API_KEY!,
          transcribeModel: env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
          chatModel: env.OPENAI_CHAT_MODEL ?? "gpt-5.4-mini",
          reasoningEffort: env.OPENAI_REASONING_EFFORT ?? "none",
          prices: openAIPricesFromEnv(env),
          fetchImpl,
        },
        { audio, mimeType: body.mimeType, recordedSeconds, history, topic: body.topic, notes: body.notes },
      );
      ({ transcript, question, usage } = r);
      lines = r.costLines;
      stages = r.timingMs;
    } else {
      const r = await askStudent(
        { apiKey: env.GEMINI_API_KEY!, model: env.GEMINI_MODEL ?? "gemini-3.8-flash", thinkingLevel: env.GEMINI_THINKING_LEVEL, fetchImpl },
        { audioBase64: body.audioBase64, mimeType: body.mimeType, history, topic: body.topic, notes: body.notes },
      );
      ({ transcript, question, usage } = r);
      const c = costOf(r.usage, pricesFromEnv(env));
      lines = [{ label: `Gemini (${c.audioInTokens} audio in, ${c.textInTokens} text in, ${c.outTokens} out)`, usd: c.usd }];
      stages = {};
    }
  } catch (e) {
    if (e instanceof GeminiError) return json(502, { error: e.message, detail: e.detail });
    if (e instanceof ProviderError) return json(502, { error: e.message, detail: e.detail });
    throw e;
  }
  const brainMs = Date.now() - t0;
  question = speakable(question) || question;
  const speech = await toSpeechChunks(question);
  const phonemeMs = Date.now() - t0 - brainMs;

  const gbpPerUsd = pricesFromEnv(env).gbpPerUsd;
  const usd = lines.reduce((n, l) => n + l.usd, 0);
  const pence = usd * gbpPerUsd * 100;
  return json(200, {
    brain,
    transcript,
    question,
    speech,
    audioSeconds: speakingSeconds,
    recordedSeconds,
    cost: {
      usd,
      pence,
      lines: lines.map((l) => ({ ...l, pence: l.usd * gbpPerUsd * 100 })),
      pencePerLearnerMinute: speakingSeconds > 0 ? pence / (speakingSeconds / 60) : null,
    },
    usage,
    timingMs: { brain: brainMs, ...stages, phonemes: phonemeMs },
  });
}
