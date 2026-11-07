import { describe, expect, it } from "vitest";
import { handleReadPage } from "../src/readPage";

const post = (body: object, auth?: string) =>
  new Request("https://x/api/read-page", { method: "POST", body: JSON.stringify(body), headers: auth ? { authorization: auth } : {} });

function openai(content: object, usage = { prompt_tokens: 1200, completion_tokens: 400 }) {
  const calls: { url: string; body: any }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }], usage }));
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("POST /api/read-page", () => {
  it("sends the photo to the vision model and returns the page text and a title", async () => {
    const { f, calls } = openai({ title: "Enzyme kinetics", text: "# Enzymes\n- Vmax = top speed", readable: true });
    const res = await handleReadPage(post({ image: "data:image/jpeg;base64,QUJD", topic: "Biochem" }), { OPENAI_API_KEY: "k" }, f);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.title).toBe("Enzyme kinetics");
    expect(j.text).toContain("Vmax");
    expect(j.readable).toBe(true);
    expect(j.cost.pence).toBeGreaterThan(0);
    expect(j.cost.pence).toBeLessThan(1);
    const img = calls[0].body.messages[1].content[0].image_url.url;
    expect(img).toBe("data:image/jpeg;base64,QUJD");
    expect(calls[0].body.messages[0].content).toContain("Biochem");
    expect(calls[0].body.model).toBe("gpt-5.4-mini");
  });

  it("drops the text when the page can't be read", async () => {
    const { f } = openai({ title: "", text: "blurry", readable: false });
    const j = await (await handleReadPage(post({ image: "QUJD" }), { OPENAI_API_KEY: "k" }, f)).json();
    expect(j).toMatchObject({ readable: false, text: "" });
  });

  it("checks the token, the image and the key", async () => {
    expect((await handleReadPage(post({ image: "QUJD" }), { PROTOTYPE_TOKEN: "t", OPENAI_API_KEY: "k" })).status).toBe(401);
    expect((await handleReadPage(post({}), { OPENAI_API_KEY: "k" })).status).toBe(400);
    expect((await handleReadPage(post({ image: "x".repeat(4_000_001) }), { OPENAI_API_KEY: "k" })).status).toBe(413);
    expect((await handleReadPage(post({ image: "QUJD" }), {})).status).toBe(500);
  });
});
