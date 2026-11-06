import { describe, expect, it, vi } from "vitest";
import { encodeWav } from "@feynman/kitten-tts";
import { handleLiveTurn, sttProvider } from "../src/live";
import { SentenceSplitter } from "../src/sentences";

const wav = encodeWav(new Float32Array(16000 * 2), 16000); // two seconds of silence
const audio = { audioBase64: Buffer.from(wav).toString("base64"), mimeType: "audio/wav", audioSeconds: 2 };

function request(body: object, token = "t") {
  return new Request("http://x/api/live-turn", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** An OpenAI chat stream that sends `pieces` one SSE event at a time. */
function chatStream(pieces: string[], usage = { prompt_tokens: 400, completion_tokens: 20 }) {
  const events = [
    ...pieces.map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`),
    `data: ${JSON.stringify({ choices: [], usage })}\n\n`,
    "data: [DONE]\n\n",
  ];
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        // Split one event across two reads to check the line buffering.
        const all = events.join("");
        c.enqueue(enc.encode(all.slice(0, 37)));
        c.enqueue(enc.encode(all.slice(37)));
        c.close();
      },
    }),
    { status: 200 },
  );
}

async function events(res: Response) {
  const text = await res.text();
  return text
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
}

describe("SentenceSplitter", () => {
  it("releases whole sentences as text streams in", () => {
    const s = new SentenceSplitter();
    expect(s.push("Wait, what does ")).toEqual([]);
    expect(s.push("osmosis mean? And why does")).toEqual(["Wait, what does osmosis mean?"]);
    expect(s.push(" water move at all?")).toEqual([]);
    expect(s.flush()).toEqual(["And why does water move at all?"]);
  });

  it("joins very short sentences to the next one", () => {
    const s = new SentenceSplitter();
    expect(s.push("Oh. So the cell just lets it in? ")).toEqual(["Oh. So the cell just lets it in?"]);
  });
});

describe("sttProvider", () => {
  it("uses Cartesia once a key is set, unless told otherwise", () => {
    expect(sttProvider({})).toBe("openai");
    expect(sttProvider({ CARTESIA_API_KEY: "c" })).toBe("cartesia");
    expect(sttProvider({ CARTESIA_API_KEY: "c", STT: "openai" })).toBe("openai");
  });
});

describe("POST /api/live-turn", () => {
  const env = { BRAIN: "openai", OPENAI_API_KEY: "k", PROTOTYPE_TOKEN: "t", FENNY_ENGINE: "off" };

  it("rejects a missing token", async () => {
    const res = await handleLiveTurn(request(audio, "wrong"), env);
    expect(res.status).toBe(401);
  });

  it("refuses Sonic without a Cartesia key", async () => {
    const res = await handleLiveTurn(request({ ...audio, voice: "sonic" }), env);
    expect(res.status).toBe(400);
  });

  it("streams the transcript, each sentence, then the cost (Phonon on the phone)", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/audio/transcriptions")) return Response.json({ text: "Osmosis is water moving." });
      return chatStream(["Moving where", ", exactly? ", "And what makes it ", "move?"]);
    }) as unknown as typeof fetch;
    const res = await handleLiveTurn(request({ ...audio, topic: "Osmosis" }), env, fetchImpl);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson");
    const ev = await events(res);
    expect(ev.map((e) => e.type)).toEqual(["transcript", "sentence", "sentence", "done"]);
    expect(ev[0].text).toBe("Osmosis is water moving.");
    expect(ev[1]).toEqual({ type: "sentence", index: 0, text: "Moving where, exactly?" });
    expect(ev[2].text).toBe("And what makes it move?");
    const done = ev[3];
    expect(done.question).toBe("Moving where, exactly? And what makes it move?");
    expect(done.stt).toBe("openai");
    expect(done.cost.lines).toHaveLength(2);
    expect(done.cost.pence).toBeGreaterThan(0);

    const chat = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1].body);
    expect(chat.stream).toBe(true);
    expect(chat.messages[0].content).toContain("Osmosis");
    expect(chat.messages[0].content).not.toContain("transcript of what the student said");
  });

  it("runs the engine by default and streams its move and cost", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith("/audio/transcriptions")) return Response.json({ text: "Osmosis is water moving across a membrane." });
      const b = JSON.parse(String(init!.body));
      const reply =
        b.response_format.json_schema.name === "key_ideas"
          ? { ideas: [{ idea: "Water moves from dilute to concentrated" }, { idea: "The membrane lets water through" }] }
          : { move: "next", say: "Ooh, so which way does the water go?", covered: ["k2"], stuck_on: "" };
      return Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }], usage: { prompt_tokens: 300, completion_tokens: 20 } });
    }) as unknown as typeof fetch;
    const res = await handleLiveTurn(request({ ...audio, topic: "Osmosis engine test" }), { ...env, FENNY_ENGINE: undefined }, fetchImpl);
    const ev = await events(res);
    expect(ev.map((e) => e.type)).toEqual(["transcript", "engine", "sentence", "done"]);
    expect(ev[1]).toMatchObject({ type: "engine", move: "next", covered: ["k2"] });
    expect(ev[2].text).toBe("Ooh, so which way does the water go?");
    // Speech to text, the key ideas (first turn on this topic) and the turn.
    expect(ev[3].cost.lines).toHaveLength(3);
  });

  it("never sends a dash to the voice, even if the model writes one", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith("/audio/transcriptions")) return Response.json({ text: "Osmosis is water moving." });
      const b = JSON.parse(String(init!.body));
      const reply =
        b.response_format.json_schema.name === "key_ideas"
          ? { ideas: [{ idea: "Water moves from dilute to concentrated" }] }
          : { move: "next", say: "Ooh — so which way does the water go?", covered: [], stuck_on: "" };
      return Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }], usage: { prompt_tokens: 300, completion_tokens: 20 } });
    }) as unknown as typeof fetch;
    const res = await handleLiveTurn(request({ ...audio, topic: "Osmosis dash test" }), { ...env, FENNY_ENGINE: undefined }, fetchImpl);
    const ev = await events(res);
    const sentence = ev.find((e) => e.type === "sentence")!;
    expect(sentence.text).toBe("Ooh, so which way does the water go?");
    expect(ev.find((e) => e.type === "done")!.question).toBe("Ooh, so which way does the water go?");
  });

  it("holds the turn when the learner stops mid-thought and the phone can wait", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith("/audio/transcriptions")) return Response.json({ text: "Osmosis is when water moves and." });
      const b = JSON.parse(String(init!.body));
      expect(b.response_format.json_schema.name).toBe("key_ideas");
      return Response.json({ choices: [{ message: { content: JSON.stringify({ ideas: [{ idea: "Water moves" }] }) } }], usage: { prompt_tokens: 300, completion_tokens: 20 } });
    }) as unknown as typeof fetch;
    const res = await handleLiveTurn(request({ ...audio, topic: "Osmosis wait test", features: ["wait"] }), { ...env, FENNY_ENGINE: undefined }, fetchImpl);
    const ev = await events(res);
    expect(ev.map((e) => e.type)).toEqual(["transcript", "engine", "done"]);
    expect(ev[1]).toEqual({ type: "engine", move: "wait" });
    expect(ev[2].question).toBe("");
    // Speech to text and the key ideas, but no turn.
    expect(ev[2].cost.lines).toHaveLength(2);
  });

  it("says a short 'Go on.' to phones that cannot wait yet", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/audio/transcriptions")) return Response.json({ text: "So the membrane is, um" });
      return Response.json({ choices: [{ message: { content: JSON.stringify({ ideas: [{ idea: "Water moves" }] }) } }], usage: { prompt_tokens: 300, completion_tokens: 20 } });
    }) as unknown as typeof fetch;
    const res = await handleLiveTurn(request({ ...audio, topic: "Osmosis go on test" }), { ...env, FENNY_ENGINE: undefined }, fetchImpl);
    const ev = await events(res);
    expect(ev.find((e) => e.type === "sentence")!.text).toBe("Go on.");
    expect(ev.find((e) => e.type === "engine")!.move).toBe("listen");
    expect(ev.find((e) => e.type === "done")!.question).toBe("Go on.");
  });

  it("hears with Ink and speaks with Sonic when Cartesia is set up", async () => {
    const pcm = new Uint8Array([1, 0, 2, 0]);
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith("/stt")) {
        expect((init!.headers as Record<string, string>)["cartesia-version"]).toBe("2026-08-14");
        return Response.json({ type: "transcript", text: "It is about pressure." });
      }
      if (u.endsWith("/tts/bytes")) {
        const b = JSON.parse(String(init!.body));
        expect(b.model_id).toBe("sonic-3.6");
        expect(b.output_format).toEqual({ container: "raw", encoding: "pcm_s16le", sample_rate: 24000 });
        expect(b.generation_config).toEqual({ speed: 1 });
        return new Response(pcm, { status: 200 });
      }
      return chatStream(["Pressure from what, though?"]);
    }) as unknown as typeof fetch;
    const res = await handleLiveTurn(request({ ...audio, voice: "sonic" }), { ...env, CARTESIA_API_KEY: "c" }, fetchImpl);
    const ev = await events(res);
    expect(ev.map((e) => e.type)).toEqual(["transcript", "sentence", "done"]);
    expect(ev[1].audio).toBe(Buffer.from(pcm).toString("base64"));
    expect(ev[1].sampleRate).toBe(24000);
    expect(ev[2].stt).toBe("cartesia");
    expect(ev[2].cost.lines.map((l: { label: string }) => l.label)).toEqual([
      "Cartesia Ink (2.0s audio)",
      "gpt-5.4-mini (400 in, 0 cached, 20 out)",
      "Cartesia Sonic (27 characters)",
    ]);
    expect(calls.some((c) => c.endsWith("/audio/transcriptions"))).toBe(false);
  });

  it("sends an error event if a provider fails mid-turn", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/audio/transcriptions")) return Response.json({ text: "Hello." });
      return new Response("rate limited", { status: 429 });
    }) as unknown as typeof fetch;
    const ev = await events(await handleLiveTurn(request(audio), env, fetchImpl));
    expect(ev.at(-1)).toMatchObject({ type: "error", error: "OpenAI chat returned 429" });
  });
});
