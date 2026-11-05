// Cuts streamed text into sentences, so the voice can start on the first
// sentence while the brain is still writing the next.

const END = /[.?!…]["')\]]*\s+/g;

export class SentenceSplitter {
  private buffer = "";

  /** Add streamed text. Returns any sentences it completed. */
  push(delta: string): string[] {
    this.buffer += delta;
    const out: string[] = [];
    let start = 0;
    END.lastIndex = 0;
    for (let m = END.exec(this.buffer); m; m = END.exec(this.buffer)) {
      const end = m.index + m[0].length;
      const sentence = this.buffer.slice(start, end).trim();
      // Very short pieces ("Oh." "Hm?") sound better joined to what follows.
      if (sentence.length < 12) continue;
      out.push(sentence);
      start = end;
    }
    this.buffer = this.buffer.slice(start);
    return out;
  }

  /** Whatever is left once the stream ends. */
  flush(): string[] {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest ? [rest] : [];
  }
}
