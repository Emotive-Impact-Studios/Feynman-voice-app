// Hands the call that just ended to the results screen. In memory only: the
// results are saved on the topic (see profile.ts) once they are back.
import type { Turn } from "../api";

export interface FinishedCall {
  topic: string;
  goal?: string;
  /** The gap this call went back over, when it was opened from a gap card. */
  focus?: string;
  focusId?: string;
  turns: Turn[];
  /** Speaking seconds in the call. */
  seconds: number;
}

let pending: FinishedCall | null = null;

export function setFinishedCall(call: FinishedCall) {
  pending = call;
}

export function getFinishedCall(): FinishedCall | null {
  return pending;
}

/** Fenny's first line when a gap card opens a call. */
export const TELL_ME = "Go on, tell me in your own words.";

/** Calls shorter than this skip "Which bit felt shakiest?" (see docs/behavioural-design.md). */
export const SHAKIEST_MIN_SECONDS = 180;
