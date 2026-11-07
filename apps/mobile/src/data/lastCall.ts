// Hands the call that just ended to the results screen. Kept in a small file
// too, so a call whose results never came back (the app was closed, or the
// phone reclaimed it) is picked up again on the next open. Cleared once the
// results are saved on the topic (see profile.ts) or the learner leaves them.
import { File, Paths } from "expo-file-system";
import type { Turn } from "../api";

export interface FinishedCall {
  topic: string;
  goal?: string;
  /** The gap this call went back over, when it was opened from a gap card. */
  focus?: string;
  focusId?: string;
  turns: Turn[];
  /** Their answer to "which bit felt shakiest?" when Fenny asked it in the call. */
  shakiest?: string;
  /** Key ideas from the conversation engine that never came up in the call. */
  missedIdeas?: string[];
  /** Speaking seconds in the call. */
  seconds: number;
}

const file = new File(Paths.document, "last-call.json");
let pending: FinishedCall | null | undefined;

export function setFinishedCall(call: FinishedCall) {
  pending = call;
  try {
    file.write(JSON.stringify(call));
  } catch {
    // Not fatal: it still works while the app stays open.
  }
}

/** The call waiting for its results, if any, from memory or the file. */
export function getFinishedCall(): FinishedCall | null {
  if (pending === undefined) {
    try {
      pending = file.exists ? (JSON.parse(file.textSync()) as FinishedCall) : null;
    } catch {
      pending = null;
    }
  }
  return pending;
}

/** The results are saved (or the learner left them): nothing to pick up. */
export function clearFinishedCall() {
  pending = null;
  try {
    if (file.exists) file.delete();
  } catch {
    // Ignore: an old file only means one extra results screen.
  }
}

/** The button that hands back after Show me. */
export const TELL_ME_BUTTON = "Now tell Fenny in your own words";

/** Fenny's first line when a gap card opens a call. */
export const TELL_ME = "Go on, tell me in your own words.";

/** Calls shorter than this skip "Which bit felt shakiest?" (see docs/behavioural-design.md). */
export const SHAKIEST_MIN_SECONDS = 180;
