#!/usr/bin/env bash
# Downloads Kitten TTS Nano 0.8 (int8, about 24MB) and converts the voices
# file into a flat binary the phone can read directly.
set -euo pipefail
REPO="KittenML/kitten-tts-nano-0.8-int8"
OUT="${1:-apps/mobile/assets/kitten}"
mkdir -p "$OUT"
base="https://huggingface.co/$REPO/resolve/main"
curl -fsSL "$base/kitten_tts_nano_v0_8.onnx" -o "$OUT/kitten_tts_nano_v0_8.onnx"
curl -fsSL "$base/voices.npz" -o "$OUT/voices.npz"
curl -fsSL "$base/config.json" -o "$OUT/config.json"
node "$(dirname "$0")/convert-voices.mjs" "$OUT/voices.npz" "$OUT"
rm "$OUT/voices.npz"
echo "Kitten TTS model ready in $OUT"
