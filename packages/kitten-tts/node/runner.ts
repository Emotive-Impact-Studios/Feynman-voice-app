// Node runner, used to check the pipeline off the phone and in tests.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as ort from "onnxruntime-node";
import type { KittenRunner, Voices } from "../src/index";

export async function loadNodeKitten(dir: string): Promise<{ runner: KittenRunner; voices: Voices }> {
  const session = await ort.InferenceSession.create(join(dir, "kitten_tts_nano_v0_8.onnx"));
  const binBuf = await readFile(join(dir, "voices.bin"));
  const bin = binBuf.buffer.slice(binBuf.byteOffset, binBuf.byteOffset + binBuf.byteLength);
  const index = JSON.parse(await readFile(join(dir, "voices.json"), "utf8"));
  const runner: KittenRunner = {
    async run(inputIds, style, speed) {
      const out = await session.run({
        input_ids: new ort.Tensor("int64", BigInt64Array.from(inputIds.map(BigInt)), [1, inputIds.length]),
        style: new ort.Tensor("float32", style, [1, style.length]),
        speed: new ort.Tensor("float32", Float32Array.of(speed), [1]),
      });
      return out[session.outputNames[0]].data as Float32Array;
    },
  };
  return { runner, voices: { bin, index } };
}
