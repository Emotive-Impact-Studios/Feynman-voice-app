import { describe, expect, it } from "vitest";
import { allowedMoves, callState, isVague, moveOf, OFFER_LINE, unfinished } from "../src/engine/policy";
import { engineTurn, oneQuestion } from "../src/engine/engine";
import { keyIdeas } from "../src/engine/ideas";
import type { PastTurn } from "../src/gemini";

const L = (text: string): PastTurn => ({ speaker: "learner", text });
const F = (text: string): PastTurn => ({ speaker: "student", text });
const ideas = [{ id: "k1", idea: "The heart pumps blood" }, { id: "k2", idea: "Valves stop backflow" }];

describe("engine limits", () => {
  it("never probes two turns running", () => {
    const s = callState([L("The heart pumps blood."), F("Why does it need to pump so hard?")], "Because the body is big.");
    expect(allowedMoves(s)).not.toContain("why");
    expect(allowedMoves(s)).not.toContain("what_if");
  });

  it("goes simpler on the first don't know, then offers Show me, then lets go", () => {
    const h = [L("Blood goes back through veins."), F("What stops it flowing backwards?")];
    expect(allowedMoves(callState(h, "I don't know."))).toEqual(["simpler"]);
    const h2 = [...h, L("I don't know."), F("That's fine. What's inside a vein?")];
    expect(allowedMoves(callState(h2, "No idea, sorry."), { retellFrom: 7, retellBy: 12, canShowMe: true })).toEqual(["offer_show_me"]);
    expect(allowedMoves(callState(h2, "No idea, sorry."))).toEqual(["let_go"]);
  });

  it("shows the explanation when they accept the offer or ask to be told", () => {
    const h = [L("Not sure."), F(`No worries. ${OFFER_LINE}`)];
    expect(allowedMoves(callState(h, "Yeah go on."))).toEqual(["show_me"]);
    expect(allowedMoves(callState(h, "No, let me try."))).toEqual(["let_go"]);
    const limits = { retellFrom: 7, retellBy: 12, canShowMe: true };
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
  function fakeChat(reply: object) {
    return (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), {
        status: 200,
      })) as unknown as typeof fetch;
  }
  const cfg = (reply: object) => ({ apiKey: "k", model: "m", fetchImpl: fakeChat(reply) });

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
    expect(r.move).toBe("simpler");
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
});
