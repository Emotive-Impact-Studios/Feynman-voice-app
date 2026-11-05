# Behavioural design: let the learner find it

People remember and act on what they worked out themselves. Fenny is built on
that, so every part of the app should leave the thinking with the learner.
Full write-up: https://claude.ai/artifact/2xzBxSJfscmHntjbaDkB3Y

## In the call (built, `apps/api/src/prompt.ts`)

- Fenny asks the question whose answer is the missing idea, instead of naming it.
- Fenny builds on the learner's own analogy and repeats their words back.
- When the learner is stuck, Fenny climbs a ladder: a simpler nudge, then a
  "what would happen if" case, then it lets go and moves on. Never more than
  three turns on one gap.

## Rules for gap analysis (build step 4) and "Show me" (4b)

1. **The learner names the first gap.** When a call ends, Fenny asks "Which bit
   felt shakiest to you?" The answer becomes the first gap card, titled in the
   learner's words. Our own analysis adds the other cards underneath.
2. **"Show me" hands the pen back.** The short explanation from their notes
   never closes the card. It always ends with "Now tell Fenny in your own
   words", which opens a call where Fenny's first line is "Go on, tell me in
   your own words."
3. Results lead with what they explained well, quoting them, then the gaps.

## Lines we do not cross

No using the learner's own goals to upsell, no fake scarcity on minutes or
streaks, no guilt-tripping from Fenny, and cancelling is always easy.
