// The record button's face, from the canvas board (v56). No ring or
// outline: a soft disc lit from the top, with a one-pixel top highlight and
// a gentle shadow. While listening it tints silver-blue and a breathing ring
// of glow sits just outside it. While held, the glow hides so the coral
// hold ring (HoldButton) reads on its own.
import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Blur, Canvas, Circle, Group, RadialGradient, vec } from "@shopify/react-native-skia";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const GLOW_GAP = 5;
// The canvas asks for a 24 pt glow; 18 keeps its tail inside the control bar, which clips.
const GLOW_SPREAD = 18;
const IDLE = ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.05)"];
const LISTENING = ["rgba(169,190,230,0.32)", "rgba(110,134,188,0.12)"];

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
  const box = size + (GLOW_GAP + GLOW_SPREAD) * 2;
  const c = box / 2;

  // Tinted fill fades in over the plain one.
  const tint = useAnimatedStyle(() => ({ opacity: on.value }));
  // The glow ring: shown while listening, hidden while held, breathing.
  const glow = useAnimatedStyle(() => {
    const held = hold ? Math.min(1, hold.value * 4) : 0;
    return {
      opacity: on.value * (1 - held) * (0.75 + 0.25 * breath.value),
      transform: [{ scale: 1 + 0.07 * breath.value }],
    };
  });
  const lineR = r + GLOW_GAP;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View pointerEvents="none" style={[styles.glow, { width: box, height: box, left: -(GLOW_GAP + GLOW_SPREAD), top: -(GLOW_GAP + GLOW_SPREAD) }, glow]}>
        <Canvas style={{ width: box, height: box }}>
          <Group>
            <Blur blur={GLOW_SPREAD / 2} />
            <Circle c={vec(c, c)} r={lineR} style="stroke" strokeWidth={6} color="rgba(142,166,212,0.45)" />
          </Group>
          <Circle c={vec(c, c)} r={lineR} style="stroke" strokeWidth={1.5} color="rgba(201,214,240,0.75)" />
        </Canvas>
      </Animated.View>
      <View style={[styles.disc, { width: size, height: size, borderRadius: r }]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Circle c={vec(r, r)} r={r}>
            <RadialGradient c={vec(r, 0)} r={size} colors={IDLE} />
          </Circle>
        </Canvas>
        <Animated.View style={[StyleSheet.absoluteFill, tint]}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Circle c={vec(r, r)} r={r}>
              <RadialGradient c={vec(r, 0)} r={size} colors={LISTENING} />
            </Circle>
          </Canvas>
        </Animated.View>
        {/* Only the top edge catches the light. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.14)" }]} />
        <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute" },
  disc: {
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  centre: { alignItems: "center", justifyContent: "center" },
});
