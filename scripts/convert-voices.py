"""Turn voices.npz into voices.bin (float32, little endian) plus voices.json.

voices.json maps each voice name to its byte offset and shape, so the app can
slice out one style vector with a Float32Array view.
"""
import json
import sys
from pathlib import Path

import numpy as np

src, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
voices = np.load(src)
index, chunks, offset = {}, [], 0
for name in sorted(voices.files):
    arr = np.ascontiguousarray(voices[name], dtype="<f4")
    index[name] = {"offset": offset, "shape": list(arr.shape)}
    chunks.append(arr.tobytes())
    offset += arr.nbytes
(out_dir / "voices.bin").write_bytes(b"".join(chunks))
(out_dir / "voices.json").write_text(json.dumps(index, indent=2))
print(f"Wrote {len(index)} voices, {offset} bytes")
