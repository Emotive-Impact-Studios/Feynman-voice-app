// Live call mode: the microphone stays open for the whole call. When the
// learner goes quiet, their turn is sent; the student's reply streams back
// and is spoken sentence by sentence; when it finishes, listening starts again.
// The learner can talk over the student (or tap) to cut in.
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from "expo-audio";
import { BargeIn, concatFloat32, EndOfTurn, fromBase64, pcm16ToFloat32, quietAfter, Resampler, SpeechMeter, toBase64, TURN_QUIET_SECONDS } from "@feynman/audio";
import { encodeWav, SAMPLE_RATE as KITTEN_RATE, synthesise } from "@feynman/kitten-tts";
import { Phonon, PHONON_DEFAULT_VOICE } from "../../modules/phonon";
import { PHONON_BUNDLE_URL, streamLiveTurn, type LiveEars, type LiveEvent, type LiveVoice, type Turn } from "../api";
import { loadKitten } from "../kitten";
import { ClipQueue } from "./clipQueue";

const RATE = 16000;
const MAX_TURN_SECONDS = 60;
const KITTEN_VOICE = "Kiki";
const KITTEN_SPEED = 1;

export type CallPhase = "loading" | "ready" | "listening" | "thinking" | "speaking" | "error";

export interface CallSettings {
  voice: LiveVoice;
  ears: LiveEars;
}

export interface CallTurnStats {
  voice: LiveVoice;
  ears: "openai" | "cartesia";
  speakingSeconds: number;
  pence: number;
  /** From the learner going quiet to the student's first sound. */
  firstWordMs: number;
  transcribeMs: number;
  brainMs: number;
}

/** Phonon runs on iPhone builds only. Elsewhere the on-device voice is Kitten. */
export const phononAvailable = Platform.OS === "ios" && Phonon != null;

