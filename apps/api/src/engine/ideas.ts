// Key ideas for a topic: the short checklist a good explanation needs. Real
// tutors hold one of these and only nudge on what is missing (Graesser's
// expectation-tailored dialogue). Built once per topic and kept in memory.
import { createHash } from "node:crypto";
import { chatJSON, type ChatCfg, type ChatUsage } from "./chat";

export interface KeyIdea {
  id: string;
  idea: string;
  /**
   * A short name for the idea that doesn't give it away ("why the heart has
   * valves"), so Fenny can say up front what it hopes to understand and the
   * phone can show progress.
   */
  label: string;
}

const cache = new Map<string, KeyIdea[]>();

/**
 * The key ideas, plus the model usage when they had to be built (undefined on a
 * cache hit, so the cost is only counted once). Keyed by the full notes text, so
 * one learner's notes never shape another learner's ideas.
 */
export async function keyIdeas(cfg: ChatCfg, topic: string, notes?: string): Promise<{ ideas: KeyIdea[]; usage?: ChatUsage }> {
  const key = createHash("sha256").update(topic.trim().toLowerCase()).update("\0").update(notes?.trim() ?? "").digest("hex");
  const hit = cache.get(key);
  if (hit) return { ideas: hit };
  const r = await chatJSON<{ ideas: { idea: string; label: string }[] }>(
    cfg,
    [
      {
        role: "developer",
        content:
          "List the 3 or 4 key ideas a university student must say to explain this topic properly, in the order a good explanation would reach them. Each idea is one short plain sentence, no jargon left unexplained. Each also gets a label: 2 to 6 plain words naming what the idea is about without giving the answer away, written so it fits after \"I want to understand\", for example \"why the heart has valves\" or \"where the energy comes from\". " +
          (notes?.trim() ? "Base them on the student's own notes below.\n<notes>\n" + notes.trim() + "\n</notes>" : "Use standard first-year university understanding."),
      },
      { role: "user", content: `Topic: ${topic}` },
    ],
    {
      name: "key_ideas",
      schema: {
        type: "object",
        properties: { ideas: { type: "array", items: { type: "object", properties: { idea: { type: "string" }, label: { type: "string" } }, required: ["idea", "label"], additionalProperties: false } } },
        required: ["ideas"],
        additionalProperties: false,
      },
    },
  );
  const ideas = r.value.ideas.slice(0, 4).map((x, i) => ({ id: `k${i + 1}`, idea: x.idea, label: x.label?.trim() || x.idea }));
  if (cache.size > 500) cache.clear();
  cache.set(key, ideas);
  return { ideas, usage: r.usage };
}
