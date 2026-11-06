// The one lit pill in the tab bar, from the canvas board: a faint glass fill
// with a thin edge of light that slowly travels round it, so the silver
// catches the light. It springs between tabs (see Nav); Reduce Motion keeps
// the edge still.
import { useEffect } from "react";
import { Canvas, RoundedRect, SweepGradient, vec } from "@shopify/react-native-skia";
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

const EDGE = ["rgba(255,255,255,0.15)", "#F2F4F7", "rgba(255,255,255,0.15)", "rgba(255,255,255,0.6)", "rgba(255,255,255,0.15)"];

export function TabLight({ width, height }: { width: number; height: number }) {
  const reduce = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    turn.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1, false);
  }, [reduce, turn]);
  const c = vec(width / 2, height / 2);
  const transform = useDerivedValue(() => [{ rotate: turn.value * Math.PI * 2 }]);
  const r = height / 2;
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <RoundedRect x={0} y={0} width={width} height={height} r={r} color="rgba(255,255,255,0.09)" />
      <RoundedRect x={0.5} y={0.5} width={width - 1} height={height - 1} r={r - 0.5} style="stroke" strokeWidth={1}>
        <SweepGradient c={c} colors={EDGE} origin={c} transform={transform} />
      </RoundedRect>
    </Canvas>
  );
}
