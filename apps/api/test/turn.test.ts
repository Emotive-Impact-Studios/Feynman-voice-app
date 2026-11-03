import { describe, expect, it, vi } from "vitest";
import { encodeWav } from "@feynman/kitten-tts";
import { costOf, pricesFromEnv, wavSeconds } from "../src/pricing";
import { handleTurn } from "../src/turn";

const env = { BRAIN: "gemini", GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-test", PROTOTYPE_TOKEN: "t" };
const openaiEnv = { BRAIN: "openai", OPENAI_API_KEY: "k", PROTOTYPE_TOKEN: "t" };

function geminiOk(payload: object, usage: object) {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
        usageMetadata: usage,
      }),
      { status: 200 },
    ),
  );
}

function turnRequest(body: object, token = "t") {
  return new Request("http://x/api/turn", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const audio = { audioBase64: Buffer.from("fake").toString("base64"), mimeType: "audio/wav", audioSeconds: 30 };

describe("pricing", () => {
  it("splits audio and text input and bills thinking as output", () => {
    const cost = costOf(
      {
        promptTokenCount: 1500,
        candidatesTokenCount: 50,
        thoughtsTokenCount: 50,
        promptTokensDetails: [
          { modality: "AUDIO", tokenCount: 1000 },
          { modality: "TEXT", tokenCount: 500 },
        ],
      },
      { inTextPerM: 1, inAudioPerM: 2, outPerM: 10, gbpPerUsd: 0.5 },
    );
    expect(cost.audioInTokens).toBe(1000);
    expect(cost.textInTokens).toBe(500);
    expect(cost.outTokens).toBe(100);
    expect(cost.usd).toBeCloseTo((1000 * 2 + 500 * 1 + 100 * 10) / 1e6);
    expect(cost.pence).toBeCloseTo(cost.usd * 50);
  });

  it("falls back to the brief's prices", () => {
    expect(pricesFromEnv({})).toMatchObject({ inTextPerM: 0.75, outPerM: 3.75 });
  });
});

describe("POST /api/turn", () => {
  it("rejects a missing token", async () => {
    const res = await handleTurn(turnRequest(audio, "wrong"), env);
    expect(res.status).toBe(401);
  });

  it("rejects unsupported audio", async () => {
    const res = await handleTurn(turnRequest({ ...audio, mimeType: "video/mp4" }), env);
    expect(res.status).toBe(400);
  });

  it("returns the question, phonemes for the phone and the cost", async () => {
    const fetchImpl = geminiOk(
      { transcript: "The heart pumps blood round the body.", question: "What makes it pump?" },
      { promptTokenCount: 1200, candidatesTokenCount: 30, promptTokensDetails: [{ modality: "AUDIO", tokenCount: 960 }] },
    );
    const res = await handleTurn(turnRequest({ ...audio, history: [{ speaker: "learner", text: "Hi" }] }), env, fetchImpl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.question).toBe("What makes it pump?");
    expect(body.transcript).toContain("heart");
    expect(body.speech[0].text).toBe("What makes it pump?");
    expect(body.speech[0].phonemes).toMatch(/pˈʌmp\?$/);
    expect(body.cost.pencePerLearnerMinute).toBeGreaterThan(0);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("models/gemini-test:generateContent");
    const sent = JSON.parse(init.body as string);
    expect(sent.contents).toHaveLength(2);
    expect(sent.contents[1].parts[0].inline_data.mime_type).toBe("audio/wav");
    expect(sent.systemInstruction.parts[0].text).toContain("Never explain the answer");
  });

  it("passes Gemini errors back as 502", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad model", { status: 404 }));
    const res = await handleTurn(turnRequest(audio), env, fetchImpl);
    expect(res.status).toBe(502);
    expect((await res.json()).detail).toBe("bad model");
  });
});

describe("POST /api/turn with OpenAI", () => {
  it("transcribes, asks, and prices both calls", async () => {
    const wav = encodeWav(new Float32Array(16000 * 30), 16000); // 30 s
    expect(wavSeconds(wav)).toBeCloseTo(30);
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/audio/transcriptions")) {
        return new Response(JSON.stringify({ text: "The heart pumps blood." }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ question: "What makes it pump?" }) } }],
          usage: { prompt_tokens: 1000, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 400 } },
        }),
        { status: 200 },
      );
    });
    const res = await handleTurn(
      turnRequest({ audioBase64: Buffer.from(wav).toString("base64"), mimeType: "audio/wav", audioSeconds: 20 }),
      openaiEnv,
      fetchImpl as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transcript).toBe("The heart pumps blood.");
    expect(body.question).toBe("What makes it pump?");
    expect(body.recordedSeconds).toBeCloseTo(30);
    // Transcription: 0.5 min x $0.003. Chat: 600 x 0.75 + 400 x 0.075 + 20 x 4.5, per million.
    expect(body.cost.usd).toBeCloseTo(0.0015 + (600 * 0.75 + 400 * 0.075 + 20 * 4.5) / 1e6, 8);
    expect(body.cost.pencePerLearnerMinute).toBeCloseTo(body.cost.pence / (20 / 60));

    const chat = JSON.parse((fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    expect(chat.model).toBe("gpt-5.4-mini");
    expect(chat.messages.at(-1)).toEqual({ role: "user", content: "The heart pumps blood." });
    expect(chat.messages[0].content).not.toContain("faithful transcript");
  });

  it("needs an OpenAI key", async () => {
    const res = await handleTurn(turnRequest(audio), { BRAIN: "openai", PROTOTYPE_TOKEN: "t" });
    expect(res.status).toBe(500);
  });
});
