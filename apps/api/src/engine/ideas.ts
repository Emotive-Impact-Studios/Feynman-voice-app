// Key ideas for a topic: the short checklist a good explanation needs. Real
// tutors hold one of these and only nudge on what is missing (Graesser's
// expectation-tailored dialogue). Built once per topic and kept in memory.
import { chatJSON, type ChatCfg } from "./chat";

export interface KeyIdea {
  id: string;
  idea: string;
}

const cache = new Map<string, KeyIdea[]>();

export async function keyIdeas(cfg: ChatCfg, topic: string, notes?: string): Promise<KeyIdea[]> {
  const key = `${topic.trim().toLowerCase()}|${(notes ?? "").length}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = await chatJSON<{ ideas: { idea: string }[] }>(
    cfg,
    [
      {
        role: "developer",
        content:
          "List the 4 to 7 key ideas a university student must say to explain this topic properly, in the order a good explanation would reach them. Each is one short plain sentence, no jargon left unexplained. " +
          (notes?.trim() ? "Base them on the student's own notes below.\n<notes>\n" + notes.trim() + "\n</notes>" : "Use standard first-year university understanding."),
      },
      { role: "user", content: `Topic: ${topic}` },
    ],
    {
      name: "key_ideas",
      schema: {
        type: "object",
        properties: { ideas: { type: "array", items: { type: "object", properties: { idea: { type: "string" } }, required: ["idea"], additionalProperties: false } } },
        required: ["ideas"],
        additionalProperties: false,
      },
    },
  );
  const ideas = r.value.ideas.slice(0, 7).map((x, i) => ({ id: `k${i + 1}`, idea: x.idea }));
  if (cache.size > 500) cache.clear();
  cache.set(key, ideas);
  return ideas;
}
