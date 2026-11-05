// Plays the student's sentences one after another, for voices that arrive as
// whole clips (Sonic from the server, Kitten made on the phone).
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { encodeWav } from "@feynman/kitten-tts";

export class ClipQueue {
  private queue: File[] = [];
  private playing: { player: AudioPlayer; file: File } | null = null;
  private idle: (() => void)[] = [];
  /** Called when the first clip of a reply starts playing. */
  onStart?: () => void;
  private started = false;

  add(samples: Float32Array, sampleRate: number): void {
    const file = new File(Paths.cache, `student-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    file.write(encodeWav(samples, sampleRate));
    this.queue.push(file);
    if (!this.playing) this.next();
  }

  /** Resolves once everything queued has played (or the queue was stopped). */
  whenIdle(): Promise<void> {
    if (!this.playing && this.queue.length === 0) return Promise.resolve();
    return new Promise((r) => this.idle.push(r));
  }

  stop(): void {
    this.release();
    for (const f of this.queue) safeDelete(f);
    this.queue = [];
    this.started = false;
    this.settle();
  }

  private next(): void {
    this.release();
    const file = this.queue.shift();
    if (!file) {
      this.started = false;
      this.settle();
      return;
    }
    // Keep the audio session on between clips: the mic is still streaming.
    const player = createAudioPlayer(file.uri, { keepAudioSessionActive: true });
    this.playing = { player, file };
    player.addListener("playbackStatusUpdate", (s) => {
      if (s.didJustFinish && this.playing?.player === player) this.next();
    });
    player.play();
    if (!this.started) {
      this.started = true;
      this.onStart?.();
    }
  }

  private release(): void {
    const p = this.playing;
    this.playing = null;
    if (!p) return;
    try {
      p.player.pause();
      p.player.release();
    } catch {
      // Already released.
    }
    safeDelete(p.file);
  }

  private settle(): void {
    const waiting = this.idle;
    this.idle = [];
    waiting.forEach((r) => r());
  }
}

function safeDelete(f: File) {
  try {
    f.delete();
  } catch {
    // Already gone.
  }
}
