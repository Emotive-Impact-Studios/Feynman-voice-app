// Based on chunk_text and ensure_punctuation from the KittenTTS Python package.
// One deliberate change: the Python version throws away each sentence's own
// full stop or question mark and adds a comma. We keep it, because a curious
// student's questions should sound like questions.

export function ensurePunctuation(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return ".!?,;:".includes(t[t.length - 1]) ? t : `${t},`;
}

export function chunkText(text: string, maxLen = 400): string[] {
  const chunks: string[] = [];
  for (const raw of text.match(/[^.!?]+[.!?]*/g) ?? []) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (!/[^.!?\s]/.test(sentence)) continue;
    if (sentence.length <= maxLen) {
      chunks.push(ensurePunctuation(sentence));
      continue;
    }
    let temp = "";
    for (const word of sentence.split(/\s+/)) {
      if (temp.length + word.length + 1 <= maxLen) {
        temp = temp ? `${temp} ${word}` : word;
      } else {
        if (temp) chunks.push(ensurePunctuation(temp));
        temp = word;
      }
    }
    if (temp) chunks.push(ensurePunctuation(temp));
  }
  return chunks;
}

/**
 * eSpeak drops punctuation, but the model was trained with it kept
 * (preserve_punctuation=True). Phonemise each clause and put the marks back.
 */
export async function phonemiseKeepingPunctuation(
  text: string,
  phonemise: (clause: string) => Promise<string>,
): Promise<string> {
  const parts = text.split(/([,;:.!?]+)/);
  let out = "";
  for (const part of parts) {
    if (!part.trim()) continue;
    if (/^[,;:.!?]+$/.test(part)) {
      out += part;
    } else {
      out += (out ? " " : "") + (await phonemise(part.trim()));
    }
  }
  return out;
}
