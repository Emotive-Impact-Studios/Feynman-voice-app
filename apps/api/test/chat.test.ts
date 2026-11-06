import { describe, expect, it } from "vitest";
import { chatJSON } from "../src/engine/chat";
import { chatPricesFor } from "../src/pricing";

describe("chatJSON on Claude", () => {
  it("sends a system prompt and alternating turns, and returns usage in OpenAI's shape", async () => {
    let sent: { model: string; system: { text: string }[]; messages: { role: string; content: string }[]; fallbacks?: string; output_config: { effort: string } } | undefined;
    const f = (async (_u: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          id: "m", type: "message", role: "assistant", model: sent!.model, stop_reason: "end_turn",
          content: [{ type: "text", text: '{"say":"Why does it?"}' }],
          usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 900 },
        }),
        { headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const r = await chatJSON<{ say: string }>(
      { apiKey: "o", anthropicKey: "a", model: "claude-haiku-5-5", reasoningEffort: "none", fetchImpl: f },
      [
        { role: "developer", content: "Be Fenny." },
        { role: "user", content: "one" },
        { role: "user", content: "two" },
        { role: "assistant", content: "ok" },
        { role: "user", content: "three" },
      ],
      { name: "x", schema: { type: "object" } },
    );
    expect(r.value.say).toBe("Why does it?");
    expect(sent!.system[0].text).toBe("Be Fenny.");
    expect(sent!.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(sent!.messages[0].content).toBe("one\n\ntwo");
    expect(sent!.output_config.effort).toBe("low");
    expect(sent!.fallbacks).toBeUndefined();
    expect(r.usage).toEqual({ prompt_tokens: 1000, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 900 } });
  });

  it("prices Claude models and keeps OpenAI prices for the rest", () => {
    expect(chatPricesFor("claude-haiku-5-5", {}).chatOutPerM).toBe(0.5);
    expect(chatPricesFor("gpt-5.4-mini", {}).chatOutPerM).toBe(4.5);
  });
});
