// OpenAI version of the student, used while we wait on a Gemini key.
// Two calls: transcribe the learner's audio, then ask a small text model for
// the question. OpenAI's audio-in chat models do not support structured
// output and the mini one is deprecated, so this is the steadier route.
import { notesBlock, STUDENT_SYSTEM_PROMPT } from "./prompt";
import type { PastTurn, StudentReply } from "./gemini";
import type { CostLine } from "./pricing";

export interface OpenAIConfig {
  apiKey: string;
  transcribeModel: string;
  chatModel: string;
  reasoningEffort?: string;
  prices: { transcribeUsdPerMin: number; chatInPerM: number; chatCachedInPerM: number; chatOutPerM: number };
  fetchImpl?: typeof fetch;
}

export interface OpenAIReply extends StudentReply {
  costLines: CostLine[];
  timingMs: { transcribe: number; chat: number };
}

export async function askStudentOpenAI(
  cfg: OpenAIConfig,
  input: { audio: Uint8Array; mimeType: string; recordedSeconds: number; history: PastTurn[]; notes?: string; topic?: string },
): Promise<OpenAIReply> {
  const f = cfg.fetchImpl ?? fetch;
  const auth = { authorization: `Bearer ${cfg.apiKey}` };

  // 1. Transcribe.
  const t0 = Date.now();
  const tBody = await transcribeOpenAI(cfg, input.audio, input.mimeType);
  const transcript = tBody.text;
  const transcribeMs = Date.now() - t0;

  // 2. Ask the question.
  const topicLine = input.topic ? `\n\nThe topic they are explaining: ${input.topic}` : "";
  const messages = [
    {
      role: "developer",
      content:
        STUDENT_SYSTEM_PROMPT.replace(/\n\nAlso return a faithful transcript[^]*$/, "") +
        "\n\nYou receive a transcript of what they said, so ignore small transcription slips." +
        topicLine +
        notesBlock(input.notes),
    },
    ...input.history.map((t) => ({ role: t.speaker === "learner" ? "user" : "assistant", content: t.text })),
    { role: "user", content: transcript || "(silence)" },
  ];
  const body: Record<string, unknown> = {
    model: cfg.chatModel,
    messages,
    max_completion_tokens: 300,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "student_question",
        strict: true,
        schema: {
          type: "object",
          properties: { question: { type: "string" } },
          required: ["question"],
          additionalProperties: false,
        },
      },
    },
  };
  if (cfg.reasoningEffort) body.reasoning_effort = cfg.reasoningEffort;
  const t1 = Date.now();
  const cRes = await f("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!cRes.ok) throw new ProviderError("OpenAI chat", cRes.status, (await cRes.text()).slice(0, 500));
  const cBody = (await cRes.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };
  const chatMs = Date.now() - t1;
  let question = "";
  try {
    question = JSON.parse(cBody.choices?.[0]?.message?.content ?? "{}").question ?? "";
  } catch {
    question = cBody.choices?.[0]?.message?.content ?? "";
  }

  const u = cBody.usage ?? {};
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  const freshIn = Math.max(0, (u.prompt_tokens ?? 0) - cached);
  const out = u.completion_tokens ?? 0; // includes any reasoning tokens
  const p = cfg.prices;
  const costLines: CostLine[] = [
    { label: `${cfg.transcribeModel} (${input.recordedSeconds.toFixed(1)}s audio)`, usd: (input.recordedSeconds / 60) * p.transcribeUsdPerMin },
    {
      label: `${cfg.chatModel} (${freshIn} in, ${cached} cached, ${out} out)`,
      usd: (freshIn * p.chatInPerM + cached * p.chatCachedInPerM + out * p.chatOutPerM) / 1e6,
    },
  ];
  return {
    transcript,
    question: question.trim() || "Sorry, could you say that again?",
    usage: { transcription: tBody.usage, chat: cBody.usage } as never,
    costLines,
    timingMs: { transcribe: transcribeMs, chat: chatMs },
  };
}

/** Turn one recorded turn into text with OpenAI's transcription model. */
export async function transcribeOpenAI(
  cfg: Pick<OpenAIConfig, "apiKey" | "transcribeModel" | "fetchImpl">,
  audio: Uint8Array,
  mimeType: string,
): Promise<{ text: string; usage?: unknown }> {
  const f = cfg.fetchImpl ?? fetch;
  const form = new FormData();
  const ext = mimeType.includes("wav") ? "wav" : mimeType.split("/")[1] ?? "wav";
  form.append("file", new Blob([audio as BlobPart], { type: mimeType }), `turn.${ext}`);
  form.append("model", cfg.transcribeModel);
  form.append("language", "en");
  form.append("response_format", "json");
  const res = await f("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.apiKey}` },
    body: form,
  });
  if (!res.ok) throw new ProviderError("OpenAI transcription", res.status, (await res.text()).slice(0, 500));
  const body = (await res.json()) as { text?: string; usage?: unknown };
  return { text: (body.text ?? "").trim(), usage: body.usage };
}

export class ProviderError extends Error {
  constructor(public stage: string, public status: number, public detail: string) {
    super(`${stage} returned ${status}`);
  }
}
