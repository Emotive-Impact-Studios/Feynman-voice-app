// The living background, drawn in code (canvas board "THE APP" .aura layer).
// Three blurred lights over a deep blue-black. Each drifts on its own slow
// loop, so the light is always moving a little and never repeats in step.
// Every screen has its own arrangement (a scene): moving between screens
// glides the lights to the new places, so the change of state is felt.
// No per-pixel shader, so the GPU work is small. Still under Reduce Motion.
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Blur, Canvas, Circle, Group, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

export type AuraScene = "today" | "topics" | "me" | "session" | "intro" | "topic";

// Where each light rests on each screen, as fractions of the screen, plus
// how bright the cool light is. Close enough to feel like one place, far
// enough apart that a change of screen visibly moves the light.
type Spot = { x: number; y: number };
// `top` is where the faint wash at the top of the screen is centred.
const SCENES: Record<AuraScene, { a: Spot; b: Spot; c: Spot; glow: number; top: number }> = {
  today: { a: { x: 0.12, y: 0.14 }, b: { x: 0.95, y: 0.36 }, c: { x: 0.45, y: 0.52 }, glow: 1, top: 0.35 },
  topics: { a: { x: 0.75, y: 0.1 }, b: { x: 0.05, y: 0.5 }, c: { x: 0.8, y: 0.7 }, glow: 0.9, top: 0.7 },
  me: { a: { x: 0.95, y: 0.28 }, b: { x: 0.25, y: 0.18 }, c: { x: 0.15, y: 0.72 }, glow: 0.85, top: 0.85 },
  topic: { a: { x: 0.5, y: 0.06 }, b: { x: 0.9, y: 0.55 }, c: { x: 0.2, y: 0.75 }, glow: 0.8, top: 0.5 },
  session: { a: { x: 0.5, y: 0.28 }, b: { x: 0.05, y: 0.7 }, c: { x: 0.95, y: 0.8 }, glow: 1.15, top: 0.5 },
  intro: { a: { x: 0.3, y: 0.3 }, b: { x: 0.8, y: 0.2 }, c: { x: 0.5, y: 0.7 }, glow: 1, top: 0.5 },
};

// The last scene shown anywhere, so a new screen starts from where the
// light was and glides on from there.
let lastScene: AuraScene = "today";

const SHIFT_MS = 1400;
const ease = Easing.bezier(0.25, 0.1, 0.25, 1);

function loop(duration: number) {
  return withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
}

export function FennyAura({ scene = "today" }: { scene?: AuraScene }) {
  const { width: W, height: H } = useWindowDimensions();
  const reduce = useReducedMotion();
  const from = SCENES[lastScene];
  // Scene positions, gliding when the scene changes.
  const ax = useSharedValue(from.a.x);
  const ay = useSharedValue(from.a.y);
  const bx = useSharedValue(from.b.x);
  const by = useSharedValue(from.b.y);
  const cx = useSharedValue(from.c.x);
  const cy = useSharedValue(from.c.y);
  const glow = useSharedValue(from.glow);
  const top = useSharedValue(from.top);
  // Three independent drifts (different lengths, so they never line up).
  const k1 = useSharedValue(0);
  const k2 = useSharedValue(0);
  const k3 = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    k1.value = loop(13000);
    k2.value = loop(17000);
    k3.value = loop(21000);
  }, [reduce, k1, k2, k3]);

  useEffect(() => {
    lastScene = scene;
    const to = SCENES[scene];
    const go = (v: { value: number }, n: number) => {
      v.value = reduce ? n : withTiming(n, { duration: SHIFT_MS, easing: ease });
    };
    go(ax, to.a.x);
    go(ay, to.a.y);
    go(bx, to.b.x);
    go(by, to.b.y);
    go(cx, to.c.x);
    go(cy, to.c.y);
    go(glow, to.glow);
    go(top, to.top);
  }, [scene, reduce, ax, ay, bx, by, cx, cy, glow, top]);

  // Drift of about a tenth of the screen round each resting place.
  const c1 = useDerivedValue(() => vec(W * (ax.value + 0.12 * (k1.value - 0.5)), H * (ay.value + 0.06 * (k2.value - 0.5))));
  const c2 = useDerivedValue(() => vec(W * (bx.value - 0.14 * (k2.value - 0.5)), H * (by.value + 0.07 * (k3.value - 0.5))));
  const c3 = useDerivedValue(() => vec(W * (cx.value + 0.1 * (k3.value - 0.5)), H * (cy.value - 0.06 * (k1.value - 0.5))));
  const r1 = useDerivedValue(() => W * (0.48 + 0.05 * k2.value));
  const r2 = useDerivedValue(() => W * (0.44 + 0.05 * k3.value));
  const o1 = useDerivedValue(() => Math.min(1, 0.85 * glow.value));
  const o2 = useDerivedValue(() => Math.min(1, 0.75 * glow.value));
  const wash = useDerivedValue(() => vec(W * top.value, 0));

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect x={0} y={0} width={W} height={H}>
        <RadialGradient c={wash} r={H * 0.9} colors={["#131925", "#0B0D11", "#08090B"]} positions={[0, 0.55, 1]} />
      </Rect>
      <Group blendMode="screen">
        <Blur blur={70} />
        <Circle c={c1} r={r1} color="rgba(59,79,120,0.6)" opacity={o1} />
        <Circle c={c2} r={r2} color="rgba(109,127,166,0.4)" opacity={o2} />
        <Circle c={c3} r={W * 0.36} color="rgba(201,211,230,0.12)" />
      </Group>
    </Canvas>
  );
}
