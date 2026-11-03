// Usage: npx tsx packages/kitten-tts/node/say.ts "Some text" out.wav [voice]
import { writeFile } from "node:fs/promises";
import { phonemize } from "phonemizer";
import { chunkText, encodeWav, phonemiseKeepingPunctuation, SAMPLE_RATE, synthesise } from "../src/index";
import { loadNodeKitten } from "./runner";

const [text, out = "out.wav", voice = "Kiki"] = process.argv.slice(2);
const { runner, voices } = await loadNodeKitten(process.env.KITTEN_DIR ?? "models/kitten");
const chunks = [];
for (const c of chunkText(text)) {
  chunks.push({ text: c, phonemes: await phonemiseKeepingPunctuation(c, async (s) => (await phonemize(s, "en-us")).join(" ")) });
}
const t0 = performance.now();
const audio = await synthesise(runner, voices, chunks, voice);
const ms = performance.now() - t0;
await writeFile(out, encodeWav(audio, SAMPLE_RATE));
console.log(JSON.stringify({ chunks, seconds: +(audio.length / SAMPLE_RATE).toFixed(2), synthMs: Math.round(ms) }, null, 2));
