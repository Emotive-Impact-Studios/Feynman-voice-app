import { chunkText, phonemiseKeepingPunctuation, type PhonemeChunk } from "@feynman/kitten-tts";
import { phonemize } from "phonemizer";

// Phonemes are made here rather than on the phone, so the app does not need
// to ship eSpeak. The phone only turns them into token ids and runs the model.
export async function toSpeechChunks(text: string): Promise<PhonemeChunk[]> {
  const out: PhonemeChunk[] = [];
  for (const chunk of chunkText(text)) {
    const phonemes = await phonemiseKeepingPunctuation(chunk, async (s) => (await phonemize(s, "en-us")).join(" "));
    out.push({ text: chunk, phonemes });
  }
  return out;
}
