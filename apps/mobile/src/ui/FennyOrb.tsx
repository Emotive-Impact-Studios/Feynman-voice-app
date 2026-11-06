// Fenny's light, drawn in code (from the design thread's Skia sketch).
// A silver-blue light with a bright core and three soft lobes that drift
// round it. `energy` (0 to 1) swells it and speeds it up while Fenny
// speaks or thinks. It fades to nothing well inside its square, so there is
// never a visible edge or box. Still under Reduce Motion.
import { useEffect } from "react";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";

const orb = Skia.RuntimeEffect.Make(`
uniform float2 size;
uniform float t;
uniform float level;

float blob(float2 p, float2 c, float r) {
  float d = length(p - c) / r;
  return exp(-d * d * 2.2);
}

half4 main(float2 xy) {
  float2 p = (xy - size * 0.5) / (size.x * 0.5);
  float2 p0 = p;
  float s = 1.0 + 0.06 * sin(t * (1.3 + level * 3.0)) + 0.10 * level;
  p /= s;
  float sp = 0.35 + level * 0.9;
  float a = blob(p, float2(-0.28 + 0.16 * sin(t * sp), -0.12 + 0.12 * cos(t * sp * 1.3)), 0.62);
  float b = blob(p, float2( 0.26 + 0.14 * cos(t * sp * 0.8), -0.22 + 0.14 * sin(t * sp * 1.1)), 0.58);
  float c = blob(p, float2( 0.04 + 0.12 * sin(t * sp * 1.7),  0.30 + 0.10 * cos(t * sp * 0.9)), 0.55);
  float core = blob(p, float2(-0.06, -0.08), 0.42);

  half3 colA = half3(0.557, 0.651, 0.831);
  half3 colB = half3(0.780, 0.812, 0.863);
  half3 colC = half3(0.431, 0.525, 0.737);
  half3 white = half3(1.0, 1.0, 1.0);

  half3 col = colA * a * 0.65 + colB * b * 0.55 + colC * c * 0.65 + white * core * 0.95;
  // Soft roll-off so overlapping lobes glow rather than clip to flat white.
  col = col / (1.0 + col * 0.3);
  float alpha = clamp(a * 0.7 + b * 0.6 + c * 0.6 + core, 0.0, 1.0);
  // Fade out before the square's edge even when it swells, so no box shows.
  alpha *= smoothstep(1.0, 0.62, length(p)) * smoothstep(0.98, 0.84, length(p0));
  float g = fract(sin(dot(xy, float2(12.9898, 78.233)) + t) * 43758.5453);
  col = max(col + (g - 0.5) * 0.025, half3(0.0));
  return half4(col * alpha, alpha);
}
`);

/** Draws the orb in a `size` square. The visible light fills about two thirds of it. */
export function FennyOrb({ size, energy = 0 }: { size: number; energy?: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  const level = useSharedValue(energy);
  useEffect(() => {
    if (reduce) return;
    // Seconds, running for a very long time; restarts after about 11 days.
    t.value = withRepeat(withTiming(1e6, { duration: 1e9, easing: Easing.linear }), -1);
  }, [reduce, t]);
  useEffect(() => {
    level.value = withSpring(energy, { duration: 350, dampingRatio: 0.9 });
  }, [energy, level]);
  const uniforms = useDerivedValue(() => ({ size: [size, size], t: t.value, level: level.value }));
  if (!orb) return null;
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Fill>
        <Shader source={orb} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}
