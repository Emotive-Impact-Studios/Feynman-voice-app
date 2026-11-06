import { describe, expect, it } from "vitest";
import { checkLook, handleLook, userText } from "../src/look";

const post = (body: object) => new Request("https://x/api/look", { method: "POST", body: JSON.stringify(body) });

const reply = (content: object) =>
  (async (_u: string, init: RequestInit) => {
    (reply as { last?: unknown }).last = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 400, completion_tokens: 120 } }));
  }) as unknown as typeof fetch;

describe("POST /api/look", () => {
  it("names the thing and returns Fenny's questions, sending the photo and subjects", async () => {
    const f = reply({
      thing: "bike chain",
      clear: true,
      retry: "",
      reaction: "Ooh, a bike chain!",
      angles: [
        { subject: "Engineering", question: "How does pushing a pedal end up turning the back wheel?", topic: "How a bike chain drives the wheel" },
        { subject: "everyday", question: "Why do the gears make it easier or harder?", topic: "Bike gears" },
      ],
    });
    const res = await handleLook(post({ image: "AAAA", subjects: ["Engineering", 3] }), { OPENAI_API_KEY: "k" }, f);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.look.thing).toBe("bike chain");
    expect(j.look.angles).toHaveLength(2);
    expect(j.cost.usd).toBeGreaterThan(0);
    const sent = (reply as { last?: { messages: { content: unknown }[] } }).last!;
    const user = sent.messages[1].content as { type: string; text?: string; image_url?: { url: string } }[];
    expect(user[0].text).toContain("Engineering");
    expect(user[1].image_url?.url).toBe("data:image/jpeg;base64,AAAA");
  });

  it("checks the request", async () => {
    expect((await handleLook(post({}), { OPENAI_API_KEY: "k" })).status).toBe(400);
    expect((await handleLook(post({ image: "A" }), { PROTOTYPE_TOKEN: "t", OPENAI_API_KEY: "k" })).status).toBe(401);
    expect((await handleLook(post({ image: "A".repeat(4_000_001) }), { OPENAI_API_KEY: "k" })).status).toBe(413);
    expect((await handleLook(post({ image: "A" }), {})).status).toBe(500);
  });

  it("says when the model fails, without leaking detail", async () => {
    const f = (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    const res = await handleLook(post({ image: "A" }), { OPENAI_API_KEY: "k" }, f);
    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toContain("boom");
  });
});

describe("checkLook", () => {
  it("treats a clear photo with no usable angles as unclear and gives a retry line", () => {
    const l = checkLook({ thing: "x", clear: true, retry: "", reaction: "", angles: [{ subject: "", question: "", topic: "" }] });
    expect(l.clear).toBe(false);
    expect(l.retry).toMatch(/try again/i);
    expect(l.angles).toEqual([]);
  });

  it("keeps at most three angles and takes dashes out", () => {
    const a = { subject: "", question: "What makes it spin — and why?", topic: "Spinning" };
    const l = checkLook({ thing: "top", clear: true, retry: "", reaction: "Ooh – a top!", angles: [a, a, a, a] });
    expect(l.angles).toHaveLength(3);
    expect(l.angles[0].subject).toBe("everyday");
    expect(l.angles[0].question).toBe("What makes it spin, and why?");
    expect(l.reaction).not.toMatch(/[—–]/);
  });
});

describe("subjects", () => {
  it("uses the learner's own spelling of a subject", () => {
    const l = checkLook({ thing: "bike", clear: true, retry: "", reaction: "", angles: [{ subject: "engineering", question: "How?", topic: "Bikes" }] }, ["Engineering"]);
    expect(l.angles[0].subject).toBe("Engineering");
  });
});

describe("userText", () => {
  it("passes an on-device guess as a hint, not a fact", () => {
    expect(userText([], "kettle")).toContain("may be wrong");
    expect(userText(["Biology"])).toContain("Biology");
  });
});
