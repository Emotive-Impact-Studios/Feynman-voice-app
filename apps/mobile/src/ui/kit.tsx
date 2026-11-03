// Small shared pieces: type, glass, buttons, backgrounds, icons.
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colour, font, radius } from "../theme";

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
  const tight = size >= 24 ? { letterSpacing: -size * 0.025, lineHeight: size * 1.1 } : { lineHeight: size * 1.45 };
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

export function Backdrop({ source, opacity = 1, flip, offsetY = 0 }: { source: number; opacity?: number; flip?: boolean; offsetY?: number }) {
  return (
    <Image
      source={source}
      contentFit="cover"
      style={[StyleSheet.absoluteFill, { opacity, top: offsetY, transform: flip ? [{ scaleY: -1 }] : undefined }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        solid ? { backgroundColor: colour.text } : { backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: colour.hairline },
        { opacity: pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {children ?? (
        <T size={15} weight={solid ? "semibold" : "regular"} tone={solid ? "dark" : "text"}>
          {label}
        </T>
      )}
    </Pressable>
  );
}

export function RoundButton({ onPress, label, children, size = 48 }: { onPress?: () => void; label: string; children: ReactNode; size?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { width: size, height: size, opacity: pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
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
