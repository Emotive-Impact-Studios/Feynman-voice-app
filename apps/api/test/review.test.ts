import { describe, expect, it, vi } from "vitest";
import { handleAnalyse, handleShowMe, shapeAnalysis, transcriptText } from "../src/review";

const env = { OPENAI_API_KEY: "k", PROTOTYPE_TOKEN: "t" };

function request(path: string, body: object, token = "t") {
  return new Request(`http://x${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function chatReply(content: object) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 2000, completion_tokens: 300 } }),
    { status: 200 },
  );
}

const turns = [
  { speaker: "student" as const, text: "Which bit do you think will be hardest?" },
  { speaker: "learner" as const, text: "Probably Km. An inhibitor is like a fake key that sits in the lock so the real key can't get in." },
  { speaker: "student" as const, text: "So what are the doors?" },
  { speaker: "learner" as const, text: "It binds weakly, so it can come off again." },
];

describe("POST /api/analyse", () => {
  it("rejects a wrong token", async () => {
    const res = await handleAnalyse(request("/api/analyse", { topic: "x", turns }, "nope"), env);
    expect(res.status).toBe(401);
  });

  it("needs something said", async () => {
    const res = await handleAnalyse(request("/api/analyse", { topic: "x", turns: [turns[0]] }), env, vi.fn());
    expect(res.status).toBe(400);
  });

  it("puts the learner's own gap first, in their words", async () => {
    const fetchImpl = vi.fn(async () =>
      chatReply({
        strengths: [{ title: "What an inhibitor does", quote: "like a fake key that sits in the lock" }],
        gaps: [
          { kind: "gap", title: 'You said it "binds weakly", but not why.', detail: "What holds it there?", source: "", named: true },
          { kind: "skipped", title: "Non-competitive inhibition never came up.", detail: "Your goal mentions both kinds.", source: "", named: false },
        ],
        shakiestDetail: "You said Km would be hardest and then didn't come back to it.",
        thenAndNow: null,
      }),
    );
    const res = await handleAnalyse(request("/api/analyse", { topic: "Enzyme inhibition", turns, shakiest: "Km, honestly" }), env, fetchImpl as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.strengths[0].quote).toBe("like a fake key that sits in the lock");
    expect(body.gaps[0]).toMatchObject({ title: "Km, honestly", named: true });
    expect(body.gaps[1].named).toBe(false);
    expect(body.gaps).toHaveLength(3);
    expect(body.pence).toBeGreaterThan(0);

    const sent = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.response_format.json_schema.strict).toBe(true);
    expect(sent.messages[1].content).toContain("Km, honestly");
    expect(sent.messages[1].content).toContain("LEARNER: It binds weakly");
    expect(sent.messages[1].content).toContain("have not added notes");
  });

  it("passes provider errors on as 502", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429 }));
    const res = await handleAnalyse(request("/api/analyse", { topic: "x", turns }), env, fetchImpl as never);
    expect(res.status).toBe(502);
  });
});

describe("POST /api/show-me", () => {
  it("explains from the notes when there are notes", async () => {
    const fetchImpl = vi.fn(async () => chatReply({ explanation: "It is held by non-covalent bonds, so it can let go.", coveredByNotes: true }));
    const res = await handleShowMe(
      request("/api/show-me", { topic: "Enzyme inhibition", gap: { title: "Why it binds weakly" }, notes: "Held by non-covalent bonds." }),
      env,
      fetchImpl as never,
    );
    const body = await res.json();
    expect(body).toMatchObject({ fromNotes: true });
    expect(body.explanation).toContain("non-covalent");
  });

  it("says when it is not from their notes", async () => {
    const fetchImpl = vi.fn(async () => chatReply({ explanation: "A general explanation.", coveredByNotes: true }));
    const res = await handleShowMe(request("/api/show-me", { topic: "x", gap: { title: "y" } }), env, fetchImpl as never);
    expect((await res.json()).fromNotes).toBe(false);
  });

  it("needs a gap title", async () => {
    const res = await handleShowMe(request("/api/show-me", { topic: "x", gap: {} }), env, vi.fn() as never);
    expect(res.status).toBe(400);
  });
});

describe("shaping", () => {
  it("drops empty items and keeps at most four gaps", () => {
    const g = { kind: "gap" as const, title: "a", detail: "", source: "", named: false, correction: "stray" };
    const out = shapeAnalysis({ strengths: [{ title: "", quote: "x" }], gaps: [g, g, g, g, g, { ...g, title: " " }], thenAndNow: { then: "", now: "x" } }, undefined);
    expect(out.strengths).toHaveLength(0);
    expect(out.gaps).toHaveLength(4);
    expect(out.gaps[0].correction).toBe("");
    expect(out.thenAndNow).toBeNull();
  });

  it("takes off quote marks the model added", () => {
    const out = shapeAnalysis({ strengths: [{ title: "a", quote: '"like a fake key"' }], gaps: [], thenAndNow: { then: "\u201Cit blocks it\u201D", now: "'a fake key'" } }, undefined);
    expect(out.strengths[0].quote).toBe("like a fake key");
    expect(out.thenAndNow).toEqual({ then: "it blocks it", now: "a fake key" });
  });

  it("labels speakers and keeps the end of a long call", () => {
    const long = Array.from({ length: 2000 }, (_, i) => ({ speaker: "learner" as const, text: `line ${i} ${"word ".repeat(5)}` }));
    const t = transcriptText(long);
    expect(t.length).toBeLessThan(24_100);
    expect(t).toContain("line 1999");
    expect(transcriptText(turns)).toMatch(/^FENNY: /);
  });
});
