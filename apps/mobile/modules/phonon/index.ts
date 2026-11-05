// The on-device Phonon voice. Present on iPhone builds; null on Android, in
// Expo Go and on the web, where the app falls back to Kitten.
import { requireOptionalNativeModule } from "expo";

interface EventSubscription {
  remove(): void;
}

export interface SpeakResult {
  audioSeconds: number;
  firstAudioMs: number;
  /** How long until everything queued so far has played. */
  remainingMs: number;
}

interface PhononNative {
  isInstalled(): Promise<boolean>;
  prepare(baseUrl: string, voice: string): Promise<string[]>;
  setVoice(name: string): Promise<void>;
  speak(text: string): Promise<SpeakResult>;
  stop(): void;
  addListener(event: "onProgress", listener: (e: { fraction: number }) => void): EventSubscription;
}

export const Phonon = requireOptionalNativeModule<PhononNative>("Phonon");

/** A British voice from Gradium's catalogue (Maeve, en-GB, female). */
export const PHONON_DEFAULT_VOICE = "Maeve";
