// The Try it slider: a soft track and a silver thumb, like the canvas demo.
// Writes straight into a shared value so the scene follows on the UI thread,
// and tells the screen when the value crosses into a new third (for the
// readout) with a light haptic tick.
import { useRef } from "react";
import { View, type ViewInstance } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colour } from "../theme";
import { T } from "../ui/kit";

const THUMB = 28;

export function Slider({ value, low, high, onBand }: { value: SharedValue<number>; low: string; high: string; onBand: (band: number, v: number) => void }) {
  const track = useRef<ViewInstance>(null);
  const geometry = useRef({ left: 0, width: 1 });
  const band = useRef(-1);
  const w = useSharedValue(1);

  const set = (v: number) => {
    const x = Math.max(0, Math.min(1, v));
    value.set(x);
    const b = x < 0.34 ? 0 : x < 0.67 ? 1 : 2;
    if (b !== band.current) {
      if (band.current !== -1) Haptics.selectionAsync().catch(() => {});
      band.current = b;
    }
    onBand(b, x);
  };
  const fromPage = (pageX: number) => set((pageX - geometry.current.left - THUMB / 2) / Math.max(1, geometry.current.width - THUMB));

  const fillStyle = useAnimatedStyle(() => ({ width: THUMB / 2 + value.value * (w.value - THUMB) }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: value.value * (w.value - THUMB) }] }));

  return (
    <View style={{ gap: 6 }}>
      <View
        ref={track}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          const pageX = e.nativeEvent.pageX;
          track.current?.measureInWindow((x: number, _y: number, width: number) => {
            geometry.current = { left: x, width };
            fromPage(pageX);
          });
        }}
        onResponderMove={(e) => fromPage(e.nativeEvent.pageX)}
        onLayout={(e) => w.set(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${low} to ${high}`}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => set(value.get() + (e.nativeEvent.actionName === "increment" ? 0.2 : -0.2))}
        style={{ height: 40, justifyContent: "center" }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
          <Animated.View style={[{ height: 6, backgroundColor: colour.student, borderRadius: 3 }, fillStyle]} />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: "#E2E5EA",
              shadowColor: "#000",
              shadowOpacity: 0.5,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            },
            thumbStyle,
          ]}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T size={10.5} weight="mono" tone="muted" style={{ letterSpacing: 1, textTransform: "uppercase" }}>
          {low}
        </T>
        <T size={10.5} weight="mono" tone="muted" style={{ letterSpacing: 1, textTransform: "uppercase" }}>
          {high}
        </T>
      </View>
    </View>
  );
}
