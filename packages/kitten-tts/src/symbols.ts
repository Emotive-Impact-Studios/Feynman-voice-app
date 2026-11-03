// Mirrors TextCleaner in the KittenTTS Python package (0.8). The order matters:
// each symbol's index is the token id the ONNX model expects.
const PAD = "$";
const PUNCTUATION = ';:,.!?¡¿—…"«»"" ';
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const LETTERS_IPA =
  "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ";

export const SYMBOLS: string[] = [PAD, ...PUNCTUATION, ...LETTERS, ...LETTERS_IPA];

// Python builds a dict, so a repeated symbol keeps its last index. Copy that.
const INDEX = new Map<string, number>();
SYMBOLS.forEach((s, i) => INDEX.set(s, i));

/** Python's re.findall(r"\w+|[^\w\s]", text), Unicode aware. */
export function basicTokenise(text: string): string[] {
  return text.match(/[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]/gu) ?? [];
}

/** Turns an IPA phoneme string into model token ids, with the start and end pads. */
export function phonemesToIds(phonemes: string): number[] {
  const spaced = basicTokenise(phonemes).join(" ");
  const ids: number[] = [0];
  for (const ch of spaced) {
    const id = INDEX.get(ch);
    if (id !== undefined) ids.push(id);
  }
  ids.push(0);
  return ids;
}
