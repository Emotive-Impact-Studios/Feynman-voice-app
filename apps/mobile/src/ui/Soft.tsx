// Soft buttons, from the canvas board (v57). Most buttons are a soft disc or
// pill lit from the top, with a one-pixel top highlight and no ring. A few key
// buttons also wear a halo: a thin full ring, brighter at the top and tinted
// silver-blue at the bottom, with a faint glow outside it. The ring is one
// vertical gradient, so it has no seam and never turns. Both measure their
// own box, so they follow a button whose width animates.
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurMask, Canvas, Group, LinearGradient, RadialGradient, rect, RoundedRect, rrect, type SkSize, vec } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";

export const SOFT_FILL = ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.05)"];
export const TOP_LIGHT = "rgba(255,255,255,0.14)";
const HALO = ["rgba(236,240,247,0.42)", "rgba(255,255,255,0.07)", "rgba(169,190,230,0.22)"];
const GLOW = "rgba(142,166,212,0.22)";

/** The soft fill, filling its parent. Leave out radius for a disc or pill. */
export function SoftFill({ radius }: { radius?: number }) {
  const box = useSharedValue<SkSize>({ width: 0, height: 0 });
  const w = useDerivedValue(() => box.value.width);
  const h = useDerivedValue(() => box.value.height);
  const r = useDerivedValue(() => radius ?? Math.min(box.value.width, box.value.height) / 2);
  const c = useDerivedValue(() => vec(box.value.width / 2, 0));
  const reach = useDerivedValue(() => Math.max(1, box.value.height));
  // Stretch the light sideways, so a wide pill is lit the way a disc is.
  const stretch = useDerivedValue(() => [{ scaleX: Math.max(1, box.value.width / Math.max(1, box.value.height)) }]);
  return (
    <Canvas style={StyleSheet.absoluteFill} onSize={box} pointerEvents="none">
      <RoundedRect x={0} y={0} width={w} height={h} r={r}>
        <RadialGradient c={c} r={reach} colors={SOFT_FILL} origin={c} transform={stretch} />
      </RoundedRect>
    </Canvas>
  );
}

/** The halo ring and its outer glow, drawn round its parent's box. */
export function HaloRing({ radius, glow = 18 }: { radius?: number; glow?: number }) {
  // Measured on the canvas, which is the box plus the glow on every side.
  const box = useSharedValue<SkSize>({ width: 0, height: 0 });
  const w = useDerivedValue(() => Math.max(0, box.value.width - glow * 2));
  const h = useDerivedValue(() => Math.max(0, box.value.height - glow * 2));
  const r = useDerivedValue(() => radius ?? Math.min(w.value, h.value) / 2);
  const inner = useDerivedValue(() => rrect(rect(glow, glow, w.value, h.value), r.value, r.value));
  const lineW = useDerivedValue(() => Math.max(0, w.value - 1));
  const lineH = useDerivedValue(() => Math.max(0, h.value - 1));
  const lineR = useDerivedValue(() => Math.max(0, r.value - 0.5));
  const end = useDerivedValue(() => vec(0, glow + h.value));
  return (
    <Canvas pointerEvents="none" onSize={box} style={{ position: "absolute", left: -glow, top: -glow, right: -glow, bottom: -glow }}>
      {glow > 0 && (
        // Like a CSS box shadow: blurred, and only outside the box.
        <Group clip={inner} invertClip>
          <RoundedRect x={glow} y={glow} width={w} height={h} r={r} color={GLOW}>
            <BlurMask blur={glow / 2} style="normal" />
          </RoundedRect>
        </Group>
      )}
      <RoundedRect x={glow + 0.5} y={glow + 0.5} width={lineW} height={lineH} r={lineR} style="stroke" strokeWidth={1}>
        <LinearGradient start={vec(0, glow)} end={end} colors={HALO} />
      </RoundedRect>
    </Canvas>
  );
}

/**
 * A soft button face. Its size comes from style (or its parent). Children are
 * centred. Pass halo for the few key buttons that keep a ring.
 */
export function Soft({
  halo,
  glow,
  radius,
  style,
  children,
}: {
  halo?: boolean;
  glow?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.centre, style]}>
      <SoftFill radius={radius} />
      {halo ? (
        <HaloRing radius={radius} glow={glow} />
      ) : (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius ?? 999, borderTopWidth: 1, borderTopColor: TOP_LIGHT }]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ centre: { alignItems: "center", justifyContent: "center" } });
