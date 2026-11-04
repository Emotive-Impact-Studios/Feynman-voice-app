// Review progress that outlives any one screen. Home can be mounted afresh
// (feedback returns to it with a replace), so the queue and mastered count
// live here rather than in Home's state. Swapped for the Neon review queue
// in build step 6.
import { useSyncExternalStore } from "react";
import { me, reviewQueue, type ReviewCard } from "./mock";

interface ReviewState {
  queue: ReviewCard[];
  mastered: number;
}

let state: ReviewState = { queue: reviewQueue, mastered: me.mastered };
const listeners = new Set<() => void>();

function set(next: ReviewState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Answer the card at the front of the queue. */
export function answerReview(knewIt: boolean) {
  set({ queue: state.queue.slice(1), mastered: state.mastered + (knewIt ? 1 : 0) });
}

export function useReviews(): ReviewState {
  return useSyncExternalStore(subscribe, () => state);
}
