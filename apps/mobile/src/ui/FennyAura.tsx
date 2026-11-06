// The background, drawn in code to look like the old photo backgrounds
// (horizon.webp, aurora.webp): a near-black ground with ONE soft light and a
// fine grain, nothing else. The light drifts a little all the time, and each
// screen puts it somewhere else (a wash at the top on Today, over to the
// right on Topics, a low horizon in a session), so a change of screen glides
// it to its new place. Still under Reduce Motion.
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Blur, Canvas, Fill, Group, Oval, Rect, Shader, Skia } from "@shopify/react-native-skia";
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

export type AuraScene = "today" | "topics" | "me" | "session" | "intro" | "topic";

// The one light per screen: centre (fractions of the screen), size
// (fractions of width and height) and strength.
type Light = { x: number; y: number; w: number; h: number; o: number };
const SCENES: Record<AuraScene, Light> = {
  // Like aurora.webp: a soft silver-blue wash across the top.
  today: { x: 0.42, y: 0.1, w: 1.15, h: 0.2, o: 0.95 },
  topics: { x: 0.8, y: 0.08, w: 0.95, h: 0.18, o: 0.85 },
  me: { x: 0.18, y: 0.1, w: 0.95, h: 0.17, o: 0.8 },
  topic: { x: 0.5, y: 0.06, w: 1.0, h: 0.17, o: 0.7 },
  // Like horizon.webp: a low band of light under the conversation.
  session: { x: 0.5, y: 0.9, w: 1.4, h: 0.1, o: 0.5 },
  intro: { x: 0.5, y: 0.07, w: 1.2, h: 0.24, o: 0.7 },
};

let lastScene: AuraScene = "today";
const SHIFT_MS = 1400;
const ease = Easing.bezier(0.25, 0.1, 0.25, 1);

// Fine film grain, as the photos had. Static, and very faint.
const grain = Skia.RuntimeEffect.Make(`
half4 main(float2 xy) {
  float g = fract(sin(dot(floor(xy), float2(12.9898, 78.233))) * 43758.5453);
  return half4(half3(g), 1.0) * 0.035;
}
`);

export function FennyAura({ scene = "today" }: { scene?: AuraScene }) {
  const { width: W, height: H } = useWindowDimensions();
  const reduce = useReducedMotion();
  const from = SCENES[lastScene];
  const x = useSharedValue(from.x);
  const y = useSharedValue(from.y);
  const w = useSharedValue(from.w);
  const h = useSharedValue(from.h);
  const o = useSharedValue(from.o);
  const drift = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    drift.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }), -1, true);
    breath.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, drift, breath]);

  useEffect(() => {
    lastScene = scene;
    const to = SCENES[scene];
    const go = (v: { value: number }, n: number) => {
      v.value = reduce ? n : withTiming(n, { duration: SHIFT_MS, easing: ease });
    };
    go(x, to.x);
    go(y, to.y);
    go(w, to.w);
    go(h, to.h);
    go(o, to.o);
  }, [scene, reduce, x, y, w, h, o]);

  // A small drift sideways and a slow breath in size and brightness.
  const ow = useDerivedValue(() => W * w.value * (1 + 0.05 * breath.value));
  const oh = useDerivedValue(() => H * h.value * (1 + 0.08 * breath.value));
  const ox = useDerivedValue(() => W * (x.value + 0.06 * (drift.value - 0.5)) - ow.value / 2);
  const oy = useDerivedValue(() => H * (y.value + 0.015 * (drift.value - 0.5)) - oh.value / 2);
  const op = useDerivedValue(() => o.value * (0.88 + 0.12 * breath.value));

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect x={0} y={0} width={W} height={H} color="#07080A" />
      <Group opacity={op}>
        <Blur blur={55} />
        <Oval x={ox} y={oy} width={ow} height={oh} color="#9FB0CF" />
      </Group>
      {grain && (
        <Fill blendMode="plus">
          <Shader source={grain} />
        </Fill>
      )}
    </Canvas>
  );
}
