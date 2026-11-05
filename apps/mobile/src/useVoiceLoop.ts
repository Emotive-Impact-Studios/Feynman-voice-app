// The whole prototype loop: listen, send, wait for the question, speak it.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAudioPlayer,
  type AudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { concatFloat32, Resampler, SpeechMeter, toBase64 } from "@feynman/audio";
import { encodeWav, SAMPLE_RATE, synthesise } from "@feynman/kitten-tts";
import { sendTurn, type Turn } from "./api";
import { loadKitten } from "./kitten";

const UPLOAD_RATE = 16000;
const MAX_TURN_SECONDS = 60;
const VOICE = "Kiki";

export type Phase = "loading" | "ready" | "listening" | "thinking" | "speaking" | "error";

export interface TurnStats {
  speakingSeconds: number;
  recordedSeconds: number;
  pence: number;
  brainMs: number;
  ttsMs: number;
  /** From tapping "done" to the student starting to speak. */
  waitMs: number;
}

export function useVoiceLoop(topic: string) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [stats, setStats] = useState<TurnStats[]>([]);
  const [liveSpeaking, setLiveSpeaking] = useState(0);
  const [isTalking, setIsTalking] = useState(false);

  const parts = useRef<Float32Array[]>([]);
  const resampler = useRef<Resampler | null>(null);
  const meter = useRef(new SpeechMeter());
  // Bumped by cancel(). Async work checks it after every await and stops if
  // it has changed, so nothing records, plays or sets state after an end.
  const generation = useRef(0);
  const listening = useRef(false);
  const request = useRef<AbortController | null>(null);
  const player = useRef<{ player: AudioPlayer; file: File } | null>(null);

  const onBuffer = useCallback((buf: AudioStreamBuffer) => {
    // Mono float32 was requested. If a device gives stereo, keep the left channel.
    let samples = new Float32Array(buf.data);
    if (buf.channels > 1) samples = samples.filter((_, i) => i % buf.channels === 0);
    resampler.current ??= new Resampler(buf.sampleRate, UPLOAD_RATE);
    const down = resampler.current.push(samples);
    parts.current.push(down);
    setIsTalking(meter.current.push(down, UPLOAD_RATE));
    setLiveSpeaking(meter.current.speakingSeconds);
  }, []);

  const { stream } = useAudioStream({ sampleRate: UPLOAD_RATE, channels: 1, encoding: "float32", onBuffer });
  // cancel() must keep one identity so the unmount cleanup runs only once.
  const streamRef = useRef(stream);
  streamRef.current = stream;

  useEffect(() => {
    const gen = generation.current;
    (async () => {
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) throw new Error("Microphone permission is needed to try the prototype.");
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await loadKitten();
        if (gen !== generation.current) return;
        setPhase("ready");
      } catch (e) {
        if (gen !== generation.current) return;
        setError(String(e instanceof Error ? e.message : e));
        setPhase("error");
      }
    })();
  }, []);

  const start = useCallback(async () => {
    const gen = generation.current;
    parts.current = [];
    resampler.current = null;
    meter.current = new SpeechMeter();
    setLiveSpeaking(0);
    setError(null);
    await stream.start();
    if (gen !== generation.current) {
      stream.stop();
      return;
    }
    listening.current = true;
    setPhase("listening");
  }, [stream]);

  const finish = useCallback(async () => {
    const gen = generation.current;
    listening.current = false;
    stream.stop();
    setIsTalking(false);
    const tapped = Date.now();
    setPhase("thinking");
    try {
      let pcm = concatFloat32(parts.current);
      pcm = pcm.subarray(0, MAX_TURN_SECONDS * UPLOAD_RATE);
      const speakingSeconds = meter.current.speakingSeconds;
      const wav = encodeWav(pcm, UPLOAD_RATE);

      const abort = new AbortController();
      request.current = abort;
      const reply = await sendTurn(
        {
          audioBase64: toBase64(wav),
          audioSeconds: speakingSeconds,
          history: turns,
          topic,
        },
        abort.signal,
      );
      request.current = null;
      if (gen !== generation.current) return;

      const { runner, voices } = await loadKitten();
      const t0 = Date.now();
      const audio = await synthesise(runner, voices, reply.speech, VOICE);
      const ttsMs = Date.now() - t0;
      if (gen !== generation.current) return;

      const file = new File(Paths.cache, `student-${Date.now()}.wav`);
      file.write(encodeWav(audio, SAMPLE_RATE));

      setTurns((t) => [...t, { speaker: "learner", text: reply.transcript }, { speaker: "student", text: reply.question }]);
      setStats((s) => [
        ...s,
        {
          speakingSeconds,
          recordedSeconds: pcm.length / UPLOAD_RATE,
          pence: reply.cost.pence,
          brainMs: reply.timingMs.brain,
          ttsMs,
          waitMs: Date.now() - tapped,
        },
      ]);

      setPhase("speaking");
      const p = createAudioPlayer(file.uri);
      player.current = { player: p, file };
      p.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          releasePlayer(player);
          setPhase("ready");
        }
      });
      p.play();
    } catch (e) {
      if (gen !== generation.current) return;
      setError(String(e instanceof Error ? e.message : e));
      setPhase("ready");
    }
  }, [stream, turns, topic]);

  /**
   * End the loop: stop the microphone, abort the pending turn, stop any
   * reply that is playing. Safe to call more than once. Also runs on unmount.
   */
  const cancel = useCallback(() => {
    generation.current += 1;
    if (listening.current) {
      listening.current = false;
      streamRef.current.stop();
    }
    request.current?.abort();
    request.current = null;
    releasePlayer(player);
  }, []);

  useEffect(() => cancel, [cancel]);

  const reset = useCallback(() => {
    setTurns([]);
    setStats([]);
  }, []);

  return { phase, error, turns, stats, liveSpeaking, isTalking, start, finish, cancel, reset };
}

function releasePlayer(ref: { current: { player: AudioPlayer; file: File } | null }) {
  const current = ref.current;
  if (!current) return;
  ref.current = null;
  try {
    current.player.pause();
    current.player.release();
  } catch {
    // Already released.
  }
  try {
    current.file.delete();
  } catch {
    // Already gone.
  }
}
