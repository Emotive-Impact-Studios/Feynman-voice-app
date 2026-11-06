// Scanning pages of notes with the phone's own document scanner: Apple's
// VisionKit scanner on iPhone, Google's ML Kit scanner on Android. Both find
// the page edges, snap when it is steady, and flatten the photo for free.
// Each page is then shrunk and sent to the server to be read.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Longest side sent to the server. Plenty for handwriting, small on mobile data. */
const MAX_SIDE = 1800;

type Scanner = typeof import("react-native-document-scanner-plugin").default;

/**
 * The scanner, or null in a build that doesn't include it yet (an older
 * TestFlight build receiving this code over the air would otherwise crash).
 */
function scanner(): Scanner | null {
  try {
    return require("react-native-document-scanner-plugin").default as Scanner;
  } catch {
    return null;
  }
}

export const canScan = () => scanner() != null;

/** Opens the scanner. Resolves with the page photos, or [] if they cancelled. */
export async function scanPages(): Promise<string[]> {
  const s = scanner();
  if (!s) throw new Error("Scanning needs the latest version of the app.");
  const res = await s.scanDocument({ croppedImageQuality: 90, maxNumDocuments: 12 });
  return res.status === "cancel" ? [] : (res.scannedImages ?? []);
}

/** Shrink one page photo and return it as base64 JPEG for the server. */
export async function pageForUpload(uri: string): Promise<string> {
  const first = await ImageManipulator.manipulate(uri).renderAsync();
  let ref = first;
  const long = Math.max(first.width, first.height);
  if (long > MAX_SIDE) {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize(first.width >= first.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    ref = await ctx.renderAsync();
  }
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!out.base64) throw new Error("Could not prepare that page");
  return out.base64;
}

/** Run jobs a few at a time, keeping their order. */
export async function inBatches<T, R>(items: T[], size: number, job: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await job(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}
