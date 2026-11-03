export type VoiceIndex = Record<string, { offset: number; shape: [number, number] }>;

export const VOICE_ALIASES: Record<string, string> = {
  Bella: "expr-voice-2-f",
  Jasper: "expr-voice-2-m",
  Luna: "expr-voice-3-f",
  Bruno: "expr-voice-3-m",
  Rosie: "expr-voice-4-f",
  Hugo: "expr-voice-4-m",
  Kiki: "expr-voice-5-f",
  Leo: "expr-voice-5-m",
};

export const SPEED_PRIORS: Record<string, number> = {
  "expr-voice-2-f": 0.8,
  "expr-voice-2-m": 0.8,
  "expr-voice-3-m": 0.8,
  "expr-voice-3-f": 0.8,
  "expr-voice-4-m": 0.9,
  "expr-voice-4-f": 0.8,
  "expr-voice-5-m": 0.8,
  "expr-voice-5-f": 0.8,
};

export function resolveVoice(voice: string): string {
  return VOICE_ALIASES[voice] ?? voice;
}

/**
 * Picks the style vector the same way the Python package does:
 * row min(len(text), rows - 1) of that voice's matrix.
 */
export function styleFor(
  voicesBin: ArrayBuffer,
  index: VoiceIndex,
  voice: string,
  textLength: number,
): Float32Array {
  const entry = index[resolveVoice(voice)];
  if (!entry) throw new Error(`Unknown voice: ${voice}`);
  const [rows, dims] = entry.shape;
  const row = Math.min(textLength, rows - 1);
  return new Float32Array(voicesBin, entry.offset + row * dims * 4, dims).slice();
}
