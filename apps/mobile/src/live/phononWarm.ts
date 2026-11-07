// Gets the on-device Phonon voice ready once for the whole time the app is
// open. Loading it into the phone's Neural Engine takes a few seconds (longer
// the first time after a new build), so the app starts it quietly on launch
// and a call only waits for whatever is left. Every caller shares the one
// load, so the model is never loaded twice at the same time.
import { Platform } from "react-native";
import { Phonon, PHONON_DEFAULT_VOICE } from "../../modules/phonon";
import { PHONON_BUNDLE_URL } from "../api";

/** Phonon runs on iPhone builds only. Elsewhere the on-device voice is Kitten. */
export const phononAvailable = Platform.OS === "ios" && Phonon != null;

let load: Promise<void> | null = null;
let ready = false;

/** True once the voice has loaded in this run of the app. */
export function phononIsReady() {
  return ready;
}

/** Load the voice (downloading it the first time). Shared by every caller. */
export function preparePhonon(): Promise<void> {
  if (ready) return Promise.resolve();
  if (!load) {
    load = (async () => {
      if (!phononAvailable) throw new Error("This phone has no on-device voice");
      if (!PHONON_BUNDLE_URL) throw new Error("Set EXPO_PUBLIC_API_URL to download the voice");
      await Phonon!.prepare(PHONON_BUNDLE_URL, PHONON_DEFAULT_VOICE);
      ready = true;
    })().catch((e) => {
      // Let the next call try again.
      load = null;
      throw e;
    });
  }
  return load;
}

/**
 * On launch: if they chose Phonon and it is already on the phone, load it now
 * in the background. Never starts the big first download by itself.
 */
export async function warmPhononOnLaunch(voice: string | undefined) {
  if (voice !== "phonon" || !phononAvailable || ready || load) return;
  try {
    if (!(await Phonon!.isInstalled())) return;
    await preparePhonon();
  } catch {
    // A call will try again and show the problem if there is one.
  }
}
