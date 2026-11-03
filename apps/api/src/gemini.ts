import { notesBlock, STUDENT_SYSTEM_PROMPT } from "./prompt";
import type { GeminiUsage } from "./pricing";

export interface PastTurn {
  speaker: "learner" | "student";
  text: string;
}

export interface StudentReply {
  transcript: string;
  question: string;
  usage: GeminiUsage;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  thinkingLevel?: string;
  fetchImpl?: typeof fetch;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING", description: "What the student said in this turn, word for word." },
    question: { type: "STRING", description: "Your one short, naive follow-up question." },
  },
  required: ["transcript", "question"],
};

export async function askStudent(
  cfg: GeminiConfig,
  input: { audioBase64: string; mimeType: string; history: PastTurn[]; notes?: string; topic?: string },
): Promise<StudentReply> {
  // Earlier turns go back as text (the transcript Gemini returned last time),
  // so each call only pays for the new audio.
  const contents = input.history.map((t) => ({
    role: t.speaker === "learner" ? "user" : "model",
    parts: [{ text: t.speaker === "learner" ? t.text : JSON.stringify({ question: t.text }) }],
  }));
  contents.push({
    role: "user",
    parts: [{ inline_data: { mime_type: input.mimeType, data: input.audioBase64 } } as never],
  });

  const topicLine = input.topic ? `\n\nThe topic they are explaining: ${input.topic}` : "";
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.8,
    maxOutputTokens: 1024,
  };
  if (cfg.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: cfg.thinkingLevel };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const res = await (cfg.fetchImpl ?? fetch)(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: STUDENT_SYSTEM_PROMPT + topicLine + notesBlock(input.notes) }] },
      contents,
      generationConfig,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new GeminiError(res.status, detail.slice(0, 500));
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    usageMetadata?: GeminiUsage;
  };
  const text = body.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
  let parsed: { transcript?: string; question?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { transcript: "", question: text.trim() };
  }
  return {
    transcript: (parsed.transcript ?? "").trim(),
    question: (parsed.question ?? "").trim() || "Sorry, could you say that again?",
    usage: body.usageMetadata ?? {},
  };
}

export class GeminiError extends Error {
  constructor(public status: number, public detail: string) {
    super(`Gemini returned ${status}`);
  }
}
