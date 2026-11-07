import { describe, expect, it } from "vitest";
import { allowedMoves, callState, DEFAULT_LIMITS, isVague, LEARN_FIRST_LINE, moveOf, OFFER_LINE, OFFER_TEACH_LINE, TEACH_LINE, unfinished } from "../src/engine/policy";
import { engineTurn, freshReaction, goalLine, noOoh, lastProgress, noRepeatOpener, OFFER_TEACH_LINES, oneQuestion, pickFresh, withProgress } from "../src/engine/engine";
import { keyIdeas } from "../src/engine/ideas";
import type { PastTurn } from "../src/gemini";

const L = (text: string): PastTurn => ({ speaker: "learner", text });
const F = (text: string): PastTurn => ({ speaker: "student", text });
function fakeChat(reply: object) {
  return (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), {
      status: 200,
    })) as unknown as typeof fetch;
}
const cfg = (reply: object) => ({ apiKey: "k", model: "m", fetchImpl: fakeChat(reply) });
const ideas = [
  { id: "k1", idea: "The heart pumps blood", label: "what the heart does" },
  { id: "k2", idea: "Valves stop backflow", label: "why the heart has valves" },
];

describe("engine limits", () => {
  it("never probes two turns running", () => {
    const s = callState([L("The heart pumps blood."), F("Why does it need to pump so hard?")], "Because the body is big.");
    expect(allowedMoves(s)).not.toContain("why");
    expect(allowedMoves(s)).not.toContain("what_if");
  });

  it("stops asking as soon as they clearly don't know, and offers to teach", () => {
    const h = [L("Blood goes back through veins."), F("What stops it flowing backwards?")];
    const teach = { ...DEFAULT_LIMITS, canTeach: true };
    const showMe = { ...DEFAULT_LIMITS, canShowMe: true };
    for (const t of ["I don't know.", "No clue, I've never learnt this.", "I don't really understand it.", "I'm lost."]) {
      expect(allowedMoves(callState(h, t), teach), t).toEqual(["offer_teach"]);
      expect(allowedMoves(callState(h, t), showMe), t).toEqual(["offer_show_me"]);
      expect(allowedMoves(callState(h, t)), t).toEqual(["let_go"]);
    }
    // Never "a smaller question about the same thing".
    expect(allowedMoves(callState(h, "I don't know."))).not.toContain("simpler");
    // Two empty answers in a row count too; a short real one does not.
    const h2 = [...h, L("Um."), F("What's inside a vein?")];
    expect(allowedMoves(callState(h2, "Erm..."), teach)).toEqual(["offer_teach"]);
    expect(allowedMoves(callState([...h, L("Valves."), F("Ooh, and where are they?")], "Veins."), teach)).not.toEqual(["offer_teach"]);
  });

  it("moves on once, then stops the call so they can learn it first", () => {
    const h = [L("Not sure."), F("No worries, let's come back to that. What does the heart do?"), L("Pumps blood."), F("Where does it pump it to?")];
    expect(allowedMoves(callState(h, "No idea."))).toEqual(["wrap"]);
    expect(moveOf(LEARN_FIRST_LINE)).toBe("wrap");
  });

  it("opens teach mode when they say yes to Teach me, and never offers it twice running", () => {
    const h = [L("I don't know."), F(OFFER_TEACH_LINE)];
    expect(moveOf(OFFER_TEACH_LINE)).toBe("offer_teach");
    expect(moveOf(TEACH_LINE)).toBe("teach");
    const teach = { ...DEFAULT_LIMITS, canTeach: true };
    expect(allowedMoves(callState(h, "Yes please."), teach)).toEqual(["teach"]);
    expect(allowedMoves(callState(h, "Still no idea."), teach)).toEqual(["let_go"]);
    expect(allowedMoves(callState([], "Can you just tell me?"), teach)).toEqual(["offer_teach"]);
  });

  it("shows the explanation when they accept the offer or ask to be told", () => {
    const h = [L("Not sure."), F(`No worries. ${OFFER_LINE}`)];
    expect(allowedMoves(callState(h, "Yeah go on."))).toEqual(["show_me"]);
    expect(allowedMoves(callState(h, "No, let me try."))).toEqual(["let_go"]);
    const limits = { ...DEFAULT_LIMITS, canShowMe: true };
    expect(allowedMoves(callState([], "Can you just tell me what Km is?"), limits)).toEqual(["show_me"]);
  });

  it("asks for the 30 second retell late in the call, then closes", () => {
    const h: PastTurn[] = [];
    for (let i = 0; i < 11; i++) h.push(L(`Point ${i} about the heart and blood.`), F(`So how does part ${i} connect to the lungs then?`));
    expect(allowedMoves(callState(h, "And that's about it."))).toEqual(["retell"]);
    const h2 = [...h, L("That's it."), F("Thanks. Can you explain the whole thing again in 30 seconds, really simply?")];
    expect(allowedMoves(callState(h2, "The heart pumps blood round and valves keep it one way."))).toEqual(["close"]);
  });

  it("thanks them and stops once they say which bit felt shakiest", () => {
    const h = [L("Short version."), F("That was clear. Which bit felt shakiest to you?")];
    expect(allowedMoves(callState(h, "Probably the Km part."))).toEqual(["wrap"]);
    expect(allowedMoves(callState(h, "Can we skip that?"))).toEqual(["wrap"]);
    expect(moveOf("Thanks, that's a good place to stop. We'll pick it up next time.")).toBe("wrap");
    const h2 = [...h, L("Probably the Km part."), F("Thanks, that's a good place to stop. We'll pick it up next time.")];
    expect(allowedMoves(callState(h2, "See you next time!"))).toEqual(["wrap"]);
    expect(allowedMoves(callState(h2, "Actually wait, I want to have another go at why a low Km means the enzyme binds tightly."))).not.toContain("wrap");
  });

  it("waits for the retell before closing", () => {
    const h = [L("That's it."), F("Thanks. Can you explain the whole thing again in 30 seconds, really simply?")];
    expect(allowedMoves(callState(h, "Ooh, give me a sec."))).toEqual(["listen"]);
    expect(allowedMoves(callState(h, "Hang on, give me a moment to think about it."))).toEqual(["listen"]);
    expect(allowedMoves(callState(h, "Hang on, I need a little more time to think."))).toEqual(["listen"]);
    expect(allowedMoves(callState(h, "Um, I need a bit more time."))).toEqual(["listen"]);
    expect(allowedMoves(callState(h, "Well, I need a little more time to think about it."))).toEqual(["listen"]);
    expect(allowedMoves(callState(h, "You need more time to heat the water up, so it boils later."))).toEqual(["close"]);
    expect(allowedMoves(callState(h, "Hang on, electricity flows through the circuit, the switch breaks it and the bulb goes out."))).toEqual(["close"]);
    const h2 = [...h, L("Ooh, give me a sec."), F("Mm, take your time."), L("Okay."), F("Go on.")];
    expect(allowedMoves(callState(h2, "Erm."))).toEqual(["close"]);
  });

  it("still retells at turn 12 when only part of the call is sent to the model", () => {
    const h: PastTurn[] = [];
    for (let i = 0; i < 11; i++) h.push(L(`Point ${i} about the heart and blood.`), F(`So how does part ${i} connect to the lungs then?`));
    expect(allowedMoves(callState(h.slice(-20), "And that's about it."))).not.toEqual(["retell"]);
    expect(allowedMoves(callState(h, "And that's about it."))).toEqual(["retell"]);
  });

  it("does not mistake the word pass for being stuck", () => {
    expect(callState([], "Blood can pass through the valve.").stuckStreak).toBe(0);
  });

  it("moves on when they ask to skip, but not when they say don't skip", () => {
    const h = [L("Valves."), F("What do the valves do?")];
    for (const t of ["I'd like to skip this one, please.", "I'd like to skip this one.", "I would like to move on.", "Pass.", "I'll pass on that one.", "Can we skip that?", "Let's move on.", "Skip this one please."])
      expect(allowedMoves(callState(h, t)), t).toEqual(["let_go"]);
    expect(callState(h, "Don't skip this one, I can explain it.").skipRequested).toBe(false);
    expect(callState(h, "The heart doesn't skip a beat because the valves work.").skipRequested).toBe(false);
    expect(callState(h, "We skip that step because it's optional.").skipRequested).toBe(false);
    expect(callState(h, "I want to pass the exam by teaching you about the heart.").skipRequested).toBe(false);
    expect(callState(h, "I want to pass on this one.").skipRequested).toBe(true);
    expect(allowedMoves(callState(h, "We skip that step because it's optional."))).not.toEqual(["simpler"]);
  });

  it("does not repeat the last move and keeps listening rare", () => {
    const s = callState([L("The heart pumps."), F("Mm, go on.")], "It has four chambers.");
    expect(allowedMoves(s)).not.toContain("listen");
    expect(moveOf("Ooh, and what happens to the blood after the lungs?")).toBe("next");
  });

  it("spots vague questions and keeps one question", () => {
    expect(isVague("What do you mean by that?")).toBe(true);
    expect(isVague("Which bit goes to the lungs?")).toBe(true);
    expect(isVague("Why would it go to the lungs first?")).toBe(false);
    expect(oneQuestion("Where does it go? And why?")).toBe("Where does it go?");
  });
});

