// The one lit pill in the tab bar: a solid graphite pill on a soft shadow,
// no edge, no ring.
// It springs between tabs (see Nav).
import { View } from "react-native";

export function TabLight({ width, height }: { width: number; height: number }) {
  return <View pointerEvents="none" style={{ width, height, borderRadius: height / 2, backgroundColor: "#2E3238", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }} />;
}
