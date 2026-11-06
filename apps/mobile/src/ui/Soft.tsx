// Clean buttons (build 12). Edem found the rings and the bright top edges
// sharp and cheap, so a button is now one plain soft shape: a quiet fill,
// no outline, no ring, no top highlight. A key button can glow a little
// (`lit`), drawn as a blurred light behind it, never as a line.
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurMask, Canvas, RoundedRect, type SkSize } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";

/** The fill of a quiet button. */
export const SOFT_BG = "rgba(255,255,255,0.09)";
/** A key button: a touch brighter, with a silver-blue cast. */
export const LIT_BG = "rgba(196,210,236,0.16)";
const GLOW = "rgba(142,166,212,0.28)";

/** A soft light behind its parent's box, with no edge. Leave out radius for a disc or pill. */
export function SoftGlow({ radius, spread = 14 }: { radius?: number; spread?: number }) {
  const box = useSharedValue<SkSize>({ width: 0, height: 0 });
  const w = useDerivedValue(() => Math.max(0, box.value.width - spread * 2));
  const h = useDerivedValue(() => Math.max(0, box.value.height - spread * 2));
  const r = useDerivedValue(() => radius ?? Math.min(w.value, h.value) / 2);
  return (
    <Canvas pointerEvents="none" onSize={box} style={{ position: "absolute", left: -spread, top: -spread, right: -spread, bottom: -spread }}>
      <RoundedRect x={spread} y={spread} width={w} height={h} r={r} color={GLOW}>
        <BlurMask blur={spread / 2} style="normal" />
      </RoundedRect>
    </Canvas>
  );
}

/**
 * A button face. Its size comes from style (or its parent). Children are
 * centred. `lit` is for the one key button on a screen (a brighter fill;
 * add `glow` only where a soft light behind it is really wanted).
 */
export function Soft({ lit, glow = false, radius, style, children }: { lit?: boolean; glow?: boolean; radius?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <View style={[styles.centre, style]}>
      {lit && glow && <SoftGlow radius={radius} />}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius ?? 999, backgroundColor: lit ? LIT_BG : SOFT_BG }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ centre: { alignItems: "center", justifyContent: "center" } });
