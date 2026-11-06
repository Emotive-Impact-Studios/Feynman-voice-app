// Background photos that feel alive, as on the canvas board: a slow drift
// in scale and position over about half a minute, plus a gentle shift the
// other way when you tilt the phone, so the picture sits behind the glass.
// Reduce Motion keeps the photo still.
import { StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Easing,
  interpolate,
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

/** How far the photo shifts at full tilt, in points (the canvas uses 12 by 10). */
const SHIFT_X = 12;
const SHIFT_Y = 10;
/** Share of gravity moving across an axis that counts as full tilt (about 25 degrees). */
const FULL_TILT = 0.42;

export function LivingPhoto({ source, opacity = 1, flip, offsetY = 0 }: { source: number; opacity?: number; flip?: boolean; offsetY?: number }) {
  const reduce = useReducedMotion();
  return reduce ? <Still source={source} opacity={opacity} flip={flip} offsetY={offsetY} /> : <Alive source={source} opacity={opacity} flip={flip} offsetY={offsetY} />;
}

function Still({ source, opacity, flip, offsetY }: { source: number; opacity: number; flip?: boolean; offsetY: number }) {
  return <Image source={source} contentFit="cover" style={[StyleSheet.absoluteFill, { opacity, top: offsetY, transform: flip ? [{ scaleY: -1 }] : undefined }]} {...hidden} />;
}

function Alive({ source, opacity, flip, offsetY }: { source: number; opacity: number; flip?: boolean; offsetY: number }) {
  // Drift: 0 to 1 over 14 s and back again, eased, for ever.
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [p]);

  // Tilt: the gravity direction as the phone sees it (x for left and right,
  // z for towards and away), measured from however the phone is usually held
  // (a slowly following baseline), then smoothed so the photo glides rather
  // than jitters. Gravity avoids the jumps Euler angles have near upright.
  const sensor = useAnimatedSensor(SensorType.GRAVITY, { interval: 33 });
  const base = useSharedValue<{ x: number; z: number } | null>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  useAnimatedReaction(
    () => sensor.sensor.value,
    (v) => {
      const g = Math.hypot(v.x, v.y, v.z);
      if (!g) return;
      const x = v.x / g;
      const z = v.z / g;
      const b = base.value ?? { x, z };
      const nb = { x: b.x + (x - b.x) * 0.01, z: b.z + (z - b.z) * 0.01 };
      base.value = nb;
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      tx.value += (clamp((x - nb.x) / FULL_TILT) - tx.value) * 0.12;
      ty.value += (clamp((z - nb.z) / FULL_TILT) - ty.value) * 0.12;
    },
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(p.value, [0, 1], [-6, 6]) - tx.value * SHIFT_X },
      { translateY: interpolate(p.value, [0, 0.5, 1], [-5, 3, 8]) - ty.value * SHIFT_Y },
      { scale: interpolate(p.value, [0, 0.5, 1], [1.05, 1.12, 1.07]) },
      ...(flip ? [{ scaleY: -1 }] : []),
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, top: offsetY, overflow: "hidden" }]} {...hidden}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Image source={source} contentFit="cover" style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  );
}

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };
