// The student: Fenny's light, drawn in code (see FennyOrb). It takes up
// `size` in layout; the orb is drawn a little larger so its soft edge fades
// out around that space, with no box.
import { View } from "react-native";
import { FennyOrb } from "./FennyOrb";
import type { FennyMood } from "./mood";

interface Props {
  size: number;
  /** 0 = resting, 1 = speaking or thinking. Drives size and movement. */
  energy?: number;
  /** Fenny's face. "rest" (the default) is the plain orb with no eyes. */
  mood?: FennyMood;
  /** At rest, open the eyes now and then for a look round. */
  peek?: boolean;
  /** 0 to 1: the eyes nod along while the learner talks. */
  nod?: number;
}

export function LivingLight({ size, energy = 0, mood = "rest", peek = false, nod = 0 }: Props) {
  const pad = size * 0.25;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <View style={{ position: "absolute", left: -pad, top: -pad }}>
        <FennyOrb size={size + pad * 2} energy={energy} mood={mood} peek={peek} nod={nod} />
      </View>
    </View>
  );
}
