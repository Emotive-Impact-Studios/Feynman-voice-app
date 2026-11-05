// A small JSON chat call to OpenAI, shared by the engine's pieces.
export interface ChatCfg {
  apiKey: string;
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
