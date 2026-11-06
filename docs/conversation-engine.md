# Fenny's conversation engine

Design doc: https://claude.ai/artifact/FpcknZcX3WR7soqxZWTTzz

Each turn of a live call (`apps/api/src/live.ts`, when `FENNY_ENGINE` is not `off`):

1. **Key ideas** (`engine/ideas.ts`): 4 to 7 ideas a full explanation needs,
   from the learner's notes or the topic. Built while the learner's audio is
   transcribed and cached per topic.
2. **Limits in code** (`engine/policy.ts`): works out where the call is from the
   history alone and lists the moves Fenny may make. At most one probe (why,
   what if, puzzled) in two turns; first "don't know" gets a simpler question,
   the second gets the Show me offer (or a let-go on phones without it); asking
   to be told opens Show me; no repeated moves; listening at most once in three
   turns; the 30 second retell from turn 7 and by turn 12, then a warm close
   with "which bit felt shakiest?", then a short thank-you and goodbye (`wrap`;
   the phone ends the call once that line has played, in `useLiveCall`). The engine reads the whole
   call history for these counts and sends only the last 20 lines to the model.
   Lines the next turn reads back (offer, Show me, retell, close, wrap) are forced
   into recognisable wording in code.
3. **One line** (`engine/engine.ts`): the model picks one allowed move, says one
   line (one question at most) and reports which key ideas are covered. Vague
   questions ("what do you mean", "which bit") are replaced before Fenny speaks.

Extra stream events: `{"type":"engine","move","covered","ideas"}` every turn and
`{"type":"show_me","gap":{"title"}}` when the learner takes the explanation. The
phone sends `features: ["show_me"]` once it can show the card; older phones are
never offered it.

## Lines the voices can read

Every line Fenny says goes through `speakable()` (`apps/api/src/speakable.ts`) before any voice gets it. Em and en dashes, semicolons, markdown and emoji make the voices, Phonon above all, lose the shape of the sentence and the inflection goes wrong. Dashes become commas, number ranges become "5 to 10", and symbols are removed. The prompts also ask for proper sentences with no dashes. Before this rule, 15 of 287 lines in the test calls had a dash; after it, 0 of 240.

## The conversation test

No change to how Fenny talks ships without this:

    OPENAI_API_KEY=... npx tsx apps/api/scripts/converse-test.ts both 10

Five simulated learners (confident, vague, stuck, lost, fed up) explain six
topics for ten turns each, against the old prompt and the engine. A judge model
scores each call for naturalness, nagging, staying on the subject, leaking
answers, whether it would annoy a real student, and how fully it ran the
Feynman loop. Transcripts are written to `converse-test-results.json`.

First run (2026-11-05): the engine's first draft was annoying in 14 of 24 calls
(it parroted "Ooh, and what happens after that?"). After fixes: 0 of 30
annoying, nag 1.1, naturalness 4.1, Feynman loop 4.7 (old prompt: 3.7).