describe("engineTurn", () => {

  it("replaces a vague line with a safe one for the move", async () => {
    const r = await engineTurn(cfg({ move: "next", say: "What do you mean by pumps?", covered: ["k1", "zz"], stuck_on: "" }), {
      transcript: "The heart pumps blood.",
      history: [],
      topic: "Circulation",
      ideas,
    });
    expect(isVague(r.say)).toBe(false);
    expect(r.covered).toEqual(["k1"]);
  });

  it("falls back to an allowed move if the model picks another", async () => {
    const r = await engineTurn(cfg({ move: "why", say: "Why?", covered: [], stuck_on: "" }), {
      transcript: "I don't know.",
      history: [L("Valves."), F("What do valves do?")],
      topic: "Circulation",
      ideas,
    });
    expect(r.move).toBe("let_go");
  });

  it("says the offer in fixed words so a yes next turn is understood", async () => {
    const h = [L("I don't know."), F("That's fine. What's inside a vein?")];
    const r = await engineTurn(cfg({ move: "offer_show_me", say: "Would you like a short explanation first?", covered: [], stuck_on: "k2" }), {
      transcript: "No idea.",
      history: h,
      topic: "Circulation",
      ideas,
      limits: { canShowMe: true },
    });
    expect(r.say).toContain(OFFER_LINE);
    expect(allowedMoves(callState([...h, L("No idea."), F(r.say)], "Yes please."))).toEqual(["show_me"]);
  });

  it("stops the call kindly when a second bit is new to them, and says why", async () => {
    const h = [L("Not sure."), F("No worries, let's come back to that. What does the heart do?"), L("Pumps blood."), F("Where does it pump it to?")];
    const r = await engineTurn(cfg({ move: "wrap", say: "Thanks, that's a good place to stop.", covered: [], stuck_on: "" }), { transcript: "No idea.", history: h, topic: "Circulation", ideas });
    expect(r.move).toBe("wrap");
    expect(moveOf(r.say)).toBe("wrap");
    expect(r.say).toMatch(/notes|read/);
    // The model's own words are kept when they say why.
    const own = "That's fine, it's new to you. Have a look at your notes and teach me next time.";
    const r2 = await engineTurn(cfg({ move: "wrap", say: own, covered: [], stuck_on: "" }), { transcript: "No idea.", history: h, topic: "Circulation", ideas });
    expect(r2.say).toBe(own);
    expect(LEARN_FIRST_LINE).toMatch(/come back and teach me/);
  });

  it("lets the model word the Teach me offer, as long as it names the button", async () => {
    const own = "Ah, that's fine, valves are new to you. Tap Teach me, then come back and tell me.";
    const r = await engineTurn(cfg({ move: "offer_teach", say: own, covered: [], stuck_on: "k1" }), {
      transcript: "I don't know.", history: [L("Valves."), F("What do valves do?")], topic: "Circulation", ideas, limits: { canTeach: true },
    });
    expect(r.say).toBe(own);
    expect(r.gap?.title).toBe(ideas[0].idea);
    expect(moveOf(r.say)).toBe("offer_teach");
    // No button named: a fresh line from the bank, never the one said last time.
    const r2 = await engineTurn(cfg({ move: "offer_teach", say: "Want me to teach you?", covered: [], stuck_on: "k1" }), {
      transcript: "I don't know.", history: [L("Valves."), F(OFFER_TEACH_LINE), L("Okay."), F("What do valves do?")], topic: "Circulation", ideas, limits: { canTeach: true },
    });
    expect(OFFER_TEACH_LINES).toContain(r2.say);
    expect(r2.say).not.toBe(OFFER_TEACH_LINE);
  });

  it("never offers Teach me the same way or more than twice when they keep not taking it", () => {
    const teach = { ...DEFAULT_LIMITS, canTeach: true };
    const h = [L("I don't know."), F(OFFER_TEACH_LINES[1]), L("The heart pumps."), F("Where to?"), L("Not sure."), F(OFFER_TEACH_LINES[2]), L("Lungs."), F("Why there?")];
    expect(allowedMoves(callState(h, "No idea."), teach)).toEqual(["let_go"]);
    expect(allowedMoves(callState(h.slice(0, 4), "No idea."), teach)).toEqual(["offer_teach"]);
  });

  it("hears carrying on after an offer as carrying on, not a yes", () => {
    const h = [L("I don't know."), F(OFFER_TEACH_LINE)];
    expect(callState(h, "Okay, the leaves have chlorophyll which catches the light.").answeredOffer).toBeUndefined();
    expect(callState(h, "Okay, go on then.").answeredOffer).toBe("yes");
  });

  it("uses the move the phone hands back over guessing from the words", () => {
    const s = callState([L("I don't know."), { speaker: "student", text: "Fair play. Have a go at the lesson button.", move: "offer_teach" }], "Yes please.");
    expect(s.lastMove).toBe("offer_teach");
    expect(allowedMoves(s, { ...DEFAULT_LIMITS, canTeach: true })).toEqual(["teach"]);
  });

  it("drops an opener Fenny used lately, and picks lines it hasn't said", () => {
    expect(noRepeatOpener("Ooh, where does it go?", ["Ooh, nice. Why?"])).toBe("Where does it go?");
    expect(noRepeatOpener("Ooh — so where?", ["Okay. Ooh, that's clever."])).toBe("So where?");
    expect(noRepeatOpener("Ooh, where does it go?", ["Why?"])).toBe("Ooh, where does it go?");
    expect(pickFresh(["a.", "b."], ["a."], 0)).toBe("b.");
    expect(noOoh("Ooh, where does it go? Oooh. Nice.")).toBe("Where does it go? Nice.");
  });

  it("keys the ideas cache on the whole notes, and counts the cost once", async () => {
    let calls = 0;
    const f = (async () => {
      calls++;
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ideas: [{ idea: `idea ${calls}` }] }) } }], usage: { prompt_tokens: 9 } }));
    }) as unknown as typeof fetch;
    const c = { apiKey: "k", model: "m", fetchImpl: f };
    const a = await keyIdeas(c, "Cache test", "aaaa");
    const b = await keyIdeas(c, "Cache test", "bbbb");
    const again = await keyIdeas(c, "Cache test", "aaaa");
    expect(a.ideas[0].idea).not.toBe(b.ideas[0].idea);
    expect(a.usage).toBeDefined();
    expect(again).toEqual({ ideas: a.ideas });
    expect(calls).toBe(2);
  });
});

