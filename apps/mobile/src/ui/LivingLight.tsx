// The student: Fenny's light, drawn in code (see FennyOrb). It takes up
// `size` in layout; the orb is drawn a little larger so its soft edge fades
// out around that space, with no box.
import { View } from "react-native";
import { FennyOrb } from "./FennyOrb";

interface Props {
  size: number;
  /** 0 = resting, 1 = speaking or thinking. Drives size and movement. */
  energy?: number;
}

export function LivingLight({ size, energy = 0 }: Props) {
  const pad = size * 0.25;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <View style={{ position: "absolute", left: -pad, top: -pad }}>
        <FennyOrb size={size + pad * 2} energy={energy} />
      </View>
    </View>
  );
}
