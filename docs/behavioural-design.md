# Behavioural design: let the learner find it

People remember and act on what they worked out themselves. Fenny is built on
that, so every part of the app should leave the thinking with the learner.
Full write-up: https://claude.ai/artifact/2xzBxSJfscmHntjbaDkB3Y

## In the call (built, `apps/api/src/prompt.ts`)

- Fenny asks the question whose answer is the missing idea, instead of naming it.
- Fenny builds on the learner's own analogy and repeats their words back.
- When the learner is stuck, Fenny asks one simpler, concrete question, then
  lets go and moves on. Never more than two questions on one thing.
- Fenny never asks vague or meta questions ("what do you mean", "which bit"),
  and there is no "before you start" opener. Edem found both insufferable in
  build 9 (2026-11-05). Fenny must never feel like a nag: questions stay
  concrete, about the subject, and a good explanation is left to flow.

## In the app (built)

- The new topic sheet asks, optionally, what they want to be able to explain by
  the exam. It is saved on the topic in their words and steers Fenny.
- Me shows a soft streak: days explaining in a row, forgiving one missed day in
  any seven. It never shames a reset.
- Live call mode should wait longer (about 2.5 s) after a "why" or "how"
  question before ending the learner's turn (with the live call work).

## Rules for gap analysis (build step 4) and "Show me" (4b) (built)

Server: `apps/api/src/review.ts` (`POST /api/analyse`, `POST /api/show-me`).
App: `apps/mobile/src/results/Results.tsx`. Gaps are saved on the topic and
listed on Today under "Explain again". A call opened from a gap card asks the
analysis whether that gap is now clear, and marks it cleared if so.

1. **The learner names the first gap.** When a call ends, Fenny asks "Which bit
   felt shakiest to you?" The answer becomes the first gap card, titled in the
   learner's words. Our own analysis adds the other cards underneath.
2. **"Show me" hands the pen back.** The short explanation from their notes
   never closes the card. It always ends with "Now tell Fenny in your own
   words", which opens a call where Fenny's first line is "Go on, tell me in
   your own words."
3. Results lead with what they explained well, quoting them, then the gaps.
4. Results show "then and now": a line from their first attempt beside their latest.

## Rules for later screens

- **Topics:** learners can add, merge and rename the sub-topics we pull from notes.
- **Today:** offer two or three suggested sessions to pick from, and ask "When
  will you explain this next?" with a nudge at that time.
- **Review queue (step 6):** frame reviews as "Fenny's forgotten, can you remind
  them?" Learners can snooze or reorder, with a short note on why spacing helps.
- **Me:** a growing "things I can explain" list, in their phrasing, once gap
  analysis can tell what they explained well.
- **Minutes and plans (steps 5, 7):** show time spent explaining and what it
  produced, never a countdown or "don't lose your progress".

## Lines we do not cross

No using the learner's own goals to upsell, no fake scarcity on minutes or
streaks, no guilt-tripping from Fenny, and cancelling is always easy.

## Conversation engine

From 2026-11-05 Fenny runs on the engine in `apps/api/src/engine`, which makes
every call a full Feynman loop. See docs/conversation-engine.md.
