// The topic's key ideas during a call: one segment each, filling as the
// learner explains them, and a "Got it" chip that rises for each new one.
// The ideas are the conversation engine's own checklist, sent with every
// reply, so the bar shows what Fenny is already tracking.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { colour } from "../theme";
import { spring } from "./motion";
import { Icon, T } from "./kit";

export function IdeaBar({ total, done }: { total: number; done: number }) {
  if (total < 1) return null;
  return (
    <View style={styles.bar} accessibilityLabel={`${done} of ${total} key ideas explained`}>
      {Array.from({ length: total }, (_, i) => (
        <Segment key={i} on={i < done} />
      ))}
    </View>
  );
}

function Segment({ on }: { on: boolean }) {
  const fill = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    fill.value = withSpring(on ? 1 : 0, { duration: 900, dampingRatio: 0.8 });
  }, [on, fill]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, style]} />
    </View>
  );
}

/** Rises for each new idea they nail, holds, then floats off. */
export function GotChip({ got }: { got: { idea: string; n: number } | null }) {
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const y = useSharedValue(16);
  const o = useSharedValue(0);
  const s = useSharedValue(0.94);
  const last = useRef(got?.n);
  useEffect(() => {
    if (!got || got.n === last.current) return;
    last.current = got.n;
    setText(got.idea);
    if (reduce) {
      y.value = 0;
      s.value = 1;
      o.value = withSequence(withTiming(1, { duration: 150 }), withDelay(2450, withTiming(0, { duration: 300 })));
      return;
    }
    y.value = 16;
    s.value = 0.94;
    s.value = withSpring(1, spring.bouncy);
    // Rise in, hold, then float up and away.
    o.value = withSequence(withTiming(1, { duration: 260 }), withDelay(2340, withTiming(0, { duration: 700 })));
    y.value = withSequence(withSpring(0, spring.bouncy), withDelay(2000, withTiming(-26, { duration: 900, easing: Easing.out(Easing.cubic) })));
  }, [got, reduce, o, y, s]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { scale: s.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.chip, style]} accessibilityLiveRegion="polite">
      <Icon name="check" size={15} color={colour.student} />
      <T size={14} weight="medium" lines={2} style={{ flexShrink: 1, color: "#DCE5F6" }}>
        Got it · {text}
      </T>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", gap: 6, paddingHorizontal: 8 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  segmentFill: { height: "100%", borderRadius: 2, backgroundColor: colour.student },
  chip: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 330,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: "rgba(169,190,230,0.16)",
  },
});
