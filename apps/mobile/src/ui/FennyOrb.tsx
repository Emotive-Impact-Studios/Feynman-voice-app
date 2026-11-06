// Fenny's light, drawn in code (from the design thread's Skia sketch).
// A silver-blue light with a bright core and three soft lobes that drift
// round it. `energy` (0 to 1) swells it and speeds it up while Fenny
// speaks or thinks. It fades to nothing well inside its square, so there is
// never a visible edge or box. Still under Reduce Motion.
//
// Glance (canvas board "Glance round 3"): in a call, two eyes of light rise
// out of the bright core. The orb draws in a little and the core dims behind
// them so the face reads, and they sink back into the core at rest. `mood`
// sets how the eyes look; it defaults to "rest", the plain orb.
//
// Personality outside the call: `peek` lets a resting orb open its eyes
// now and then, glance round and sink back (the nav button, the intro).
// `nod` (0 to 1) makes the eyes nod along while the learner is talking.
// Small orbs get bigger eyes so the face still reads at button size.
//
// Character layer (reactions.ts), on top of the mood like a state machine's
// layers: `cue` plays a one-off reaction (hello, aha, yay, hmm, oops, boop)
// with squash and stretch, hops and smiles. `talk` (0 to 1) bobs the eyes
// and light in a speech rhythm while Fenny speaks. `touchable` lets the eyes
// follow a finger held on the orb, and a tap gets a squish (boop).
import { useEffect, useRef, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { MOODS, type FennyMood } from "./mood";
import { NEUTRAL, REACTIONS, type Channel, type Cue } from "./reactions";

const orb = Skia.RuntimeEffect.Make(`
uniform float2 size;
uniform float t;
uniform float level;
uniform float eyes;     // 0 = no eyes (rest), 1 = eyes showing
uniform float2 look;    // where the eyes look, in orb units
uniform float eyeL;     // size of each eye
uniform float eyeR;
uniform float open;     // 1 = round open eyes, low = flat (lost)
uniform float slant;    // radians: inner ends up when lost
uniform float happy;    // 0..1: eyes become smiling arcs
uniform float tilt;     // radians: the whole face leans (curious)
uniform float core;     // brightness of the core behind the eyes
uniform float dull;     // 0..1: greyer and dimmer (lost)
uniform float boost;    // 0..1: small orb, so bigger eyes
uniform float nod;      // 0..1: nodding along while the learner talks
uniform float2 squash;  // body and face scale: squash and stretch
uniform float hop;      // vertical offset, negative is up
uniform float pop;      // eye size
uniform float squint;   // 0..1: eyes narrow
uniform float talk;     // 0..1: Fenny is speaking

float blob(float2 p, float2 c, float r) {
  float d = length(p - c) / r;
  return exp(-d * d * 2.2);
}

float2 rot(float2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return float2(c * v.x - s * v.y, s * v.x + c * v.y);
}

// Rounded box: b = half size, corners as round as the short side.
float pill(float2 q, float2 b) {
  float r = min(b.x, b.y);
  float2 d = abs(q) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

// The top half of a ring with round ends: a smiling eye. A true distance
// everywhere, so its glow fades evenly and leaves no line across the orb.
float arc(float2 q, float rad, float th) {
  if (q.y < 0.0) return abs(length(q) - rad) - th;
  return length(float2(abs(q.x) - rad, q.y)) - th;
}

// One eye: a pill that can flatten, blink and turn into an arc.
float eye(float2 q, float sz, float openNow, float ang) {
  q = rot(q, ang);
  float2 b = float2(0.085, max(0.15 * openNow, 0.018)) * sz;
  float dPill = pill(q, b);
  float dArc = arc(q - float2(0.0, 0.07 * sz), 0.085 * sz, 0.022 * sz);
  return mix(dPill, dArc, happy);
}

half4 main(float2 xy) {
  float2 pRaw = (xy - size * 0.5) / (size.x * 0.5);
  // Squash, stretch and hop move the whole character, body and face.
  float2 p = (pRaw - float2(0.0, hop)) / squash;
  float2 p0 = p;
  // Speech rhythm: uneven syllables, louder and softer phrases.
  float syl = talk * (0.5 + 0.5 * sin(t * 10.5 + 2.0 * sin(t * 2.3))) * (0.55 + 0.45 * sin(t * 1.7 + 1.0));
  float s = 1.0 + 0.06 * sin(t * (1.3 + level * 3.0)) + 0.10 * level + 0.03 * syl;
  // With eyes showing, the orb draws in so the face carries it.
  s *= mix(1.0, mix(0.8, 0.92, boost), eyes);
  p /= s;
  float sp = 0.35 + level * 0.9;
  float a = blob(p, float2(-0.28 + 0.16 * sin(t * sp), -0.12 + 0.12 * cos(t * sp * 1.3)), 0.62);
  float b = blob(p, float2( 0.26 + 0.14 * cos(t * sp * 0.8), -0.22 + 0.14 * sin(t * sp * 1.1)), 0.58);
  float c = blob(p, float2( 0.04 + 0.12 * sin(t * sp * 1.7),  0.30 + 0.10 * cos(t * sp * 0.9)), 0.55);
  // The core widens and dims behind the eyes, but never goes out.
  float coreBlob = blob(p, float2(-0.06, -0.08), mix(0.42, 0.55, eyes));
  float coreGain = mix(1.0, core, eyes) + 0.2 * syl * eyes;

  half3 colA = half3(0.557, 0.651, 0.831);
  half3 colB = half3(0.780, 0.812, 0.863);
  half3 colC = half3(0.431, 0.525, 0.737);
  half3 white = half3(1.0, 1.0, 1.0);

  half3 col = colA * a * 0.65 + colB * b * 0.55 + colC * c * 0.65 + white * coreBlob * 0.95 * coreGain;
  // Soft roll-off so overlapping lobes glow rather than clip to flat white.
  col = col / (1.0 + col * 0.3);
  float alpha = clamp(a * 0.7 + b * 0.6 + c * 0.6 + coreBlob * mix(1.0, 0.6 + 0.4 * core, eyes), 0.0, 1.0);
  // Lost: greyer and a touch dimmer.
  float grey = dot(col, half3(0.299, 0.587, 0.114));
  col = mix(col, half3(grey), 0.6 * dull) * (1.0 - 0.2 * dull);

  // The eyes, in face space: leaned by tilt, moved by look.
  if (eyes > 0.001) {
    // Alive while looking: small idle glances, and a nod while they talk.
    float2 drift = float2(sin(t * 0.53) * 0.012, sin(t * 0.71) * 0.008);
    float2 bob = float2(0.0, nod * 0.018 * sin(t * 5.5) - 0.012 * syl);
    float grow = (1.0 + 0.3 * boost) * pop;
    float2 f = (rot(p0, -tilt) - look - drift - bob - float2(0.0, -0.06)) / grow;
    // A blink every few seconds, quick and soft.
    float ph = fract(t / 5.2);
    float bk = (ph - 0.94) / 0.012;
    float blink = 1.0 - 0.9 * exp(-bk * bk);
    float o = open * mix(blink, 1.0, happy) * (1.0 - 0.6 * squint) * (1.0 - 0.2 * syl);
    // Inner ends lift when lost (worried, not cross).
    float dl = eye(f - float2(-0.145, 0.0), eyeL, o,  slant);
    float dr = eye(f - float2( 0.145, 0.0), eyeR, o, -slant);
    // Back to orb units, so the edge below is the same width at any size.
    float d = min(dl, dr) * grow;
    // Soft edge, like the light it came from, and a little glow round it.
    float px = 2.0 / size.x;
    // Soft on the big orb, crisper on a small one so the eyes don't blur together.
    float body = 1.0 - smoothstep(-px * mix(2.0, 0.6, boost), px * mix(3.0, 1.0, boost), d);
    float glow = exp(-max(d, 0.0) * 22.0) * 0.35 * (1.0 - 0.6 * boost);
    float e = eyes * clamp(body * 0.94 + glow * (1.0 - body), 0.0, 1.0);
    col = mix(col, white, e);
    alpha = max(alpha, e);
  }

  // Fade out before the square's edge even when it swells, so no box shows.
  float edge = smoothstep(1.0, 0.62, length(p)) * smoothstep(0.98, 0.84, length(p0));
  // The square's own edge is fixed, whatever the character is doing.
  edge *= smoothstep(0.99, 0.9, length(pRaw));
  alpha *= edge;
  float g = fract(sin(dot(xy, float2(12.9898, 78.233)) + t) * 43758.5453);
  col = max(col + (g - 0.5) * 0.025, half3(0.0));
  return half4(col * alpha, alpha);
}
`);

const SPRING = { duration: 700, dampingRatio: 0.78 } as const;
/** How a reaction settles after its last key: a soft wobble, like something with a little weight. */
const SETTLE = { duration: 520, dampingRatio: 0.6 } as const;
const CHANNELS = Object.keys(NEUTRAL) as Channel[];
/** Channels that ease back rather than wobble (a smile shouldn't bounce). */
const EASE_BACK = new Set<Channel>(["happy", "wake", "squint"]);

/** Draws the orb in a `size` square. The visible light fills about two thirds of it. */
export function FennyOrb({
  size,
  energy = 0,
  mood = "rest",
  peek = false,
  nod = 0,
  talk = 0,
  cue,
  touchable = false,
  onTap,
}: {
  size: number;
  energy?: number;
  mood?: FennyMood;
  /** At rest, open the eyes now and then for a look round. */
  peek?: boolean;
  /** 0 to 1: nod along (the learner is talking). */
  nod?: number;
  /** 0 to 1: Fenny is speaking, so the face moves in a speech rhythm. */
  talk?: number;
  /** A one-off reaction. Plays each time `cue.n` changes. */
  cue?: Cue | null;
  /** Eyes follow a finger held on the orb, and a tap gets a boop. */
  touchable?: boolean;
  onTap?: () => void;
}) {
  const reduce = useReducedMotion();
  const peekMood = usePeek(peek && mood === "rest" && !reduce);
  const shown: FennyMood = peekMood ?? mood;
  const t = useSharedValue(0);
  const level = useSharedValue(energy);
  const nodding = useSharedValue(nod);
  const talking = useSharedValue(talk);
  const m = MOODS[shown];
  const eyes = useSharedValue(m.eyes);
  const lookX = useSharedValue(m.look[0]);
  const lookY = useSharedValue(m.look[1]);
  const eyeL = useSharedValue(m.eyeL);
  const eyeR = useSharedValue(m.eyeR);
  const open = useSharedValue(m.open);
  const slant = useSharedValue(m.slant);
  const happy = useSharedValue(m.happy);
  const tilt = useSharedValue(m.tilt);
  const core = useSharedValue(m.core);
  const dull = useSharedValue(m.dull);
  // The reaction layer, one value per channel, at neutral when nothing plays.
  const r = useReactionLayer();
  // A finger on the orb: where it is (orb units) and whether it is down.
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const held = useSharedValue(0);
  // Below about 150 px of canvas the eyes grow, so a button-sized orb still has a face.
  const boost = Math.min(1, Math.max(0, (150 - size) / 90));
  useEffect(() => {
    if (reduce) return;
    // Seconds, running for a very long time; restarts after about 11 days.
    t.value = withRepeat(withTiming(1e6, { duration: 1e9, easing: Easing.linear }), -1);
  }, [reduce, t]);
  useEffect(() => {
    level.value = withSpring(energy, { duration: 350, dampingRatio: 0.9 });
  }, [energy, level]);
  useEffect(() => {
    nodding.value = reduce ? 0 : withSpring(nod, { duration: 400, dampingRatio: 0.9 });
  }, [nod, reduce, nodding]);
  useEffect(() => {
    talking.value = reduce ? 0 : withSpring(talk, { duration: 300, dampingRatio: 0.9 });
  }, [talk, reduce, talking]);
  useEffect(() => {
    const to = MOODS[shown];
    // Reduce Motion: change mood at once, no springs.
    const go = (v: { value: number }, n: number) => {
      v.value = reduce ? n : withSpring(n, SPRING);
    };
    go(eyes, to.eyes);
    go(lookX, to.look[0]);
    go(lookY, to.look[1]);
    go(eyeL, to.eyeL);
    go(eyeR, to.eyeR);
    go(open, to.open);
    go(slant, to.slant);
    // The smile swaps in quickly rather than morphing slowly.
    happy.value = reduce ? to.happy : withTiming(to.happy, { duration: 220 });
    go(tilt, to.tilt);
    go(core, to.core);
    go(dull, to.dull);
  }, [shown, reduce, eyes, lookX, lookY, eyeL, eyeR, open, slant, happy, tilt, core, dull]);
  // Play a reaction when the cue changes. Reduce Motion: none.
  const play = (name: Cue["name"]) => {
    if (reduce) return;
    const reaction = REACTIONS[name];
    for (const ch of CHANNELS) {
      const track = reaction[ch];
      if (!track) continue;
      const steps = [];
      let at = 0;
      for (const [ms, value] of track) {
        steps.push(withTiming(value, { duration: Math.max(16, ms - at), easing: Easing.inOut(Easing.cubic) }));
        at = ms;
      }
      steps.push(EASE_BACK.has(ch) ? withTiming(NEUTRAL[ch], { duration: 320, easing: Easing.out(Easing.cubic) }) : withSpring(NEUTRAL[ch], SETTLE));
      r[ch].value = withSequence(...steps);
    }
  };
  const lastCue = useRef(cue?.n);
  useEffect(() => {
    if (!cue || cue.n === lastCue.current) return;
    lastCue.current = cue.n;
    play(cue.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.n]);
  const uniforms = useDerivedValue(() => {
    // A reaction or a finger can bring the eyes up on a resting orb; the
    // core dims behind them so they show, as when a mood opens them.
    const woken = Math.max(r.wake.value, held.value) * (1 - eyes.value);
    const eyesNow = Math.max(eyes.value, r.wake.value, held.value);
    const coreNow = core.value - (core.value - Math.min(core.value, 0.4)) * woken;
    return {
      size: [size, size],
      t: t.value,
      level: level.value,
      eyes: eyesNow,
      look: [lookX.value + r.lx.value + gx.value, lookY.value + r.ly.value + gy.value],
      eyeL: eyeL.value,
      eyeR: eyeR.value,
      open: open.value,
      slant: slant.value,
      happy: Math.min(1, happy.value + r.happy.value),
      tilt: tilt.value + r.tilt.value,
      core: coreNow,
      dull: dull.value,
      boost,
      nod: nodding.value,
      squash: [r.sx.value, r.sy.value],
      hop: r.hop.value,
      pop: r.pop.value,
      squint: r.squint.value,
      talk: talking.value,
    };
  });
  // Touch: the eyes follow the finger, and a short tap is a boop.
  const down = useRef({ at: 0, x: 0, y: 0 });
  const follow = (e: GestureResponderEvent) => {
    const half = size / 2;
    const dx = Math.max(-1, Math.min(1, (e.nativeEvent.locationX - half) / half));
    const dy = Math.max(-1, Math.min(1, (e.nativeEvent.locationY - half) / half));
    gx.value = withSpring(dx * 0.07, { duration: 250, dampingRatio: 0.9 });
    gy.value = withSpring(dy * 0.06, { duration: 250, dampingRatio: 0.9 });
  };
  const touch = touchable && !reduce
    ? {
        onStartShouldSetResponder: () => true,
        onResponderGrant: (e: GestureResponderEvent) => {
          down.current = { at: Date.now(), x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
          held.value = withSpring(1, SPRING);
          follow(e);
          Haptics.selectionAsync().catch(() => {});
        },
        onResponderMove: follow,
        onResponderRelease: (e: GestureResponderEvent) => {
          held.value = withSpring(0, SPRING);
          gx.value = withSpring(0, SPRING);
          gy.value = withSpring(0, SPRING);
          const d = down.current;
          const moved = Math.hypot(e.nativeEvent.locationX - d.x, e.nativeEvent.locationY - d.y);
          if (Date.now() - d.at < 350 && moved < 12) {
            play("boop");
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
            onTap?.();
          }
        },
        onResponderTerminate: () => {
          held.value = withSpring(0, SPRING);
          gx.value = withSpring(0, SPRING);
          gy.value = withSpring(0, SPRING);
        },
      }
    : null;
  if (!orb) return null;
  const canvas = (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Fill>
        <Shader source={orb} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
  if (!touch) return canvas;
  return (
    <View style={{ width: size, height: size }} {...touch} accessibilityRole="button" accessibilityLabel="Fenny">
      {canvas}
    </View>
  );
}

/** One shared value per reaction channel, starting at neutral. */
function useReactionLayer(): Record<Channel, SharedValue<number>> {
  return {
    sx: useSharedValue(NEUTRAL.sx),
    sy: useSharedValue(NEUTRAL.sy),
    hop: useSharedValue(NEUTRAL.hop),
    pop: useSharedValue(NEUTRAL.pop),
    tilt: useSharedValue(NEUTRAL.tilt),
    happy: useSharedValue(NEUTRAL.happy),
    lx: useSharedValue(NEUTRAL.lx),
    ly: useSharedValue(NEUTRAL.ly),
    squint: useSharedValue(NEUTRAL.squint),
    wake: useSharedValue(NEUTRAL.wake),
  };
}

/**
 * Hands out reaction cues for a FennyOrb or LivingLight:
 *   const [cue, react] = useFennyCue(); ... react("yay"); <LivingLight cue={cue} />
 */
export function useFennyCue(): [Cue | null, (name: Cue["name"]) => void] {
  const [cue, setCue] = useState<Cue | null>(null);
  const react = (name: Cue["name"]) => setCue((c) => ({ name, n: (c?.n ?? 0) + 1 }));
  return [cue, react];
}

/**
 * A resting orb's look round: every 8 to 14 seconds the eyes open, glance
 * one way then the other, and sink back into the core. Null while resting.
 */
function usePeek(on: boolean): FennyMood | null {
  const [stage, setStage] = useState<FennyMood | null>(null);
  useEffect(() => {
    if (!on) {
      setStage(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const steps: [FennyMood | null, number][] = [
      ["peekRight", 900],
      ["peekLeft", 1000],
      [null, 0],
    ];
    const run = () => {
      let i = 0;
      const step = () => {
        const [mood, ms] = steps[i++];
        setStage(mood);
        timer = mood ? setTimeout(step, ms) : setTimeout(run, 8000 + Math.random() * 6000);
      };
      step();
    };
    timer = setTimeout(run, 2500 + Math.random() * 4000);
    return () => clearTimeout(timer);
  }, [on]);
  return stage;
}
