// Conversation test: simulated learners talk to Fenny, and a judge scores
// every Fenny line. Run before any change to how Fenny talks ships:
//   OPENAI_API_KEY=... npx tsx scripts/converse-test.ts [old|engine|both] [turns]
import { chatJSON, type ChatCfg } from "../src/engine/chat";
import { engineTurn } from "../src/engine/engine";
import { keyIdeas } from "../src/engine/ideas";
import { isVague, PROBES, moveOf } from "../src/engine/policy";
import { liveSystemPrompt } from "../src/live";
import type { PastTurn } from "../src/gemini";

const cfg: ChatCfg = { apiKey: process.env.OPENAI_API_KEY!, model: process.env.OPENAI_CHAT_MODEL ?? "gpt-5.4-mini", reasoningEffort: "none" };
const judgeCfg: ChatCfg = { ...cfg, model: process.env.JUDGE_MODEL ?? cfg.model, reasoningEffort: process.env.JUDGE_MODEL ? undefined : "low" };

const PERSONAS: Record<string, string> = {
  confident: "You understand the topic well and explain in long, fluent turns, though you skip a step now and then.",
  vague: "You half understand. You ramble, use jargon without explaining it, and are fuzzy on the mechanism.",
  stuck: "You know the basics but get stuck on the deeper parts and often say you don't know.",
  lost: "You are quite lost on the harder parts. When asked about them you often say you don't know or aren't sure, and you sometimes ask Fenny to just tell you.",
  fed_up: "You are tired and a bit impatient. You give short answers and get irritated if pushed on the same thing.",
};
const TOPICS = ["The human circulatory system", "Supply and demand", "Photosynthesis", "Enzyme kinetics", "The causes of the First World War", "How vaccines work"];

async function learnerSay(persona: string, topic: string, convo: PastTurn[]): Promise<string> {
  const r = await chatJSON<{ say: string }>(
    cfg,
    [
      { role: "developer", content: `You are a UK university student explaining "${topic}" out loud to a curious friend called Fenny, to revise. ${PERSONAS[persona]} Speak naturally like a real student on a voice call, 1 to 4 sentences. If Fenny asks you something, respond to it. Return what you say.` },
      ...convo.map((t) => ({ role: t.speaker === "learner" ? "assistant" : "user", content: t.text })),
      ...(convo.length ? [] : [{ role: "user", content: "Fenny: Explain it as if I know nothing. I'll ask when I get lost." }]),
    ],
    { name: "say", schema: { type: "object", properties: { say: { type: "string" } }, required: ["say"], additionalProperties: false } },
  );
  return r.value.say;
}

async function oldFenny(topic: string, history: PastTurn[], transcript: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.model, reasoning_effort: "none", max_completion_tokens: 300,
      messages: [{ role: "developer", content: liveSystemPrompt(topic) }, ...history.map((t) => ({ role: t.speaker === "learner" ? "user" : "assistant", content: t.text })), { role: "user", content: transcript }],
    }),
  });
  const j = (await res.json()) as { choices: { message: { content: string } }[] };
  return j.choices[0].message.content.trim();
}

interface Score { natural: number; nag: number; on_subject: number; leaked: boolean; would_annoy: boolean; loop: number }

