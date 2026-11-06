// Small shared pieces: type, glass, buttons, backgrounds, icons.
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colour, font, radius } from "../theme";
import { LivingPhoto } from "./LivingPhoto";
import { Press } from "./Press";

export const images = {
  horizon: require("../../assets/images/horizon.webp"),
  aurora: require("../../assets/images/aurora.webp"),
  cardReview: require("../../assets/images/card-review.webp"),
  cardGap: require("../../assets/images/card-gap.webp"),
  titanium: require("../../assets/images/panel-titanium.webp"),
};

type Tone = "text" | "dim" | "muted" | "soft" | "student" | "gap" | "dark";
const tones: Record<Tone, string> = {
  text: colour.text,
  dim: colour.textDim,
  muted: colour.muted,
  soft: colour.soft,
  student: colour.student,
  gap: colour.gap,
  dark: colour.onLight,
};

export function T({
  children,
  size = 16,
  weight = "regular",
  tone = "text",
  style,
  lines,
}: {
  children: ReactNode;
  size?: number;
  weight?: "regular" | "medium" | "semibold" | "mono";
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  lines?: number;
}) {
  const family = weight === "mono" ? font.mono : font[weight];
  // Inter tracked in a touch, as Linear does: tighter on headings than body.
  const tight = size >= 24 ? { letterSpacing: -size * 0.022, lineHeight: size * 1.1 } : { letterSpacing: weight === "mono" ? 0 : -size * 0.011, lineHeight: size * 1.45 };
  return (
    <Text numberOfLines={lines} style={[{ fontFamily: family, fontSize: size, color: tones[tone] }, tight, style]}>
      {children}
    </Text>
  );
}

/** Mono label in capitals, for small meta lines. */
export function Label({ children, tone = "muted", style }: { children: ReactNode; tone?: Tone; style?: StyleProp<TextStyle> }) {
  return (
    <T size={12} weight="mono" tone={tone} style={[{ letterSpacing: 1.6, textTransform: "uppercase" }, style]}>
      {children}
    </T>
  );
}

export function Glass({ children, style, strong }: { children?: ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean }) {
  return (
    <View style={[styles.glass, { backgroundColor: strong ? colour.glassStrong : colour.glass }, style]}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

/** A background photo, drifting slowly and shifting with tilt (see LivingPhoto). */
export function Backdrop(props: { source: number; opacity?: number; flip?: boolean; offsetY?: number }) {
  return <LivingPhoto {...props} />;
}

export function PillButton({
  label,
  onPress,
  variant = "glass",
  style,
  accessibilityLabel,
  children,
}: {
  label?: string;
  onPress?: () => void;
  variant?: "solid" | "glass";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children?: ReactNode;
}) {
  const solid = variant === "solid";
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[styles.pill, solid ? { backgroundColor: colour.text } : { backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: colour.hairline }, style]}
    >
      {children ?? (
        <T size={15} weight={solid ? "semibold" : "regular"} tone={solid ? "dark" : "text"}>
          {label}
        </T>
      )}
    </Press>
  );
}

export function RoundButton({ onPress, label, children, size = 48, on }: { onPress?: () => void; label: string; children: ReactNode; size?: number; on?: boolean }) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={on === undefined ? undefined : { expanded: on }}
      onPress={onPress}
      style={[styles.round, { width: size, height: size }, on && { backgroundColor: "rgba(255,255,255,0.18)" }]}
    >
      {children}
    </Press>
  );
}

export function Stat({ value, label, tone = "text" }: { value: string; label: string; tone?: Tone }) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <T size={28} weight="mono" tone={tone} style={{ letterSpacing: 0, lineHeight: 32 }}>
        {value}
      </T>
      <T size={12.5} tone="muted">
        {label}
      </T>
    </View>
  );
}

type IconName = "mic" | "close" | "check" | "pause" | "person" | "wave";
export function Icon({ name, size = 20, color = colour.text }: { name: IconName; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "mic" && (
        <>
          <Rect x={9} y={3} width={6} height={12} rx={3} {...p} />
          <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...p} />
        </>
      )}
      {name === "close" && <Path d="M6 6l12 12M18 6L6 18" {...p} />}
      {name === "check" && <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />}
      {name === "pause" && <Path d="M9 6v12M15 6v12" {...p} />}
      {name === "person" && (
        <>
          <Circle cx={12} cy={9} r={3.5} {...p} />
          <Path d="M5 20a7 7 0 0 1 14 0" {...p} />
        </>
      )}
      {name === "wave" && <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" {...p} />}
    </Svg>
  );
}

const styles = StyleSheet.create({
  glass: { borderRadius: radius.card, borderWidth: 1, borderColor: colour.hairline, overflow: "hidden" },
  pill: { height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  round: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colour.hairlineSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
