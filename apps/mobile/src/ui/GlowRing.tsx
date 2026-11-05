// Fenny in a call: a grainy ring of silver-blue light that slowly turns,
// like a hollow glass sphere. Drawn live in Skia from Edem's glow-ring
// reference, so it stays sharp at any size and reacts to energy.
import { useEffect } from "react";
import { Blur, Canvas, Circle, FractalNoise, Group, Rect, rect, rrect, SweepGradient, vec } from "@shopify/react-native-skia";
import { Easing, type SharedValue, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";

interface Props {
  size: number;
  /** 0 = resting, 1 = speaking or thinking. Drives brightness and swell. */
  energy?: number;
}

const HOT = "#E8F2FF";
const STREAK = "#7FA8CF";
// Bright at the top and bottom, dimmer on the sides, as in the reference.
const RING_COLOURS = ["#BFD6EE", "#3E5F80", "#A9C6E6", "#3E5F80", "#BFD6EE"];
const STREAKS = [-0.3, -0.22, -0.13, -0.07, -0.02, 0.04, 0.09, 0.15, 0.23, 0.31];

export function GlowRing({ size, energy = 0 }: Props) {
  const reduce = useReducedMotion();
  // Padding so the blur never meets the canvas edge.
  const pad = size * 0.35;
  const c = size / 2 + pad;
  const r = size * 0.36;
  const W = size + pad * 2;

  const turn = useSharedValue(0);
  const breath = useSharedValue(0.5);
  const e = useSharedValue(energy);
  useEffect(() => {
    if (reduce) return;
    turn.value = withRepeat(withTiming(1, { duration: 5800, easing: Easing.linear }), -1, false);
    breath.value = withRepeat(withTiming(1, { duration: 2900, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, turn, breath]);
  useEffect(() => {
    e.value = withSpring(energy, { duration: 550, dampingRatio: 0.85 });
  }, [energy, e]);

  // The ring narrows and widens a little as it turns, which reads as spin.
  const transform = useDerivedValue(() => {
    const s = 0.94 + breath.value * 0.05 + e.value * 0.06;
    const squash = 0.9 + 0.08 * Math.cos(turn.value * Math.PI * 2);
    return [{ scaleX: s * squash }, { scaleY: s }];
  });
  const glow = useDerivedValue(() => 0.5 + breath.value * 0.15 + e.value * 0.3);
  const halo = useDerivedValue(() => glow.value * 0.5);
  // Hot spots ride the top and bottom of the ring, drifting side to side.
  const sway = useDerivedValue(() => Math.sin(turn.value * Math.PI * 2) * r * 0.18);
  const topX = useDerivedValue(() => c + sway.value);
  const botX = useDerivedValue(() => c - sway.value * 0.7);
  const hot = useDerivedValue(() => 0.55 + e.value * 0.4 + breath.value * 0.1);

  const cr = r * 0.98;
  const clip = rrect(rect(c - cr, c - cr, cr * 2, cr * 2), cr, cr);
  const sweep = <SweepGradient c={vec(c, c)} colors={RING_COLOURS} start={-90} end={270} />;

  return (
    <Canvas style={{ width: W, height: W, margin: -pad }} pointerEvents="none">
      <Group origin={vec(c, c)} transform={transform} blendMode="screen">
        <Group opacity={halo}>
          <Circle cx={c} cy={c} r={r} style="stroke" strokeWidth={size * 0.16}>
            {sweep}
          </Circle>
          <Blur blur={size * 0.07} />
        </Group>
        <Group opacity={glow}>
          <Circle cx={c} cy={c} r={r} style="stroke" strokeWidth={size * 0.05}>
            {sweep}
          </Circle>
          <Blur blur={size * 0.025} />
        </Group>
        <Group clip={clip}>
          {STREAKS.map((x, i) => (
            <Streak key={i} c={c} r={r} size={size} x={x} i={i} turn={turn} energy={e} />
          ))}
          <Blur blur={size * 0.018} />
        </Group>
        <Group opacity={hot}>
          <Circle cx={topX} cy={c - r} r={size * 0.055} color={HOT} />
          <Circle cx={botX} cy={c + r} r={size * 0.045} color={HOT} />
          <Blur blur={size * 0.04} />
        </Group>
      </Group>
      {/* Film grain */}
      <Rect x={0} y={0} width={W} height={W} opacity={0.08} blendMode="overlay">
        <FractalNoise freqX={0.9} freqY={0.9} octaves={2} />
      </Rect>
    </Canvas>
  );
}

function Streak({ c, r, size, x, i, turn, energy }: { c: number; r: number; size: number; x: number; i: number; turn: SharedValue<number>; energy: SharedValue<number> }) {
  // Each streak slides across as the sphere turns, fading towards the edges.
  const p = useDerivedValue(() => (x + 0.5 + turn.value) % 1);
  const sx = useDerivedValue(() => c + (p.value - 0.5) * r * 2);
  const opacity = useDerivedValue(() => (0.3 + energy.value * 0.12) * Math.max(0.15, 1 - Math.abs(p.value - 0.5) * 1.6));
  return <Rect x={sx} y={c - r} width={size * (i % 3 ? 0.012 : 0.02)} height={r * 2} color={STREAK} opacity={opacity} />;
}
