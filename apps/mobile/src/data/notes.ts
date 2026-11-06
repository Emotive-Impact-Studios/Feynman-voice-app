// Notes the learner scanned, kept on the phone per topic until accounts and
// uploads to Neon exist (build step 2). One small JSON file, like the profile.
import { File, Paths } from "expo-file-system";

/** Enough for a good handful of pages, without making every turn heavy. */
export const MAX_NOTES_CHARS = 24_000;

const file = new File(Paths.document, "notes.json");
let cache: Record<string, string> | null = null;

function all(): Record<string, string> {
  if (cache) return cache;
  try {
    cache = file.exists ? (JSON.parse(file.textSync()) as Record<string, string>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

const key = (title: string) => title.trim().toLowerCase();

/** The scanned notes for a topic, if any. */
export function getNotes(title: string): string | undefined {
  return all()[key(title)] || undefined;
}

/** Keep these notes for the topic, replacing older ones. */
export function saveNotes(title: string, notes: string) {
  const k = key(title);
  if (!k || !notes.trim()) return;
  cache = { ...all(), [k]: notes.trim().slice(0, MAX_NOTES_CHARS) };
  try {
    file.write(JSON.stringify(cache));
  } catch {
    // Not fatal: the notes still work for this session.
  }
}

/** Join pages into one set of notes, marking where each page starts. */
export function joinPages(pages: string[]): string {
  const kept = pages.map((p) => p.trim()).filter(Boolean);
  if (kept.length <= 1) return kept[0] ?? "";
  return kept.map((p, i) => `--- Page ${i + 1} ---\n${p}`).join("\n\n");
}
