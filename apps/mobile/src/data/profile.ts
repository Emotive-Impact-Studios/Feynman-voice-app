// What the phone remembers about you until accounts exist (build step 2):
// your name, subjects, whether you've seen the intro, the topics you've
// explained and the speaking time you've used. Kept in one small JSON file.
import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";
import type { Analysis, Gap, Strength } from "../api";

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
  /** What they want to be able to explain, in their own words. */
  goal?: string;
  /** Their notes as text, once uploads exist (build step 3). */
  notes?: string;
  /** What they said the first time they explained it, for "then and now". */
  firstAttempt?: string;
  /** Gaps from gap analysis, newest first. Cleared ones stay, marked. */
  gaps?: SavedGap[];
  /** What came across clearly, in their words, newest first. */
  strengths?: Strength[];
}

export interface SavedGap extends Gap {
  id: string;
  at: number;
  /** Set once they have explained it clearly in a later call. */
  clearedAt?: number;
}

export interface Profile {
  introDone: boolean;
  name: string;
  subjects: string[];
  secondsUsed: number;
  topics: TopicRecord[];
  /** Local day numbers on which they explained something, for the soft streak. */
  days: number[];
}

const EMPTY: Profile = { introDone: false, name: "", subjects: [], secondsUsed: 0, topics: [], days: [] };
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
export function recordSession(title: string, seconds: number, questions: number, goal?: string) {
  const t = title.trim();
  if (!t || seconds < 1) return;
  const old = findTopic(t);
  const g = goal?.trim() || old?.goal;
  const rec: TopicRecord = old
    ? { ...old, at: Date.now(), seconds: old.seconds + seconds, sessions: old.sessions + 1, questions: old.questions + questions, goal: g }
    : { title: t, at: Date.now(), seconds, sessions: 1, questions, goal: g };
  const today = dayNumber(Date.now());
  set({
    ...state,
    secondsUsed: state.secondsUsed + seconds,
    topics: [rec, ...state.topics.filter((x) => x !== old)],
    days: state.days.includes(today) ? state.days : [...state.days, today].slice(-120),
  });
}

const MAX_GAPS = 30;
const MAX_STRENGTHS = 30;

/**
 * Save what gap analysis found for a topic. New gaps go on top; a gap this
 * call went back over is marked cleared if they explained it this time.
 */
export function saveAnalysis(title: string, a: Analysis, opts: { focusId?: string; attempt?: string } = {}): SavedGap[] {
  const old = findTopic(title);
  if (!old) return [];
  const now = Date.now();
  const fresh: SavedGap[] = a.gaps.map((g, i) => ({ ...g, id: `${now}-${i}`, at: now }));
  const kept = (old.gaps ?? []).map((g) => (g.id === opts.focusId && a.focusExplained ? { ...g, clearedAt: now } : g));
  const seen = new Set(fresh.map((g) => g.title.toLowerCase()));
  const rec: TopicRecord = {
    ...old,
    gaps: [...fresh, ...kept.filter((g) => !seen.has(g.title.toLowerCase()))].slice(0, MAX_GAPS),
    strengths: [...a.strengths, ...(old.strengths ?? [])].slice(0, MAX_STRENGTHS),
    firstAttempt: old.firstAttempt ?? opts.attempt?.slice(0, 3000),
  };
  set({ ...state, topics: state.topics.map((t) => (t === old ? rec : t)) });
  return fresh;
}

/** Gaps still to explain again, across topics, newest first. */
export function openGaps(p: Profile): { topic: string; gap: SavedGap }[] {
  return p.topics
    .flatMap((t) => (t.gaps ?? []).filter((g) => !g.clearedAt).map((gap) => ({ topic: t.title, gap })))
    .sort((a, b) => b.gap.at - a.gap.at);
}

export function findTopic(title: string): TopicRecord | undefined {
  const t = title.trim().toLowerCase();
  return state.topics.find((x) => x.title.toLowerCase() === t);
}

/**
 * Days in a row you explained something, forgiving one missed day in any
 * seven. Today only counts once you've explained, and an empty today never
 * breaks the streak. A soft streak: missing a day is fine, not a reset.
 */
export function softStreak(days: number[], today = dayNumber(Date.now())): number {
  const seen = new Set(days);
  if (!seen.size) return 0;
  const first = Math.min(...days);
  let d = seen.has(today) ? today : today - 1;
  let streak = 0;
  const misses: number[] = [];
  while (d >= first) {
    if (seen.has(d)) streak++;
    else if (misses.some((m) => m - d < 7)) break;
    else misses.push(d);
    d--;
  }
  return streak;
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
export function dayNumber(t: number) {
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
