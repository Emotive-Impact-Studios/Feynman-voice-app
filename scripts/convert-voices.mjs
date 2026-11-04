// Turn voices.npz into voices.bin (float32, little endian) plus voices.json.
// voices.json maps each voice name to its byte offset and shape, so the app can
// slice out one style vector with a Float32Array view.
//
// Plain Node, no NumPy: an .npz is a zip of .npy files.
//   node scripts/convert-voices.mjs path/to/voices.npz out-dir
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

const [src, outDir] = process.argv.slice(2);
const zip = readFileSync(src);

function zipEntries(buf) {
  // Find the end-of-central-directory record, then walk the central directory.
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    if (method === 0) out[name] = raw;
    else if (method === 8) out[name] = inflateRawSync(raw);
    else throw new Error(`Unsupported zip method ${method} for ${name}`);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function readNpy(buf) {
  if (buf.toString("latin1", 1, 6) !== "NUMPY") throw new Error("Not an .npy file");
  const major = buf[6];
  const headerLen = major === 1 ? buf.readUInt16LE(8) : buf.readUInt32LE(8);
  const headerStart = major === 1 ? 10 : 12;
  const header = buf.toString("latin1", headerStart, headerStart + headerLen);
  const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1];
  const fortran = /'fortran_order':\s*True/.test(header);
  const shape = /'shape':\s*\(([^)]*)\)/.exec(header)[1].split(",").map((s) => s.trim()).filter(Boolean).map(Number);
  if (descr !== "<f4" || fortran) throw new Error(`Expected little-endian float32 in C order, got ${descr}`);
  return { shape, data: buf.subarray(headerStart + headerLen) };
}

const entries = zipEntries(zip);
const index = {};
const chunks = [];
let offset = 0;
for (const file of Object.keys(entries).sort()) {
  const { shape, data } = readNpy(entries[file]);
  index[file.replace(/\.npy$/, "")] = { offset, shape };
  chunks.push(data);
  offset += data.length;
}
writeFileSync(join(outDir, "voices.bin"), Buffer.concat(chunks));
writeFileSync(join(outDir, "voices.json"), JSON.stringify(index, null, 2));
console.log(`Wrote ${chunks.length} voices, ${offset} bytes`);
