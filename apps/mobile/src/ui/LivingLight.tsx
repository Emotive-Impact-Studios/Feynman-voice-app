// The student. A soft light that drifts and breathes, and swells when it speaks.
import { useEffect } from "react";
import { Blur, Canvas, Circle, Group, RadialGradient, vec } from "@shopify/react-native-skia";
import { Easing, useDerivedValue, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { lightBlobs } from "../theme";

interface Props {
  size: number;
  /** 0 = resting, 1 = speaking or thinking. Drives size and brightness. */
  energy?: number;
}

function useLoop(ms: number) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [ms, t]);
  return t;
}

export function LivingLight({ size, energy = 0 }: Props) {
  const c = size / 2;
  const a = useLoop(7000);
  const b = useLoop(9000);
  const d = useLoop(8000);
  const breath = useLoop(4800);
  const e = useSharedValue(energy);
  useEffect(() => {
    e.value = withSpring(energy, { damping: 14, stiffness: 90 });
  }, [energy, e]);

  const scale = useDerivedValue(() => 0.92 + breath.value * 0.13 + e.value * 0.12);
  const transform = useDerivedValue(() => [{ scale: scale.value }]);
  const ax = useDerivedValue(() => c - size * 0.12 + a.value * size * 0.09);
  const ay = useDerivedValue(() => c - size * 0.02 - a.value * size * 0.06);
  const bx = useDerivedValue(() => c + size * 0.12 - b.value * size * 0.08);
  const by = useDerivedValue(() => c - size * 0.08 + b.value * size * 0.07);
  const dx = useDerivedValue(() => c + d.value * size * 0.04);
  const dy = useDerivedValue(() => c + size * 0.14 + d.value * size * 0.06);
  const coreR = useDerivedValue(() => size * (0.28 + e.value * 0.05));
  const blur = size * 0.13;

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group origin={vec(c, c)} transform={transform} blendMode="screen">
        <Group opacity={0.7}>
          <Circle cx={ax} cy={ay} r={size * 0.28} color={lightBlobs[0]} />
          <Blur blur={blur} />
        </Group>
        <Group opacity={0.6}>
          <Circle cx={bx} cy={by} r={size * 0.28} color={lightBlobs[1]} />
          <Blur blur={blur} />
        </Group>
        <Group opacity={0.6}>
          <Circle cx={dx} cy={dy} r={size * 0.25} color={lightBlobs[2]} />
          <Blur blur={blur} />
        </Group>
        <Circle cx={c} cy={c} r={coreR}>
          <RadialGradient c={vec(c * 0.9, c * 0.85)} r={size * 0.32} colors={["#FFFFFF", "#D9E1EE", "rgba(160,180,215,0)"]} positions={[0, 0.4, 1]} />
          <Blur blur={size * 0.05} />
        </Circle>
      </Group>
    </Canvas>
  );
}