describe("unfinished", () => {
  it("spots a learner who stopped mid-thought", () => {
    for (const t of ["It moves across the membrane and.", "Because the water, um", "It goes from high to low because", "So the cell is,", "It's like the...", "and then the", "The thing is"])
      expect(unfinished(t), t).toBe(true);
  });

  it("lets a finished thought through", () => {
    for (const t of ["Water moves from dilute to concentrated.", "I think so.", "I'd like that.", "It's a bit like a sponge.", "Yes", "Not sure, to be honest.", "", "What do I do then?"])
      expect(unfinished(t), t).toBe(false);
  });

  it("heads for the retell as soon as every key idea is covered", async () => {
    const r = await engineTurn(cfg({ move: "why", verdict: "right", say: "Why do valves matter?", covered: ["k1", "k2"], stuck_on: "" }), {
      transcript: "Valves stop the blood flowing backwards.",
      history: [L("The heart pumps blood."), F("Ooh, what keeps it going one way?")],
      topic: "Circulation",
      ideas,
    });
    expect(r.move).toBe("retell");
    expect(r.say).toMatch(/whole thing again in (about )?30 seconds/);
    expect(r.verdict).toBe("right");
    expect(moveOf(r.say)).toBe("retell");
  });

  it("ends with what they explained well and the shaky bit", async () => {
    const h = [L("The heart pumps blood."), F("That was really clear. Which bit felt shakiest to you?")];
    const r = await engineTurn(cfg({ move: "wrap", verdict: "none", say: "Bye!", covered: ["k1"], stuck_on: "" }), { transcript: "The valves bit.", history: h, topic: "Circulation", ideas });
    expect(r.move).toBe("wrap");
    expect(r.say).toMatch(/ You explained what the heart does really well\. Why the heart has valves was the shaky bit, so we'll pick it up next time\.$/);
    // Read back as the goodbye, even though it names a "why".
    expect(moveOf(r.say)).toBe("wrap");
  });

  it("says the goal up front on their first turn, and treats a missing verdict as none", async () => {
    const r = await engineTurn(cfg({ move: "next", say: "Ooh, and where does it go next?", covered: [], stuck_on: "" }), { transcript: "The heart pumps blood.", history: [], topic: "Circulation", ideas });
    expect(r.say).toMatch(/what the heart does and why the heart has valves\. And where does it go next\?$/);
    expect(r.say).not.toMatch(/ooh/i);
    // The goal is worded differently from call to call.
    expect(new Set([0, 1, 2, 3, 4].map((n) => goalLine(ideas, n))).size).toBe(5);
    expect(r.verdict).toBe("none");
  });

  it("swaps a repeated reaction for a fresh one with the same verdict", () => {
    const recent = ["That makes sense to me now. Why do valves shut?"];
    const r = freshReaction("That makes sense to me now. Where does it go next?", "right", recent, 0);
    expect(r).toBe("Oh, that makes sense. Where does it go next?");
    expect(freshReaction("Ooh, where next?", "right", recent, 0)).toBe("Ooh, where next?");
  });

  it("counts progress in code and says it only when another idea is done", () => {
    expect(withProgress("Ah, I get it now. What do valves do?", 2, 4, 2)).toBe("Ah, I get it now. That's two of the four things. What do valves do?");
    // Every wording reads back.
    for (let seed = 0; seed < 4; seed++) expect(lastProgress([F(withProgress("Nice. Why?", 3, 4, seed)), L("Because.")])).toBe(3);
    expect(lastProgress([F("Oh nice. That's two of the four things. Why?"), L("Because.")])).toBe(2);
    expect(lastProgress([F("So is it one of the two valves?")])).toBe(0);
    expect(lastProgress([F("Why?")])).toBe(0);
  });

  it("always ends after the shakiest-bit question, even if they ask to be shown", () => {
    const s = callState([L("The heart pumps."), F("That was really clear. Which bit felt shakiest to you?")], "The valves, can you show me?");
    expect(allowedMoves(s, { ...DEFAULT_LIMITS, canShowMe: true, canTeach: true })).toEqual(["wrap"]);
  });
});
