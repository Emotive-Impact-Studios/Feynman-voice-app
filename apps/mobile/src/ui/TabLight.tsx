// The one lit pill in the tab bar, from the canvas board (v57): a faint fill
// with a top highlight, and no ring. It springs between tabs (see Nav).
import { View } from "react-native";
import { TOP_LIGHT } from "./Soft";

export function TabLight({ width, height }: { width: number; height: number }) {
  return (
    <View
      pointerEvents="none"
      style={{ width, height, borderRadius: height / 2, backgroundColor: "rgba(255,255,255,0.1)", borderTopWidth: 1, borderTopColor: TOP_LIGHT }}
    />
  );
}
