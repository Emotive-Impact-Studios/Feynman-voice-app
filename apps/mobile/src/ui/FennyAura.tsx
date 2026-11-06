// The living background, drawn in code (from the design thread's Skia
// sketch, canvas board "THE APP" .aura layer). Three slow, blurred lights
// drift over a deep blue-black. No per-pixel shader, so the GPU work is
// small. It sits still under Reduce Motion.
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Blur, Canvas, Circle, Group, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

export function FennyAura() {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const k = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    k.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, k]);
  const W = width;
  const H = height;
  const c1 = useDerivedValue(() => vec(W * (0.15 + 0.22 * k.value), H * (0.16 + 0.07 * k.value)));
  const c2 = useDerivedValue(() => vec(W * (0.95 - 0.28 * k.value), H * (0.38 - 0.05 * k.value)));
  const c3 = useDerivedValue(() => vec(W * (0.42 + 0.15 * k.value), H * (0.48 - 0.08 * k.value)));
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect x={0} y={0} width={W} height={H}>
        <RadialGradient c={vec(W / 2, 0)} r={H * 0.9} colors={["#141A26", "#0B0D11", "#08090B"]} positions={[0, 0.55, 1]} />
      </Rect>
      <Group blendMode="screen">
        <Blur blur={70} />
        <Circle c={c1} r={W * 0.5} color="rgba(59,79,120,0.55)" />
        <Circle c={c2} r={W * 0.45} color="rgba(109,127,166,0.35)" />
        <Circle c={c3} r={W * 0.36} color="rgba(201,211,230,0.12)" />
      </Group>
    </Canvas>
  );
}
