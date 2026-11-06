// A Pressable that answers the finger: it springs down to 0.96 while held
// and back on release, like every button on the canvas board.
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { snappy } from "./motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PRESS_SCALE = 0.96;

export function Press({ style, onPressIn, onPressOut, disabled, ...rest }: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) s.value = snappy(PRESS_SCALE);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = snappy(1);
        onPressOut?.(e);
      }}
      style={[style, pressStyle]}
    />
  );
}
