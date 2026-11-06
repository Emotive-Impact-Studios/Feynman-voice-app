import { describe, expect, it } from "vitest";
import { handleSpeak } from "../src/speak";

const post = (body: object) => new Request("https://x/api/speak", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/speak", () => {
  it("returns Sonic audio for a line, cleaned for the voice", async () => {
    let sent: { transcript?: string } = {};
    const f = (async (_u: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string);
      return new Response(new Uint8Array([1, 0, 2, 0]));
    }) as unknown as typeof fetch;
    const res = await handleSpeak(post({ text: "Explain it — as if I know nothing.", voice: "sonic" }), { CARTESIA_API_KEY: "c" }, f);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.audio).toBe(Buffer.from([1, 0, 2, 0]).toString("base64"));
    expect(j.sampleRate).toBeGreaterThan(0);
    expect(sent.transcript).not.toContain("—");
  });

  it("gives Phonon just the clean line", async () => {
    const res = await handleSpeak(post({ text: "Hello there.", voice: "phonon" }), {});
    expect(await res.json()).toEqual({ text: "Hello there." });
  });

  it("needs text and the prototype token", async () => {
    expect((await handleSpeak(post({ text: " " }), {})).status).toBe(400);
    expect((await handleSpeak(post({ text: "Hi" }), { PROTOTYPE_TOKEN: "t" })).status).toBe(401);
  });
});
