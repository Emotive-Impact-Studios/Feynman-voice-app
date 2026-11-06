// A drawn scene on its soft glass panel. The clock, the build-in and the
// smoothed slider value live on the UI thread, and each frame is recorded as
// one Skia picture, so dozens of moving marks stay smooth. Under Reduce
// Motion nothing loops, but the slider still changes the scene.
import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Canvas, Group, Picture, createPicture, useFont } from "@shopify/react-native-skia";
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { drawScene, speedAt, VIEW_H, VIEW_W } from "./draw";
import type { Change, Scene } from "./types";

const MONO = require("@expo-google-fonts/geist-mono/400Regular/GeistMono_400Regular.ttf");

export function SceneView({ scene, changes = [], value, label }: { scene: Scene; changes?: Change[]; value?: SharedValue<number>; label?: string }) {
  const [width, setWidth] = useState(0);
  const font = useFont(MONO, 8.6);
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 1.2 : 0);
  const T = useSharedValue(reduce ? 1.2 : 0);
  const v = useSharedValue(value ? value.value : 0);
  const intro = useSharedValue(reduce ? 1 : 0);

  useFrameCallback((info) => {
    "worklet";
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const target = value ? value.value : 0;
    if (reduce) {
      v.value = target;
      return;
    }
    v.value += (target - v.value) * Math.min(1, dt * 5);
    t.value += dt;
    T.value += dt * speedAt(changes, v.value);
    if (intro.value < 1) intro.value = Math.min(1, intro.value + dt * 0.9);
  });

  const k = width / VIEW_W;
  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      "worklet";
      drawScene(canvas, scene, changes, { t: t.value, T: T.value, v: v.value, intro: intro.value, still: reduce }, font);
    }),
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{
        borderRadius: 26,
        backgroundColor: "rgba(255,255,255,0.035)",
        overflow: "hidden",
        aspectRatio: VIEW_W / VIEW_H,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.06)",
      }}
    >
      {width > 0 && (
        <Canvas style={{ width, height: (width * VIEW_H) / VIEW_W }}>
          <Group transform={[{ scale: k }]}>
            <Picture picture={picture} />
          </Group>
        </Canvas>
      )}
    </View>
  );
}
