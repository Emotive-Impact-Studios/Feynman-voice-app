// The lesson's pictures: a handful of simple diagram templates that the
// lesson writer fills with labels. Drawn in code, in the app's colours, and
// they build in one piece at a time so the eye follows the idea.
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import type { PictureKind } from "../api";
import { colour } from "../theme";
import { T } from "../ui/kit";
import { spring } from "../ui/motion";

const NODE_BG = "rgba(169,190,230,0.10)";
const NODE_LIT = "rgba(169,190,230,0.20)";

/** One piece arriving: fades and rises into place after `i` beats. */
function Step({ i, children, style }: { i: number; children: React.ReactNode; style?: object }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) v.value = withDelay(180 + i * 220, withSpring(1, spring.bouncy));
  }, [i, reduce, v]);
  const a = useAnimatedStyle(() => ({ opacity: Math.min(1, v.value), transform: [{ translateY: (1 - v.value) * 10 }, { scale: 0.94 + 0.06 * v.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

function Node({ label, lit, wide }: { label: string; lit?: boolean; wide?: boolean }) {
  return (
    <View
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        backgroundColor: lit ? NODE_LIT : NODE_BG,
        minWidth: wide ? undefined : 84,
        alignItems: "center",
      }}
    >
      <T size={13} weight="medium" style={{ textAlign: "center", color: lit ? colour.text : colour.soft }}>
        {label}
      </T>
    </View>
  );
}

function Arrow({ down }: { down?: boolean }) {
  return (
    <Svg width={down ? 16 : 22} height={down ? 22 : 16} viewBox={down ? "0 0 16 22" : "0 0 22 16"}>
      <Path
        d={down ? "M8 2v16M3 13l5 5 5-5" : "M2 8h16M13 3l5 5-5 5"}
        stroke={colour.student}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.8}
      />
    </Svg>
  );
}

export function Picture({ kind, labels }: { kind: PictureKind; labels: string[] }) {
  const l = labels.filter(Boolean).slice(0, 5);
  if (kind === "none" || l.length < 2) return null;

  if (kind === "flow") {
    // Three short steps fit across; longer chains run down the screen.
    const across = l.length <= 3 && l.every((x) => x.length <= 14);
    return (
      <View style={{ flexDirection: across ? "row" : "column", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "nowrap" }}>
        {l.map((x, i) => (
          <View key={i} style={{ flexDirection: across ? "row" : "column", alignItems: "center", gap: 8, flexShrink: 1 }}>
            {i > 0 && (
              <Step i={i * 2 - 1}>
                <Arrow down={!across} />
              </Step>
            )}
            <Step i={i * 2} style={{ flexShrink: 1 }}>
              <Node label={x} lit={i === l.length - 1} />
            </Step>
          </View>
        ))}
      </View>
    );
  }

  if (kind === "compare") {
    const [a, b, diff] = l;
    return (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Step i={0} style={{ flex: 1 }}>
            <Node label={a} />
          </Step>
          <Step i={1} style={{ flex: 1 }}>
            <Node label={b} lit />
          </Step>
        </View>
        {diff ? (
          <Step i={2} style={{ alignItems: "center" }}>
            <T size={12.5} weight="mono" tone="student" style={{ letterSpacing: 1, textTransform: "uppercase", textAlign: "center" }}>
              {diff}
            </T>
          </Step>
        ) : null}
      </View>
    );
  }

  if (kind === "layers") {
    return (
      <View style={{ gap: 6, alignItems: "stretch" }}>
        {l.map((x, i) => (
          <Step key={i} i={i}>
            <View style={{ marginHorizontal: i * 10, paddingVertical: 11, borderRadius: 14, backgroundColor: i === 0 ? NODE_LIT : NODE_BG, alignItems: "center" }}>
              <T size={13} weight="medium" style={{ color: i === 0 ? colour.text : colour.soft }}>
                {x}
              </T>
            </View>
          </Step>
        ))}
      </View>
    );
  }

  if (kind === "parts") {
    const [whole, ...parts] = l;
    return (
      <View style={{ alignItems: "center", gap: 10 }}>
        <Step i={0}>
          <Node label={whole} lit />
        </Step>
        <Step i={1}>
          <Svg width={parts.length * 64} height={18}>
            {parts.map((_, i) => {
              const x = 32 + i * 64;
              const mid = (parts.length * 64) / 2;
              return <Path key={i} d={`M${mid} 0 L${x} 18`} stroke={colour.student} strokeWidth={1.4} opacity={0.6} />;
            })}
          </Svg>
        </Step>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {parts.map((x, i) => (
            <Step key={i} i={i + 2}>
              <Node label={x} />
            </Step>
          ))}
        </View>
      </View>
    );
  }

  // cycle: the steps sit round a slowly drawn loop.
  const size = 250;
  const r = 86;
  const c = size / 2;
  return (
    <View style={{ width: size, height: size, alignSelf: "center" }}>
      <Step i={0} style={{ position: "absolute", left: 0, top: 0 }}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={r} stroke={colour.student} strokeOpacity={0.35} strokeWidth={1.4} strokeDasharray="4 6" fill="none" />
        </Svg>
      </Step>
      {l.map((x, i) => {
        const a = -Math.PI / 2 + (i / l.length) * Math.PI * 2;
        return (
          <Step
            key={i}
            i={i + 1}
            style={{ position: "absolute", left: c + Math.cos(a) * r - 50, top: c + Math.sin(a) * r - 20, width: 100, alignItems: "center" }}
          >
            <Node label={x} lit={i === 0} wide />
          </Step>
        );
      })}
    </View>
  );
}
