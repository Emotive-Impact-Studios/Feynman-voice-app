// What the phone remembers about you until accounts exist (build step 2):
// your name, subjects, whether you've seen the intro, the topics you've
// explained and the speaking time you've used. Kept in one small JSON file.
import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

/** Prototype allowance, until the minutes ledger and plans exist (build steps 5 and 7). */
export const PROTOTYPE_MINUTES = 200;

export interface TopicRecord {
  title: string;
  /** Last time you explained it, ms since epoch. */
  at: number;
  /** Speaking seconds across all sessions on this topic. */
  seconds: number;
  sessions: number;
  /** How many questions the student asked. */
  questions: number;
}

export interface Profile {
  introDone: boolean;
  name: string;
  subjects: string[];
  secondsUsed: number;
  topics: TopicRecord[];
}

const EMPTY: Profile = { introDone: false, name: "", subjects: [], secondsUsed: 0, topics: [] };
const file = new File(Paths.document, "profile.json");

function load(): Profile {
  try {
    if (!file.exists) return EMPTY;
    return { ...EMPTY, ...JSON.parse(file.textSync()) };
  } catch {
    return EMPTY;
  }
}

let state: Profile = load();
const listeners = new Set<() => void>();

function set(next: Profile) {
  state = next;
  try {
    file.write(JSON.stringify(next));
  } catch {
    // Not fatal: it still works for this run.
  }
  listeners.forEach((l) => l());
}

export function useProfile(): Profile {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function getProfile(): Profile {
  return state;
}

export function finishIntro(name: string, subjects: string[]) {
  set({ ...state, introDone: true, name: name.trim(), subjects });
}

export function replayIntro() {
  set({ ...state, introDone: false });
}

/** Record a finished session. Sessions with no speaking are not saved. */
export function recordSession(title: string, seconds: number, questions: number) {
  const t = title.trim();
  if (!t || seconds < 1) return;
  const old = state.topics.find((x) => x.title.toLowerCase() === t.toLowerCase());
  const rec: TopicRecord = old
    ? { ...old, at: Date.now(), seconds: old.seconds + seconds, sessions: old.sessions + 1, questions: old.questions + questions }
    : { title: t, at: Date.now(), seconds, sessions: 1, questions };
  set({
    ...state,
    secondsUsed: state.secondsUsed + seconds,
    topics: [rec, ...state.topics.filter((x) => x !== old)],
  });
}

/** Whole minutes left, counting any seconds spoken in a session not yet saved. */
export function minutesLeft(p: Profile, pendingSeconds = 0) {
  return Math.max(0, Math.floor(PROTOTYPE_MINUTES - (p.secondsUsed + pendingSeconds) / 60));
}

/** "2 days ago", "today", "yesterday". */
export function ago(at: number) {
  const days = dayNumber(Date.now()) - dayNumber(at);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Local calendar day as a whole number, so clock changes can't shift it.
function dayNumber(t: number) {
  const d = new Date(t);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
}

export const SUBJECTS: [string, string][] = [
  ["bio", "Biology"],
  ["med", "Medicine"],
  ["chem", "Chemistry"],
  ["law", "Law"],
  ["econ", "Economics"],
  ["psy", "Psychology"],
  ["eng", "Engineering"],
  ["hist", "History"],
  ["cs", "Computer science"],
  ["other", "Something else"],
];
