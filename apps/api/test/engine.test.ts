import { describe, expect, it } from "vitest";
import { allowedMoves, callState, isVague, moveOf, OFFER_LINE } from "../src/engine/policy";
import { engineTurn, oneQuestion } from "../src/engine/engine";
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
});
