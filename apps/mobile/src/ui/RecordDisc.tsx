// The record button's face (build 12): one clean soft disc. No ring, no
// outline and no top highlight. While listening it tints silver-blue and a
// soft blurred light breathes behind it, with no line round it. While held,
// the light hides so the coral hold ring (HoldButton) reads on its own.
import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Blur, Canvas, Circle, vec } from "@shopify/react-native-skia";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const SPREAD = 26;

export function RecordDisc({ size, listening, hold, children }: { size: number; listening: boolean; hold?: SharedValue<number>; children: ReactNode }) {
  const reduce = useReducedMotion();
  const on = useSharedValue(listening ? 1 : 0);
  const breath = useSharedValue(0);
  useEffect(() => {
    on.value = withTiming(listening ? 1 : 0, { duration: 350, easing: Easing.out(Easing.quad) });
  }, [listening, on]);
  useEffect(() => {
    if (reduce) return;
    breath.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, breath]);

  const r = size / 2;
  const box = size + SPREAD * 2;

  const tint = useAnimatedStyle(() => ({ opacity: on.value }));
  // A soft light behind the button only while listening, breathing.
  const glow = useAnimatedStyle(() => {
    const held = hold ? Math.min(1, hold.value * 4) : 0;
    return {
      opacity: on.value * (0.7 + 0.3 * breath.value) * (1 - held),
      transform: [{ scale: 1 + 0.06 * breath.value * on.value }],
    };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View pointerEvents="none" style={[styles.abs, { width: box, height: box, left: -SPREAD, top: -SPREAD }, glow]}>
        <Canvas style={{ width: box, height: box }}>
          <Circle c={vec(box / 2, box / 2)} r={r + 2} color="rgba(142,166,212,0.42)">
            <Blur blur={SPREAD / 2} />
          </Circle>
        </Canvas>
      </Animated.View>
      <View style={[styles.disc, { width: size, height: size, borderRadius: r }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: r, backgroundColor: "rgba(169,190,230,0.22)" }, tint]} />
        <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  disc: { backgroundColor: "rgba(40,43,50,0.92)", overflow: "hidden" },
  centre: { alignItems: "center", justifyContent: "center" },
});