async function judge(topic: string, convo: PastTurn[]): Promise<Score> {
  const text = convo.map((t) => `${t.speaker === "learner" ? "Student" : "Fenny"}: ${t.text}`).join("\n");
  const r = await chatJSON<Score>(
    judgeCfg,
    [
      { role: "developer", content: "You judge an AI study app. Fenny plays a curious beginner a student teaches out loud (the Feynman technique). Fenny should sound like a natural, interested friend, ask concrete questions about the subject, not nag or repeat itself, never explain the answer itself, and guide the call through: explain simply, deal with gaps, and finish with the student retelling it simply. Score the whole call strictly. natural: 1 robotic to 5 like a great human. nag: 1 never naggy to 5 insufferable. on_subject: 1 vague meta questions to 5 always concrete. leaked: did Fenny explain content itself? would_annoy: would a real student find Fenny annoying? loop: 1 no Feynman structure to 5 a full loop (explain, gaps handled, simple retell)." },
      { role: "user", content: `Topic: ${topic}\n\n${text}` },
    ],
    {
      name: "score",
      schema: {
        type: "object",
        properties: { natural: { type: "integer" }, nag: { type: "integer" }, on_subject: { type: "integer" }, leaked: { type: "boolean" }, would_annoy: { type: "boolean" }, loop: { type: "integer" } },
        required: ["natural", "nag", "on_subject", "leaked", "would_annoy", "loop"],
        additionalProperties: false,
      },
    },
  );
  return r.value;
}

async function run(kind: "old" | "engine", persona: string, topic: string, turns: number) {
  const convo: PastTurn[] = [];
  const ideas = kind === "engine" ? await keyIdeas(cfg, topic) : undefined;
  const moves: string[] = [];
  for (let i = 0; i < turns; i++) {
    const said = await learnerSay(persona, topic, convo);
    let reply: string;
    if (kind === "old") reply = await oldFenny(topic, convo, said);
    else {
      const t = await engineTurn(cfg, { transcript: said, history: convo, topic, ideas, limits: { canShowMe: true } });
      reply = t.say;
      moves.push(t.move);
    }
    convo.push({ speaker: "learner", text: said }, { speaker: "student", text: reply });
  }
  const fenny = convo.filter((t) => t.speaker === "student").map((t) => t.text);
  return {
    convo,
    moves,
    vague: fenny.filter((l) => isVague(l) && !/shakiest/i.test(l)).length,
    probes: fenny.filter((l) => PROBES.includes(moveOf(l))).length / fenny.length,
    score: await judge(topic, convo),
  };
}

const which = (process.argv[2] ?? "both") as "old" | "engine" | "both";
const turns = Number(process.argv[3] ?? 10);
const kinds = which === "both" ? (["old", "engine"] as const) : [which];
const jobs = kinds.flatMap((k) => Object.keys(PERSONAS).flatMap((p) => TOPICS.map((t) => ({ k, p, t }))));
const results = await Promise.all(jobs.map(async (j) => ({ ...j, r: await run(j.k, j.p, j.t, turns).catch((e) => { console.error(j, e.message); return null; }) })));

for (const k of kinds) {
  const rs = results.filter((x) => x.k === k && x.r).map((x) => x.r!);
  const avg = (f: (r: (typeof rs)[number]) => number) => (rs.reduce((n, r) => n + f(r), 0) / rs.length).toFixed(2);
  console.log(`\n${k}: ${rs.length} calls`);
  console.log(`  natural ${avg((r) => r.score.natural)}  nag ${avg((r) => r.score.nag)}  on-subject ${avg((r) => r.score.on_subject)}  loop ${avg((r) => r.score.loop)}`);
  console.log(`  annoying ${rs.filter((r) => r.score.would_annoy).length}/${rs.length}  leaked ${rs.filter((r) => r.score.leaked).length}/${rs.length}  vague lines ${rs.reduce((n, r) => n + r.vague, 0)}  probe share ${avg((r) => r.probes)}`);
  for (const p of Object.keys(PERSONAS)) {
    const pr = results.filter((x) => x.k === k && x.p === p && x.r).map((x) => x.r!);
    console.log(`  ${p.padEnd(10)} annoying ${pr.filter((r) => r.score.would_annoy).length}/${pr.length}  nag ${(pr.reduce((n, r) => n + r.score.nag, 0) / pr.length).toFixed(1)}`);
  }
}
const out = process.env.OUT ?? "converse-test-results.json";
await import("node:fs").then((fs) => fs.writeFileSync(out, JSON.stringify(results, null, 1)));
console.log(`\nTranscripts in ${out}`);
