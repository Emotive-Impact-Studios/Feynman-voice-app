// Polished silver ring around the one control that matters on a screen.
import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { Canvas, RoundedRect, SweepGradient, vec } from "@shopify/react-native-skia";
import { silverStops } from "../theme";

interface Props {
  width: number;
  height: number;
  /** Corner radius of the outer edge. Defaults to a pill. */
  radius?: number;
  thickness?: number;
  fill?: string;
  children?: ReactNode;
  style?: ViewStyle;
}

export function SilverRing({ width, height, radius, thickness = 1.5, fill = "#16171A", children, style }: Props) {
  const r = radius ?? Math.min(width, height) / 2;
  return (
    <View style={[{ width, height }, style]}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <RoundedRect x={0} y={0} width={width} height={height} r={r}>
          <SweepGradient c={vec(width / 2, height / 2)} colors={silverStops} start={200} end={560} />
        </RoundedRect>
        <RoundedRect x={thickness} y={thickness} width={width - thickness * 2} height={height - thickness * 2} r={Math.max(0, r - thickness)} color={fill} />
      </Canvas>
      <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ centre: { alignItems: "center", justifyContent: "center" } });
