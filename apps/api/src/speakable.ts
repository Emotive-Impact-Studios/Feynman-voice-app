// Cleans a line before any voice speaks it. Em and en dashes, stray symbols
// and markdown make the voices (Phonon above all) lose the shape of a
// sentence, so the inflection goes wrong. The prompts already ask for plain
// sentences; this is the safety net for when the model slips.

export function speakable(text: string): string {
  let s = text;

  // Number ranges read as "to": 5–10, 1990—2000, 3 - 4.
  s = s.replace(/(\d)\s*[‒-―−]\s*(\d)/g, "$1 to $2");
  s = s.replace(/(\d)\s+-\s+(\d)/g, "$1 to $2");

  // Hyphens inside words (well-known) stay. Every other dash is a pause.
  s = s.replace(/[‐‑]/g, "-");
  s = s.replace(/\s*[‒-―−]+\s*/g, ", ");
  s = s.replace(/\s+-{1,3}\s+/g, ", ");
  s = s.replace(/(^|\s)-{2,3}(?=\w)/g, "$1, ");
  s = s.replace(/(\w)-{2,3}(?=\w)/g, "$1, ");

  // Curly quotes to plain ones.
  s = s.replace(/[‘’‛′]/g, "'").replace(/[“”‟″]/g, '"');

  // Symbols voices read aloud or stumble on.
  s = s.replace(/\s*&\s*/g, " and ");
  s = s.replace(/[*_#`~^|<>[\]{}\\•·]/g, " ");
  s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "");
  s = s.replace(/;/g, ",");

  // Tidy the punctuation left behind.
  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s+([,.?!…:])/g, "$1");
  s = s.replace(/,(\s*,)+/g, ",");
  s = s.replace(/,\s*([.?!…])/g, "$1");
  s = s.replace(/([.?!…])\s*,/g, "$1");
  s = s.replace(/^[\s,.:]+/, "");
  s = s.replace(/[\s,:]+$/, "");
  // A space after each comma, except inside numbers like 1,000.
  s = s.replace(/(?<!\d),(?=\S)|,(?=[^\s\d])/g, ", ");
  return s.trim();
}
