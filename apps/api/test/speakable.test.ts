import { describe, expect, it } from "vitest";
import { speakable } from "../src/speakable";

describe("speakable", () => {
  it("turns em and en dashes into pauses", () => {
    expect(speakable("So the heart pumps blood — but where does it go?")).toBe("So the heart pumps blood, but where does it go?");
    expect(speakable("Oh – that makes sense.")).toBe("Oh, that makes sense.");
    expect(speakable("It splits—like a fork—into two.")).toBe("It splits, like a fork, into two.");
    expect(speakable("Right - so what happens next?")).toBe("Right, so what happens next?");
    expect(speakable("Wait -- why two?")).toBe("Wait, why two?");
  });

  it("reads number ranges as 'to'", () => {
    expect(speakable("About 5–10 seconds?")).toBe("About 5 to 10 seconds?");
    expect(speakable("From 1990 - 2000.")).toBe("From 1990 to 2000.");
  });

  it("keeps hyphens inside words", () => {
    expect(speakable("Is it a well-known idea?")).toBe("Is it a well-known idea?");
  });

  it("drops dashes at the start or end of a line", () => {
    expect(speakable("— Why does it do that?")).toBe("Why does it do that?");
    expect(speakable("Hang on —")).toBe("Hang on");
    expect(speakable("Hmm — ?")).toBe("Hmm?");
  });

  it("removes symbols and markdown the voices stumble on", () => {
    expect(speakable("So **mitosis** makes two cells?")).toBe("So mitosis makes two cells?");
    expect(speakable("Cells & tissues 🙂")).toBe("Cells and tissues");
    expect(speakable("It’s “neat”; why?")).toBe(`It's "neat", why?`);
  });

  it("leaves a clean line alone", () => {
    const line = "That was really clear. Which bit felt shakiest to you?";
    expect(speakable(line)).toBe(line);
  });
});
