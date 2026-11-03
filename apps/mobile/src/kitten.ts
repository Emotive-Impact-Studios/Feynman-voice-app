// Runs Kitten TTS Nano on the phone with onnxruntime-react-native.
// The server sends phonemes, so no eSpeak is needed here.
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { InferenceSession, Tensor } from "onnxruntime-react-native";
import type { KittenRunner, VoiceIndex, Voices } from "@feynman/kitten-tts";

const MODEL = require("../assets/kitten/kitten_tts_nano_v0_8.onnx");
const VOICES_BIN = require("../assets/kitten/voices.bin");
const VOICES_INDEX: VoiceIndex = require("../assets/kitten/voices.json");

export interface LoadedKitten {
  runner: KittenRunner;
  voices: Voices;
}

let loading: Promise<LoadedKitten> | null = null;

export function loadKitten(): Promise<LoadedKitten> {
  loading ??= (async () => {
    const [modelAsset, voicesAsset] = await Asset.loadAsync([MODEL, VOICES_BIN]);
    const modelPath = (modelAsset.localUri ?? modelAsset.uri).replace(/^file:\/\//, "");
    const session = await InferenceSession.create(modelPath);
    const bin = await new File(voicesAsset.localUri ?? voicesAsset.uri).arrayBuffer();
    const runner: KittenRunner = {
      async run(inputIds, style, speed) {
        const out = await session.run({
          input_ids: new Tensor("int64", BigInt64Array.from(inputIds.map((n) => BigInt(n))), [1, inputIds.length]),
          style: new Tensor("float32", style, [1, style.length]),
          speed: new Tensor("float32", Float32Array.of(speed), [1]),
        });
        return out[session.outputNames[0]].data as Float32Array;
      },
    };
    return { runner, voices: { bin, index: VOICES_INDEX } };
  })();
  return loading;
}
