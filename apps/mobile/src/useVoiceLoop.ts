// The whole prototype loop: listen, send, wait for the question, speak it.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAudioPlayer,
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
  geminiMs: number;
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

  useEffect(() => {
    (async () => {
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) throw new Error("Microphone permission is needed to try the prototype.");
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await loadKitten();
        setPhase("ready");
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
        setPhase("error");
      }
    })();
  }, []);

  const start = useCallback(async () => {
    parts.current = [];
    resampler.current = null;
    meter.current = new SpeechMeter();
    setLiveSpeaking(0);
    setError(null);
    await stream.start();
    setPhase("listening");
  }, [stream]);

  const finish = useCallback(async () => {
    stream.stop();
    setIsTalking(false);
    const tapped = Date.now();
    setPhase("thinking");
    try {
      let pcm = concatFloat32(parts.current);
      pcm = pcm.subarray(0, MAX_TURN_SECONDS * UPLOAD_RATE);
      const speakingSeconds = meter.current.speakingSeconds;
      const wav = encodeWav(pcm, UPLOAD_RATE);

      const reply = await sendTurn({
        audioBase64: toBase64(wav),
        audioSeconds: speakingSeconds,
        history: turns,
        topic,
      });

      const { runner, voices } = await loadKitten();
      const t0 = Date.now();
      const audio = await synthesise(runner, voices, reply.speech, VOICE);
      const ttsMs = Date.now() - t0;

      const file = new File(Paths.cache, `student-${Date.now()}.wav`);
      file.write(encodeWav(audio, SAMPLE_RATE));

      setTurns((t) => [...t, { speaker: "learner", text: reply.transcript }, { speaker: "student", text: reply.question }]);
      setStats((s) => [
        ...s,
        {
          speakingSeconds,
          recordedSeconds: pcm.length / UPLOAD_RATE,
          pence: reply.cost.pence,
          geminiMs: reply.timingMs.gemini,
          ttsMs,
          waitMs: Date.now() - tapped,
        },
      ]);

      setPhase("speaking");
      const player = createAudioPlayer(file.uri);
      player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          player.release();
          file.delete();
          setPhase("ready");
        }
      });
      player.play();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("ready");
    }
  }, [stream, turns, topic]);

  const reset = useCallback(() => {
    setTurns([]);
    setStats([]);
  }, []);

  return { phase, error, turns, stats, liveSpeaking, isTalking, start, finish, reset };
}
