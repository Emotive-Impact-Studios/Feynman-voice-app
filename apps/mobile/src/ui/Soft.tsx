// Solid soft buttons (build 13), after the voice-mode buttons Edem pointed
// at: each button is one opaque round shape with a wide, soft shadow under
// it. No outline, no ring, no top highlight, nothing see-through. A key
// button is soft silver with a dark icon; a quiet one is a solid graphite
// disc with a light icon.
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurMask, Canvas, RoundedRect, type SkSize } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";

/** A quiet button: solid graphite. */
export const SOFT_BG = "#24272C";
/** A key button: solid soft silver. Put dark content on it (colour.onLight). */
export const LIT_BG = "#E4E7EB";
const GLOW = "rgba(142,166,212,0.28)";

/** The soft shadow every button stands on. */
export const BUTTON_SHADOW: ViewStyle = {
  shadowColor: "#000",
  shadowOpacity: 0.45,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
};

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
 * centred. `lit` is the one key button on a screen (soft silver, so give it
 * dark content); `glow` adds a soft light behind it where really wanted.
 */
export function Soft({ lit, glow = false, radius, style, children }: { lit?: boolean; glow?: boolean; radius?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <View style={[styles.centre, BUTTON_SHADOW, { borderRadius: radius ?? 999, backgroundColor: lit ? LIT_BG : SOFT_BG }, style]}>
      {lit && glow && <SoftGlow radius={radius} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ centre: { alignItems: "center", justifyContent: "center" } });
