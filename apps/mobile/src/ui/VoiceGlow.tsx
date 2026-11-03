// The learner's voice as light along the bottom edge. It rises while you talk.
import { useEffect } from "react";
import { useWindowDimensions } from "react-native";
import { Blur, Canvas, Oval, RadialGradient, vec } from "@shopify/react-native-skia";
import { Easing, useDerivedValue, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";

interface Props {
  /** 0 to 1. Today this is 1 while the speech meter hears you, 0 otherwise. */
  level: number;
  height?: number;
  dim?: boolean;
}

export function VoiceGlow({ level, height = 260, dim = false }: Props) {
  const { width } = useWindowDimensions();
  const lv = useSharedValue(level);
  const shimmer = useSharedValue(0);
  useEffect(() => {
    lv.value = withSpring(level, { damping: 12, stiffness: 120 });
  }, [level, lv]);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [shimmer]);

  const ovalH = useDerivedValue(() => height * (0.55 + lv.value * 0.55 + shimmer.value * 0.08));
  const ovalW = useDerivedValue(() => width * (0.9 + lv.value * 0.25));
  const x = useDerivedValue(() => (width - ovalW.value) / 2);
  const y = useDerivedValue(() => height - ovalH.value / 2);
  const centre = useDerivedValue(() => vec(width / 2, height));
  const r = useDerivedValue(() => Math.max(ovalW.value, ovalH.value) / 2);

  return (
    <Canvas style={{ position: "absolute", left: 0, right: 0, bottom: 0, height, opacity: dim ? 0.6 : 1 }} pointerEvents="none">
      <Oval x={x} y={y} width={ovalW} height={ovalH}>
        <RadialGradient c={centre} r={r} colors={["#FFFFFF", "#C9D3E6", "#7E95C6", "rgba(60,80,130,0)"]} positions={[0, 0.22, 0.48, 1]} />
        <Blur blur={18} />
      </Oval>
    </Canvas>
  );
}
