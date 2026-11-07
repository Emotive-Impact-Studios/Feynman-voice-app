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

## When they don't know it

As soon as the learner clearly doesn't know a bit (they say so, or give two empty answers in a row), Fenny stops asking about it. She never asks the same thing a smaller or different way.

- A phone with teach mode (it sends `features: ["teach"]`) gets the offer "Tap Teach me to learn it first" (move `offer_teach`, event `teach_offer` with the idea). A spoken yes gives move `teach` and event `teach`, which opens teach mode.
- A phone with Show me gets the Show me offer.
- Otherwise Fenny moves on to another idea once. The second time, she ends the call kindly and suggests reading the notes first, then coming back to teach her.

- Teach me is offered at most twice a call if they keep not taking it; after that Fenny moves on, then ends kindly.
- "Okay, the leaves have chlorophyll..." after an offer is them carrying on, not a yes. Only a short reply ("Yeah, go on") counts as yes.

## Never scripted

Edem (2026-11-07): Fenny kept saying the same thing when they didn't know, and "Ooh" opened every call. Fenny should sound like a free flowing conversation, not a script.

- The model words almost every line itself, including the Teach me offer (it only has to say the button's name, "Teach me"), the yes to it, and the kind goodbye when a bit is new to them.
- Lines code must be sure of (backups, the goal on the first turn, progress, the retell request, the final summary) come from small banks. `pickFresh` never picks one Fenny said lately, and a seed from the call picks differently each call.
- `noRepeatOpener` drops an opening "Ooh," "No worries," or "That's fine." that Fenny used in one of its last six lines.
- The spoken reaction is optional: Fenny's face shows how the answer landed, so many lines go straight to the question.
- The phone hands each line's move back (`move` on Fenny's turns, from `done.move`), so the engine keeps its place without relying on fixed wording. Older phones still work: the move is guessed from the words.
- The phone's opening line is picked from a few each call. Camera mode's first reaction is written fresh for the thing.

Test (12 turns, 30 calls each, same harness): before, 30 of 187 lines had "Ooh" (every call opened "Ooh, OK") and 16% of lines repeated an earlier opening or sentence; after, 0 "Ooh" and 0% repeats, naturalness 3.93 to 4.07, annoying 1/30 to 0/30, leaked 1/30 to 0/30. Transcripts in project files, engine-tests/variety-*.json.

## Lines the voices can read

Every line Fenny says goes through `speakable()` (`apps/api/src/speakable.ts`) before any voice gets it. Em and en dashes, semicolons, markdown and emoji make the voices, Phonon above all, lose the shape of the sentence and the inflection goes wrong. Dashes become commas, number ranges become "5 to 10", and symbols are removed. The prompts also ask for proper sentences with no dashes. Before this rule, 15 of 287 lines in the test calls had a dash; after it, 0 of 240.

## After the call

The transcript of the first turn that ends in `wrap` is the learner's answer
to "which bit felt shakiest?", so the results skip the typed question. Key
ideas never in `covered` go to `/api/analyse` as `missedIdeas`, to seed
"skipped" gaps.

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

## A clear goal, a clear end, and how it landed

Edem's feedback (2026-11-06): the calls felt like an endless run of questions, with no goal, no end in sight, and no idea whether an answer was right.

- **Goal up front.** The key ideas are now 3 or 4, and each one has a short label that doesn't give the answer away ("why the heart has valves"). On the learner's first turn Fenny says what it wants to understand: "By the end I want to understand three things: a, b and c."
- **How it landed.** Every turn the model gives a verdict (right, partly, off or none) and opens its line with a matching reaction, without ever saying the answer. If the opener repeats one of Fenny's recent openers, code swaps in a fresh one for the same verdict. The verdict also goes to the phone in the `engine` event.
- **Progress you can hear.** Code counts the covered ideas. When another one is done, Fenny says "That's two of the three things." Code reads back the last count from Fenny's own lines, so the server stays stateless.
- **A clear end.** Once every idea is covered, Fenny asks for the 30 second retell straight away ("That's all three things I wanted to understand..."). After the shakiest-bit question the call always ends. The goodbye is built in code: what they explained well, and the shaky bit for next time.

30 simulated calls of up to 14 turns: 29 of 30 ended by themselves, the median was 6 learner turns, none were annoying, nag 1.17, natural 4.07.
