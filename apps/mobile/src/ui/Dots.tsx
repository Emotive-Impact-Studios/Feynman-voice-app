// Dot-matrix pieces: the minutes ring with dot numerals, and a small dot waveform.
import { useMemo } from "react";
import { Canvas, Circle, Group } from "@shopify/react-native-skia";
import { colour } from "../theme";

const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
};

/** Minutes left as a dotted ring with dot-matrix numerals in the middle. */
export function MinutesRing({ left, total, size = 300 }: { left: number; total: number; size?: number }) {
  const c = size / 2;
  const { ring, digits } = useMemo(() => {
    const share = total > 0 ? left / total : 0;
    const ring: { x: number; y: number; on: boolean }[] = [];
    const step = size / 30;
    for (let y = -c; y <= c; y += step) {
      for (let x = -c; x <= c; x += step) {
        const d = Math.hypot(x, y);
        if (d > c * 0.98 || d < c * 0.69) continue;
        const ang = (Math.atan2(x, -y) + 2 * Math.PI) % (2 * Math.PI);
        ring.push({ x: c + x, y: c + y, on: ang < 2 * Math.PI * share });
      }
    }
    const text = String(Math.max(0, Math.round(left)));
    const dot = size / 37.5;
    const glyphW = dot * 5 + dot * 1.4;
    const startX = c - (text.length * glyphW) / 2 + dot / 2;
    const startY = c - dot * 3.5;
    const digits: { x: number; y: number }[] = [];
    text.split("").forEach((ch, i) =>
      (GLYPHS[ch] ?? []).forEach((row, r) =>
        row.split("").forEach((v, k) => {
          if (v === "1") digits.push({ x: startX + i * glyphW + k * dot, y: startY + r * dot });
        }),
      ),
    );
    return { ring, digits };
  }, [left, total, size, c]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group>
        {ring.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={1.5} color={colour.silver} opacity={p.on ? 0.85 : 0.15} />
        ))}
      </Group>
      <Group>
        {digits.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={size / 100} color={colour.text} />
        ))}
      </Group>
    </Canvas>
  );
}

/** A small dot waveform. `level` (0 to 1) scales the columns. */
export function DotWave({ width, height = 40, level = 1, tick = 0 }: { width: number; height?: number; level?: number; tick?: number }) {
  const dots = useMemo(() => {
    const cols = Math.floor(width / 6);
    const out: { x: number; y: number; o: number }[] = [];
    const maxRows = Math.max(1, Math.floor(height / 9));
    for (let i = 0; i < cols; i++) {
      const env = Math.sin((Math.PI * i) / Math.max(1, cols - 1));
      const amp = Math.abs(Math.sin(i * 0.8 + tick) * 0.6 + Math.sin(i * 0.33 + 1 + tick * 0.7) * 0.4) * env * level;
      const n = Math.max(1, Math.round(amp * maxRows));
      for (let k = -n + 1; k < n; k++) out.push({ x: i * 6 + 2, y: height / 2 + k * 4.4, o: 1 - (Math.abs(k) / (n + 1)) * 0.75 });
    }
    return out;
  }, [width, height, level, tick]);
  return (
    <Canvas style={{ width, height }}>
      {dots.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={1.5} color={colour.silver} opacity={p.o} />
      ))}
    </Canvas>
  );
}
