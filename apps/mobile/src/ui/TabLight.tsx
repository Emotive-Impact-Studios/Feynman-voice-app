// The one lit pill in the tab bar: a plain soft fill, no edge, no ring.
// It springs between tabs (see Nav).
import { View } from "react-native";

export function TabLight({ width, height }: { width: number; height: number }) {
  return <View pointerEvents="none" style={{ width, height, borderRadius: height / 2, backgroundColor: "rgba(255,255,255,0.09)" }} />;
}
