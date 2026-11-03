import { phonemesToIds } from "./symbols";
import { trimLeadingSilence } from "./wav";
import { resolveVoice, SPEED_PRIORS, styleFor, type VoiceIndex } from "./voices";

export const SAMPLE_RATE = 24000;
const TRIM_SAMPLES = 5000; // the Python package trims this tail off every chunk

/** One chunk of speech: the text (for style selection) and its phonemes. */
export interface PhonemeChunk {
  text: string;
  phonemes: string;
}

/**
 * The only thing that differs between Node and the phone: how the ONNX model
 * is run. onnxruntime-node and onnxruntime-react-native both fit this shape.
 */
export interface KittenRunner {
  run(inputIds: number[], style: Float32Array, speed: number): Promise<Float32Array>;
}

export interface Voices {
  bin: ArrayBuffer;
  index: VoiceIndex;
}

export async function synthesise(
  runner: KittenRunner,
  voices: Voices,
  chunks: PhonemeChunk[],
  voice = "Kiki",
  speed = 1,
): Promise<Float32Array> {
  const id = resolveVoice(voice);
  const finalSpeed = speed * (SPEED_PRIORS[id] ?? 1);
  const parts: Float32Array[] = [];
  for (const chunk of chunks) {
    const style = styleFor(voices.bin, voices.index, id, chunk.text.length);
    const audio = await runner.run(phonemesToIds(chunk.phonemes), style, finalSpeed);
    parts.push(audio.subarray(0, Math.max(0, audio.length - TRIM_SAMPLES)));
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return trimLeadingSilence(out);
}
