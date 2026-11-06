// A small JSON chat call, shared by the engine's pieces. OpenAI by default;
// a model name starting "claude-" goes to Anthropic instead (needs anthropicKey).
import Anthropic from "@anthropic-ai/sdk";

export interface ChatCfg {
  apiKey: string;
  /** Needed when model is a Claude model. */
  anthropicKey?: string;
  model: string;
  reasoningEffort?: string;
  fetchImpl?: typeof fetch;
}

export interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

export async function chatJSON<T>(
  cfg: ChatCfg,
  messages: { role: string; content: string }[],
  schema: { name: string; schema: object },
  maxTokens = 600,
): Promise<{ value: T; usage: ChatUsage }> {
  if (cfg.model.startsWith("claude-")) return claudeJSON<T>(cfg, messages, schema, maxTokens);
  const f = cfg.fetchImpl ?? fetch;
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    max_completion_tokens: maxTokens,
    response_format: { type: "json_schema", json_schema: { name: schema.name, strict: true, schema: schema.schema } },
  };
  if (cfg.reasoningEffort) body.reasoning_effort = cfg.reasoningEffort;
  const res = await f("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { choices: { message: { content: string } }[]; usage?: ChatUsage };
  return { value: JSON.parse(j.choices[0].message.content) as T, usage: j.usage ?? {} };
}

const clients = new Map<string, Anthropic>();

/** The same call on Claude: structured output, low effort for speed, usage in OpenAI's shape. */
async function claudeJSON<T>(
  cfg: ChatCfg,
  messages: { role: string; content: string }[],
  schema: { name: string; schema: object },
  maxTokens: number,
): Promise<{ value: T; usage: ChatUsage }> {
  if (!cfg.anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set on the server");
  const id = cfg.anthropicKey + (cfg.fetchImpl ? "+f" : "");
  let client = clients.get(id);
  if (!client) {
    client = new Anthropic({ apiKey: cfg.anthropicKey, maxRetries: 1, ...(cfg.fetchImpl ? { fetch: cfg.fetchImpl } : {}) });
    clients.set(id, client);
  }
  const system = messages.filter((m) => m.role === "developer" || m.role === "system").map((m) => m.content).join("\n\n");
  // Claude wants turns to alternate and to end on the user, so neighbours with the same role are joined.
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (m.role === "developer" || m.role === "system") continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    const last = turns[turns.length - 1];
    if (last?.role === role) last.content += "\n\n" + m.content;
    else turns.push({ role, content: m.content });
  }
  if (!turns.length || turns[turns.length - 1].role !== "user") turns.push({ role: "user", content: "(go on)" });
  const effort = cfg.reasoningEffort === "high" || cfg.reasoningEffort === "medium" ? cfg.reasoningEffort : "low";
  const fallback = !cfg.model.startsWith("claude-haiku");
  const r = await client.beta.messages.create({
    model: cfg.model,
    // Thinking tokens count towards this, so leave room above the answer.
    max_tokens: maxTokens + 2000,
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { effort, format: { type: "json_schema", schema: schema.schema as { [k: string]: unknown } } },
    messages: turns,
  });
  if (r.stop_reason === "refusal") throw new Error(`${cfg.model} declined`);
  const text = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const u = r.usage;
  const cached = u.cache_read_input_tokens ?? 0;
  return {
    value: JSON.parse(text) as T,
    usage: {
      prompt_tokens: (u.input_tokens ?? 0) + cached + (u.cache_creation_input_tokens ?? 0),
      completion_tokens: u.output_tokens,
      prompt_tokens_details: { cached_tokens: cached },
    },
  };
}
