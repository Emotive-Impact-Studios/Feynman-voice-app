// The session's record button, from the canvas board: a tap talks, and
// holding for about a second ends the session. While held, a coral ring
// fills round the button so you can see the hold working and let go in time.
import { useMemo, type ReactNode } from "react";
import { View } from "react-native";
import { Canvas, Group, Path, Skia, vec } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { cancelAnimation, Easing, type SharedValue, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { colour } from "../theme";
import { Press } from "./Press";

/** The ring starts filling after this, so an ordinary tap shows nothing. */
const SHOW_AFTER_MS = 180;
const FILL_MS = 1000;
const RING_GAP = 5;
const STROKE = 3;

export function HoldButton({
  size,
  label,
  onTap,
  onHold,
  children,
}: {
  size: number;
  label: string;
  /** A tap. Leave it out while a tap should do nothing (getting ready). */
  onTap?: () => void;
  /** Held to the end: end the session. */
  onHold: () => void;
  /** The button's face. Given the hold's progress (0 to 1) if it wants it. */
  children: ReactNode | ((hold: SharedValue<number>) => ReactNode);
}) {
  const p = useSharedValue(0);
  const box = size + RING_GAP * 2;
  const r = size / 2 + RING_GAP - STROKE / 2 - 1;
  const ring = useMemo(() => {
    return Skia.PathBuilder.Make().addCircle(box / 2, box / 2, r).build();
  }, [box, r]);

  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Hold to end the session"
      accessibilityActions={[{ name: "longpress", label: "End the session" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "longpress") onHold();
      }}
      onPress={onTap}
      onPressIn={() => {
        p.value = withDelay(SHOW_AFTER_MS, withTiming(1, { duration: FILL_MS, easing: Easing.linear }));
      }}
      onPressOut={() => {
        cancelAnimation(p);
        p.value = withTiming(0, { duration: 160 });
      }}
      delayLongPress={SHOW_AFTER_MS + FILL_MS}
      onLongPress={() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onHold();
      }}
      style={{ width: size, height: size }}
    >
      {typeof children === "function" ? children(p) : children}
      <View pointerEvents="none" style={{ position: "absolute", left: -RING_GAP, top: -RING_GAP }}>
        <Canvas style={{ width: box, height: box }}>
          <Group origin={vec(box / 2, box / 2)} transform={[{ rotate: -Math.PI / 2 }]}>
            <Path path={ring} style="stroke" strokeWidth={STROKE} strokeCap="round" color={colour.gap} start={0} end={p} />
          </Group>
        </Canvas>
      </View>
    </Press>
  );
}
