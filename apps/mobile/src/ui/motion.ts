// The app's three springs (see the apple-style-motion notes). Every screen
// uses these so the whole app moves the same way.
import { withSpring } from "react-native-reanimated";

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