export function useLiveCall(topic: string, settings: CallSettings) {
  const [phase, setPhaseState] = useState<CallPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [stats, setStats] = useState<CallTurnStats[]>([]);
  const [liveQuestion, setLiveQuestion] = useState<string | null>(null);
  const [liveSpeaking, setLiveSpeaking] = useState(0);
  const [isTalking, setIsTalking] = useState(false);

  const phaseRef = useRef<CallPhase>("loading");
  const setPhase = useCallback((p: CallPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;

  // Microphone state for the turn being heard.
  const parts = useRef<Float32Array[]>([]);
  const resampler = useRef<Resampler | null>(null);
  const resamplerRate = useRef(0);
  const meter = useRef(new SpeechMeter());
  const endOfTurn = useRef(new EndOfTurn());
  // Quiet that ends the learner's next turn: longer after a "why" or "how".
  const nextQuiet = useRef(TURN_QUIET_SECONDS);
  const bargeIn = useRef(new BargeIn());
  // While thinking, the learner may carry on talking: then the turn was not over.
  const carryOn = useRef(new BargeIn(0.015, 0.4));

  // Bumped whenever a reply is abandoned (cut in, carried on, ended). Async
  // work checks it after each await and drops out if it has changed.
  const turnId = useRef(0);
  const request = useRef<AbortController | null>(null);
  const clips = useRef(new ClipQueue());
  const phononReady = useRef(false);
  const callOn = useRef(false);
  // Speaking seconds of every turn the server has heard, counted when its
  // transcript arrives, so ending mid-reply still keeps them.
  const [heardSeconds, setHeardSeconds] = useState(0);

  const onBuffer = useCallback((buf: AudioStreamBuffer) => {
    let samples = new Float32Array(buf.data);
    if (buf.channels > 1) samples = samples.filter((_, i) => i % buf.channels === 0);
    // A new audio route can bring a new rate: start a fresh resampler then.
    if (!resampler.current || resamplerRate.current !== buf.sampleRate) {
      resampler.current = new Resampler(buf.sampleRate, RATE);
      resamplerRate.current = buf.sampleRate;
    }
    const down = resampler.current.push(samples);
    const seconds = down.length / RATE;
    const p = phaseRef.current;
    if (p === "listening") {
      parts.current.push(down);
      const speech = meter.current.push(down, RATE);
      setIsTalking(speech);
      setLiveSpeaking(meter.current.speakingSeconds);
      const tooLong = meter.current.totalSeconds >= MAX_TURN_SECONDS;
      if (endOfTurn.current.push(speech, seconds) || tooLong) submitRef.current();
    } else if (p === "thinking") {
      parts.current.push(down);
      const speech = meter.current.push(down, RATE);
      if (carryOn.current.push(down, RATE) && speech) resumeListening(false);
    } else if (p === "speaking") {
      if (bargeIn.current.push(down, RATE)) interruptRef.current(down);
    }
  }, []);

  const { stream, isStreaming } = useAudioStream({ sampleRate: RATE, channels: 1, encoding: "float32", onBuffer });
  const streamRef = useRef(stream);
  streamRef.current = stream;

  // The microphone can stop on its own mid-call, if iOS changes the audio
  // route and it cannot come back. Try once to open it again; otherwise say
  // so, rather than sit "listening" to nothing. Ending the call clears
  // callOn first, so that stop is never mistaken for this.
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (isStreaming) {
      wasStreaming.current = true;
      return;
    }
    if (!wasStreaming.current || !callOn.current) return;
    wasStreaming.current = false;
    resampler.current = null;
    // A turn already sent (thinking or speaking) carries on: only the mic
    // comes back. A half-heard turn starts again.
    const wasListening = phaseRef.current === "listening";
    Promise.resolve()
      .then(() => streamRef.current.start())
      .then(() => {
        // Ended while the mic was reopening: close it again.
        if (!callOn.current) return streamRef.current.stop();
        if (wasListening && phaseRef.current === "listening") freshTurn();
      })
      .catch(() => {
        if (!callOn.current) return;
        callOn.current = false;
        silence();
        setError("The microphone stopped. End the call and start it again.");
        setPhase("error");
      });
  }, [isStreaming]);

  /** Fresh buffers for a new turn. `keep` carries audio over (cutting in). */
  const freshTurn = (keep?: Float32Array) => {
    parts.current = keep ? [keep] : [];
    meter.current = new SpeechMeter();
    if (keep) meter.current.push(keep, RATE);
    endOfTurn.current.reset();
    endOfTurn.current.setSilence(nextQuiet.current);
    bargeIn.current.reset();
    carryOn.current.reset();
    setLiveSpeaking(meter.current.speakingSeconds);
  };

  /** Stop the student talking and drop any reply in flight. */
  const silence = () => {
    turnId.current += 1;
    request.current?.abort();
    request.current = null;
    clips.current.stop();
    if (phononReady.current) Phonon?.stop();
  };

  /** Back to listening. `fresh` starts a new turn; otherwise the current one continues. */
  function resumeListening(fresh: boolean) {
    silence();
    if (fresh) freshTurn();
    else endOfTurn.current.reset();
    setLiveQuestion(null);
    setPhase("listening");
  }

  // Load what the chosen voice needs. Phonon downloads its model once (about 150 MB).
  const prepareVoice = useCallback(async (voice: LiveVoice) => {
    if (voice === "phonon" && phononAvailable && !phononReady.current) {
      setNotice("Getting the voice ready");
      const sub = Phonon!.addListener("onProgress", ({ fraction }) =>
        setNotice(fraction < 1 ? `Downloading the voice, ${Math.round(fraction * 100)}%` : "Preparing the voice"),
      );
      try {
        if (!PHONON_BUNDLE_URL) throw new Error("Set EXPO_PUBLIC_API_URL to download the voice");
        await Phonon!.prepare(PHONON_BUNDLE_URL, PHONON_DEFAULT_VOICE);
        phononReady.current = true;
      } finally {
        sub.remove();
        setNotice(null);
      }
    }
    if (voice === "kitten" || (voice === "phonon" && !phononAvailable)) await loadKitten();
  }, []);

  useEffect(() => {
    const id = turnId.current;
    (async () => {
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) throw new Error("Microphone permission is needed for a call.");
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await prepareVoice(settingsRef.current.voice);
        if (id !== turnId.current) return;
        setPhase("ready");
      } catch (e) {
        if (id !== turnId.current) return;
        setError(message(e));
        setPhase("error");
      }
    })();
  }, [prepareVoice, setPhase]);

  // Switching voice mid-call: get it ready in the background.
  useEffect(() => {
    if (phaseRef.current === "loading") return;
    prepareVoice(settings.voice).catch((e) => setError(message(e)));
  }, [settings.voice, prepareVoice]);

  /** Start the call: open the microphone and listen. */
  const start = useCallback(async () => {
    setError(null);
    nextQuiet.current = TURN_QUIET_SECONDS;
    freshTurn();
    resampler.current = null;
    await streamRef.current.start();
    callOn.current = true;
    setPhase("listening");
  }, [setPhase]);

  /** Send the turn heard so far. Runs on its own when the learner goes quiet. */
  const submit = async () => {
    if (phaseRef.current !== "listening") return;
    if (!endOfTurn.current.hasSpeech && meter.current.speakingSeconds < 0.6) {
      freshTurn(); // nothing worth sending
      return;
    }
    const id = ++turnId.current;
    setPhase("thinking");
    setIsTalking(false);
    const quietAt = Date.now();
    const pcm = concatFloat32(parts.current).subarray(0, MAX_TURN_SECONDS * RATE);
    const speakingSeconds = meter.current.speakingSeconds;
    const chosen = settingsRef.current;
    // Without Phonon (Android) the on-device voice is Kitten.
    const voice: LiveVoice = chosen.voice === "phonon" && !phononReady.current ? "kitten" : chosen.voice;

    let firstWordMs = 0;
    let done: Extract<LiveEvent, { type: "done" }> | null = null;
    let spoken = "";
    let voiced: Promise<unknown> = Promise.resolve();
    let phononRemaining = 0;
    const markStart = () => {
      if (id !== turnId.current) return;
      if (!firstWordMs) firstWordMs = Date.now() - quietAt;
      if (phaseRef.current === "thinking") setPhase("speaking");
    };
    clips.current.onStart = markStart;

    const onEvent = (e: LiveEvent) => {
      if (id !== turnId.current) return;
      if (e.type === "sentence") {
        spoken = spoken ? `${spoken} ${e.text}` : e.text;
        setLiveQuestion(spoken);
        // Known as soon as it's said, so cutting in mid-question still gets it.
        nextQuiet.current = quietAfter(spoken);
        if (voice === "phonon") {
          voiced = voiced.then(async () => {
            if (id !== turnId.current) return;
            markStart();
            const r = await Phonon!.speak(e.text);
            phononRemaining = r.remainingMs;
          });
        } else if (voice === "sonic" && e.audio) {
          clips.current.add(pcm16ToFloat32(fromBase64(e.audio)), e.sampleRate ?? 24000);
        } else if (e.speech) {
          const speech = e.speech;
          voiced = voiced.then(async () => {
            const { runner, voices } = await loadKitten();
            if (id !== turnId.current) return;
            clips.current.add(await synthesise(runner, voices, speech, KITTEN_VOICE, KITTEN_SPEED), KITTEN_RATE);
          });
        }
      }
      if (e.type === "done") {
        done = e;
        nextQuiet.current = quietAfter(e.question);
        setHeardSeconds((n) => n + speakingSeconds);
        setTurns((t) => [...t, { speaker: "learner", text: e.transcript }, { speaker: "student", text: e.question }]);
      }
      if (e.type === "error") throw new Error(e.error);
    };

    try {
      const abort = new AbortController();
      request.current = abort;
      await streamLiveTurn(
        { audioBase64: toBase64(encodeWav(pcm, RATE)), audioSeconds: speakingSeconds, history: turnsRef.current, topic, voice, ears: chosen.ears },
        onEvent,
        abort.signal,
      );
      request.current = null;
      await voiced;
      if (voice === "phonon") await wait(phononRemaining);
      else await clips.current.whenIdle();
      if (id !== turnId.current) return;
      const d = done as Extract<LiveEvent, { type: "done" }> | null;
      if (d) {
        setStats((s) => [
          ...s,
          {
            voice,
            ears: d.stt,
            speakingSeconds,
            pence: d.cost.pence,
            firstWordMs,
            transcribeMs: d.timingMs.transcribe,
            brainMs: d.timingMs.brain,
          },
        ]);
      }
      resumeListening(true);
    } catch (e) {
      if (id !== turnId.current) return; // cut in or ended: not an error
      setError(message(e));
      resumeListening(true);
    }
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  /** The learner talked over the student: stop and hear them. */
  const interrupt = (heard?: Float32Array) => {
    if (phaseRef.current !== "speaking" && phaseRef.current !== "thinking") return;
    silence();
    freshTurn(heard);
    setLiveQuestion(null);
    setPhase("listening");
  };
  const interruptRef = useRef(interrupt);
  interruptRef.current = interrupt;

  /** End the call: microphone off, reply dropped. Safe to call twice. Runs on unmount. */
  const cancel = useCallback(() => {
    silence();
    if (callOn.current) {
      callOn.current = false;
      streamRef.current.stop();
    }
    if (phaseRef.current !== "loading" && phaseRef.current !== "error") setPhase("ready");
  }, [setPhase]);
  useEffect(() => cancel, [cancel]);

  return {
    phase,
    error,
    notice,
    turns,
    /** Speaking seconds of every turn the student has heard. */
    heardSeconds,
    stats,
    liveQuestion,
    liveSpeaking,
    isTalking,
    start,
    /** "Done, ask me": send now instead of waiting for the pause. */
    finish: () => submitRef.current(),
    interrupt: () => interruptRef.current(),
    cancel,
  };
}

function message(e: unknown) {
  return String(e instanceof Error ? e.message : e);
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
