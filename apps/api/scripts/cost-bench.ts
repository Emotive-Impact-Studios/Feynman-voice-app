// Measures real cost per minute against Gemini without a phone.
//
//   GEMINI_API_KEY=... npm run bench -w @feynman/api
//   GEMINI_API_KEY=... npm run bench -w @feynman/api -- my-turn-1.wav my-turn-2.wav
//
// With no files, it makes "learner" audio with Kitten TTS from a short
// scripted explanation, so you only need an API key to try it. Real voices
// will be messier, so treat recorded files as the better test.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { encodeWav, SAMPLE_RATE, synthesise } from "@feynman/kitten-tts";
import { loadNodeKitten } from "@feynman/kitten-tts/node/runner";
import { toSpeechChunks } from "../src/speech";
import { handleTurn } from "../src/turn";
import type { PastTurn } from "../src/gemini";

const SCRIPT = [
  "So the heart is basically a pump. It has four chambers, two at the top and two at the bottom, and it pushes blood round the body.",
  "Right, so the right side sends blood to the lungs to pick up oxygen, and the left side sends it everywhere else. That's why there are two loops.",
  "The valves stop blood going backwards. When the ventricle squeezes, the valve snaps shut, and that's the sound you hear as a heartbeat.",
  "The left ventricle has a thicker wall because it has to push blood all the way round the body, which needs more pressure than the lungs do.",
  "Oxygen gets into the blood in the lungs through the alveoli, by diffusion, and then the blood comes back to the heart and gets pumped out.",
];

async function learnerTurns(files: string[]): Promise<{ wav: Uint8Array; seconds: number; label: string }[]> {
  if (files.length) {
    return Promise.all(
      files.map(async (f) => {
        const wav = new Uint8Array(await readFile(f));
        const v = new DataView(wav.buffer, wav.byteOffset);
        const seconds = v.getUint32(40, true) / v.getUint32(28, true); // data bytes / byte rate
        return { wav, seconds, label: f };
      }),
    );
  }
  const { runner, voices } = await loadNodeKitten(resolve(process.env.KITTEN_DIR ?? "../../models/kitten"));
  const turns = [];
  for (const line of SCRIPT) {
    const audio = await synthesise(runner, voices, await toSpeechChunks(line), "Jasper");
    turns.push({ wav: encodeWav(audio, SAMPLE_RATE), seconds: audio.length / SAMPLE_RATE, label: line.slice(0, 40) + "..." });
  }
  return turns;
}

const turns = await learnerTurns(process.argv.slice(2));
const history: PastTurn[] = [];
let totalPence = 0;
let totalSeconds = 0;
for (const t of turns) {
  const req = new Request("http://local/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.PROTOTYPE_TOKEN ?? ""}` },
    body: JSON.stringify({
      audioBase64: Buffer.from(t.wav).toString("base64"),
      mimeType: "audio/wav",
      audioSeconds: t.seconds,
      history,
      topic: "How the heart and circulation work",
    }),
  });
  const res = await handleTurn(req);
  const body = await res.json();
  if (!res.ok) {
    console.error(res.status, body);
    process.exit(1);
  }
  history.push({ speaker: "learner", text: body.transcript }, { speaker: "student", text: body.question });
  totalPence += body.cost.pence;
  totalSeconds += t.seconds;
  console.log(
    `${t.seconds.toFixed(1)}s  ${body.cost.pence.toFixed(3)}p  ${body.timingMs.gemini}ms  ` +
      `in ${body.cost.audioInTokens}a/${body.cost.textInTokens}t out ${body.cost.outTokens}\n  Q: ${body.question}`,
  );
}
console.log(
  `\n${turns.length} turns, ${(totalSeconds / 60).toFixed(2)} learner minutes, ${totalPence.toFixed(3)}p in total, ` +
    `${(totalPence / (totalSeconds / 60)).toFixed(3)}p per minute`,
);
