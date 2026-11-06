// The app's three springs (see the apple-style-motion notes). Every screen
// uses these so the whole app moves the same way.
import { Easing, withDelay, withSpring, withTiming } from "react-native-reanimated";

export const spring = {
  /** Screens, sheets, the light moving between places. */
  smooth: { duration: 550, dampingRatio: 0.85 },
  /** Buttons, chips, presses. */
  snappy: { duration: 350, dampingRatio: 0.9 },
  /** Cards landing, the light arriving. */
  bouncy: { duration: 600, dampingRatio: 0.7 },
} as const;

export const smooth = (v: number) => {
  "worklet";
  return withSpring(v, spring.smooth);
};
export const snappy = (v: number) => {
  "worklet";
  return withSpring(v, spring.snappy);
};
export const bouncy = (v: number) => {
  "worklet";
  return withSpring(v, spring.bouncy);
};

/**
 * A section arriving: fades in, rises 14 px and grows from 0.98, after a
 * small stagger. (The canvas also clears a blur; on a phone blur on text is
 * costly, so rise and scale carry it, as the motion notes say.)
 */
export function riseIn(delayMs = 0) {
  return () => {
    "worklet";
    return {
      initialValues: { opacity: 0, transform: [{ translateY: 14 }, { scale: 0.98 }] },
      animations: {
        opacity: withDelay(delayMs, withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) })),
        transform: [{ translateY: withDelay(delayMs, withSpring(0, spring.smooth)) }, { scale: withDelay(delayMs, withSpring(1, spring.smooth)) }],
      },
    };
  };
}

/** A whole screen arriving: fades in and settles from 0.985. */
export function screenIn() {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.985 }] },
    animations: {
      opacity: withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }),
      transform: [{ scale: withSpring(1, spring.smooth) }],
    },
  };
}

/** Gap between sections arriving one after another. */
export const STAGGER_MS = 80;
