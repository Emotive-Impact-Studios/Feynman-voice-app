// A screen arriving, as on the canvas board: it fades in, settles from 0.985
// and a light blur clears off it. The blur is one veil over the whole screen
// that fades away, which is cheap, rather than blurring each piece of text.
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { screenIn } from "./motion";

export function ScreenIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const [veil, setVeil] = useState(!reduce);
  const v = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    v.value = withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(setVeil)(false);
    });
  }, [reduce, v]);
  const veilStyle = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View entering={reduce ? undefined : screenIn} style={[{ flex: 1 }, style]}>
      {children}
      {veil && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, veilStyle]}>
          <BlurView intensity={18} tint="default" style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </Animated.View>
  );
}
