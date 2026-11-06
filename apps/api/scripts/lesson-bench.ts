// Lesson bench: builds the same "Teach me" lessons on each brain and scores them.
//   OPENAI_API_KEY=... ANTHROPIC_API_KEY=... npx tsx scripts/lesson-bench.ts [claude,openai] [reps]
// The judge is gpt-5.4-mini for every brain, so the scores are comparable.
import { buildLesson, type Lesson, type LessonRequest } from "../src/lesson";
import { chatJSON } from "../src/engine/chat";

const CASES: (LessonRequest & { name: string })[] = [
  {
    name: "osmosis",
    topic: "Osmosis",
    idea: "Why water moves towards the side with more solute",
    said: "Water moves to where there is less stuff dissolved, because it spreads out evenly.",
    notes: `Osmosis is the net movement of water molecules across a partially permeable membrane from a region of higher water potential to a region of lower water potential. Water potential is lowered by dissolved solutes, because solute molecules attract water molecules and leave fewer of them free to move. Pure water has the highest water potential. A partially permeable membrane lets water through but stops larger solute molecules such as sucrose. If a red blood cell is placed in pure water, water enters by osmosis and the cell can burst (haemolysis). In a concentrated salt solution the cell loses water and shrinks (crenation). Plant cells do not burst because the cell wall resists the pressure; the cell becomes turgid.`,
  },
  {
    name: "supply-demand",
    topic: "Supply and demand",
    idea: "What happens to price and quantity when demand rises",
    said: "If more people want it, the price goes up and then less gets sold.",
    notes: `Demand is the quantity of a good consumers are willing and able to buy at each price. The demand curve slopes downwards: as price falls, quantity demanded rises. Supply is the quantity producers are willing and able to sell at each price; the supply curve slopes upwards. Equilibrium is where quantity demanded equals quantity supplied. A rise in demand (for example from higher incomes for a normal good) shifts the demand curve to the right. At the old price there is now excess demand, so the price is bid up. The higher price encourages producers to supply more, a movement along the supply curve. The new equilibrium has a higher price and a higher quantity. A change in price causes a movement along a curve; a change in any other factor causes a shift of the curve.`,
  },
  {
    name: "enzyme-kinetics",
    topic: "Enzyme kinetics",
    idea: "What Km tells you about an enzyme",
    said: "Km is the maximum speed the enzyme can go.",
    notes: `The Michaelis-Menten equation describes how the initial rate of an enzyme reaction (v) depends on substrate concentration [S]: v = Vmax[S] / (Km + [S]). Vmax is the maximum rate, reached when all enzyme active sites are saturated with substrate. Km, the Michaelis constant, is the substrate concentration at which the rate is half of Vmax. A low Km means the enzyme reaches half its maximum rate at a low substrate concentration, which usually indicates a high affinity for the substrate. A high Km means more substrate is needed, suggesting lower affinity. A competitive inhibitor raises the apparent Km but leaves Vmax unchanged, because enough substrate can outcompete it.`,
  },
  {
    // Notes that leave a lot out, to see whether a brain fills the gaps with outside facts.
    name: "thin-notes",
    topic: "The causes of the First World War",
    idea: "How the alliance system turned a local crisis into a wider war",
    said: "Everyone just declared war at once because they all hated each other.",
    notes: `Lecture 3. By 1914 Europe was split into two blocs. The Triple Entente: Britain, France and Russia. The Triple Alliance: Germany, Austria-Hungary and Italy. Archduke Franz Ferdinand was assassinated in Sarajevo on 28 June 1914. Austria-Hungary blamed Serbia and declared war on it on 28 July. Russia backed Serbia and began to mobilise. Germany declared war on Russia, then on France. Britain entered the war on 4 August after Germany invaded Belgium.`,
  },
];

interface Judged { faithful: number; clear: number; puzzles: number; fixes_misconception: boolean; outside_facts: string[] }

async function judge(c: LessonRequest, lesson: Lesson): Promise<Judged> {
  const r = await chatJSON<Judged>(
    { apiKey: process.env.OPENAI_API_KEY!, model: "gpt-5.4-mini", reasoningEffort: "low" },
    [
      { role: "developer", content: "You check bite-sized lessons for a UK university study app. Score strictly. faithful: 1 adds lots of facts not in the notes, 5 everything is backed by the notes. clear: 1 confusing, 5 a first-year would get it at once. puzzles: 1 trivial or broken, 5 varied, fair, believable wrong options, last one hardest. fixes_misconception: does the lesson quietly correct what the student said? outside_facts: list any claims the notes do not support (empty if none)." },
      { role: "user", content: `Notes:\n${c.notes}\n\nThe student said: ${c.said}\n\nLesson:\n${JSON.stringify(lesson, null, 1)}` },
    ],
    {
      name: "judge",
      schema: {
        type: "object",
        properties: { faithful: { type: "integer" }, clear: { type: "integer" }, puzzles: { type: "integer" }, fixes_misconception: { type: "boolean" }, outside_facts: { type: "array", items: { type: "string" } } },
        required: ["faithful", "clear", "puzzles", "fixes_misconception", "outside_facts"],
        additionalProperties: false,
      },
    },
    1200,
  );
  return r.value;
}

const brains = (process.argv[2] ?? "claude,openai").split(",");
const reps = Number(process.argv[3] ?? 2);
const env = { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? process.env.FENNY_ANTHROPIC_KEY };
const rows: Record<string, unknown>[] = [];
for (const brain of brains) {
  for (const c of CASES) {
    for (let i = 0; i < reps; i++) {
      // An invisible change to the idea each rep, so the lesson cache does not answer.
      const req = { ...c, idea: c.idea + "\u200B".repeat(i) };
      const t0 = Date.now();
      try {
        const r = await buildLesson({ ...env, LESSON_BRAIN: brain }, req);
        const ms = Date.now() - t0;
        if (r.cached) throw new Error("came from the cache");
        const text = JSON.stringify(r.lesson);
        const j = await judge(c, r.lesson);
        rows.push({
          brain, case: c.name, ms, model: r.model,
          usd: r.cost.reduce((n, l) => n + l.usd, 0),
          tries: r.cost.length,
          bites: r.lesson.bites.length,
          kinds: r.lesson.bites.map((b) => b.puzzle.kind),
          quotesFound: r.lesson.bites.filter((b) => b.fromNotes).length,
          dashes: (text.match(/[–—]| - /g) ?? []).length,
          ...j,
          lesson: r.lesson,
        });
        console.log(`${brain} ${c.name} ${ms}ms $${rows.at(-1)!.usd} faithful ${j.faithful} clear ${j.clear} puzzles ${j.puzzles} kinds ${r.lesson.bites.map((b) => b.puzzle.kind).join("/")}`);
      } catch (e) {
        console.error(brain, c.name, (e as Error).message);
        rows.push({ brain, case: c.name, error: (e as Error).message });
      }
    }
  }
}

for (const brain of brains) {
  const rs = rows.filter((r) => r.brain === brain && !r.error) as Record<string, number & string[] & boolean>[];
  if (!rs.length) continue;
  const avg = (k: string) => (rs.reduce((n, r) => n + Number(r[k]), 0) / rs.length).toFixed(2);
  const ms = rs.map((r) => r.ms as number).sort((a, b) => a - b);
  const kinds = new Set(rs.flatMap((r) => r.kinds as string[]));
  console.log(`\n${brain}: ${rs.length} lessons, ${rows.filter((r) => r.brain === brain && r.error).length} failed`);
  console.log(`  faithful ${avg("faithful")}  clear ${avg("clear")}  puzzles ${avg("puzzles")}  fixes misconception ${rs.filter((r) => r.fixes_misconception).length}/${rs.length}`);
  console.log(`  quotes found ${avg("quotesFound")} of ${avg("bites")} bites  outside facts ${rs.reduce((n, r) => n + (r.outside_facts as string[]).length, 0)}  dashes ${rs.reduce((n, r) => n + (r.dashes as number), 0)}  retries ${rs.filter((r) => (r.tries as number) > 1).length}`);
  console.log(`  puzzle kinds used ${[...kinds].join(", ")}`);
  console.log(`  time median ${ms[ms.length >> 1]}ms  max ${ms.at(-1)}ms  cost per lesson $${(rs.reduce((n, r) => n + Number(r.usd), 0) / rs.length).toFixed(4)}`);
}
const out = process.env.OUT ?? "lesson-bench-results.json";
await import("node:fs").then((fs) => fs.writeFileSync(out, JSON.stringify(rows, null, 1)));
console.log(`\nLessons in ${out}`);
