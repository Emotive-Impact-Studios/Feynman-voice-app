// Puts Phonon's iPhone model bundle (Core ML, Apache 2.0) where the app can
// download it on first run: .vercel/output/static/phonon/<version>/...
// The app's Phonon module fetches bundle.json, then every file it lists, and
// checks each one's SHA-256, so a plain static folder is all it needs.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { unzipSync } from "fflate";

export const PHONON_VERSION = "0.6.0";
const URL = `https://github.com/gradium-ai/xn-ptts/releases/download/v${PHONON_VERSION}/phonon-31m-en-coreml.zip`;
const SHA256 = "2869326ab074f55ed5b644e68b1befef69dc51545b73296d49f5b4dab14c4218";

export async function writePhononBundle(staticDir) {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Phonon bundle download failed: ${res.status}`);
  const zip = new Uint8Array(await res.arrayBuffer());
  const sha = createHash("sha256").update(zip).digest("hex");
  if (sha !== SHA256) throw new Error(`Phonon bundle checksum mismatch: ${sha}`);
  const out = join(staticDir, "phonon", `31m-en-${PHONON_VERSION}`);
  let files = 0;
  for (const [name, data] of Object.entries(unzipSync(zip))) {
    if (name.endsWith("/")) continue;
    // Drop the top folder (phonon-31m-en/) so bundle.json sits at the root.
    const rel = name.split("/").slice(1).join("/");
    if (!rel) continue;
    mkdirSync(dirname(join(out, rel)), { recursive: true });
    writeFileSync(join(out, rel), data);
    files++;
  }
  return { out, files };
}
