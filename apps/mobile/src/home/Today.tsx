// Today, from the canvas board "THE APP: start here". One way in, your last
// topic to pick up, and reviews (empty until gap analysis and the review
// queue exist, build steps 4 and 6).
import { Press } from "../ui/Press";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { ago, minutesLeft, softStreak, todaySentence, type Profile } from "../data/profile";
import { colour, font } from "../theme";
import { Glass, Icon, Label, PillButton, T } from "../ui/kit";
import { riseIn, STAGGER_MS } from "../ui/motion";
import { Soft } from "../ui/Soft";
import { homeStyles } from "./styles";

export function Today({ profile, top, bottom, onNew, onTopic, onLook }: { profile: Profile; top: number; bottom: number; onNew: () => void; onTopic: (t: string) => void; onLook?: () => void }) {
  const last = profile.topics[0];
  const streak = softStreak(profile.days);
  return (
    <ScrollView contentContainerStyle={[homeStyles.scroll, { paddingTop: top + 70, paddingBottom: bottom + 130 }]} showsVerticalScrollIndicator={false}>
      <In d={1}>
        <Text style={styles.sentence} accessibilityRole="header">
          {todaySentence(profile).map((part, i) =>
            part.hl ? (
              <Text key={i} style={[styles.hl, part.hl === "gap" && styles.hlGap]}>
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
        </Text>
      </In>
      <In d={2}>
        <View style={styles.stats}>
          <StatLine icon="clock">{minutesLeft(profile)} min left</StatLine>
          {streak > 0 && <StatLine icon="flame">{streak}-day streak</StatLine>}
          {profile.topics.length > 0 && (
            <StatLine icon="up" tone="student">
              {profile.topics.length} {profile.topics.length === 1 ? "topic" : "topics"} explained
            </StatLine>
          )}
        </View>
        <Press onPress={onNew} accessibilityRole="button" accessibilityLabel="Pick a topic, or say one">
          <Glass style={styles.start}>
            <T size={16} tone="soft" style={{ flex: 1 }}>
              Pick a topic, or say one
            </T>
            {/* The pill clips, so no glow here: just the lit fill. */}
            <Soft lit glow={false} style={{ width: 52, height: 52 }}>
              <Icon name="mic" color={colour.onLight} />
            </Soft>
          </Glass>
        </Press>
        {onLook && (
          <Press onPress={onLook} accessibilityRole="button" accessibilityLabel="Teach me this thing: show Fenny something with the camera">
            <Glass style={styles.look}>
              <Icon name="camera" size={19} color={colour.soft} />
              <T size={15} tone="soft" style={{ flex: 1 }}>
                Or show Fenny something real
              </T>
            </Glass>
          </Press>
        )}
      </In>

      {last && (
        <In d={3}>
          <Label style={{ marginTop: 26 }}>Pick up where you left off</Label>
          <Glass style={styles.card}>
            <T size={18} weight="semibold">
              {last.title}
            </T>
            <T size={13} tone="soft" style={{ marginTop: 3 }}>
              {last.sessions === 1 ? "1 session" : `${last.sessions} sessions`} · {mins(last.seconds)} explaining · {ago(last.at)}
            </T>
            <PillButton label="Explain it again" variant="solid" onPress={() => onTopic(last.title)} style={{ height: 46, marginTop: 12 }} />
          </Glass>
        </In>
      )}

      <In d={4}>
        <Label style={{ marginTop: 22 }}>Due for review</Label>
        <T size={15} tone="soft" style={{ marginTop: 10 }}>
          {profile.topics.length
            ? "Nothing to say again yet. Gaps from your sessions will come back here once gap checking is built."
            : "Nothing yet. Explain your first topic and this fills up."}
        </T>
      </In>
    </ScrollView>
  );
}

/** A section arriving in turn: d = 1 comes first, each next one 80 ms later. */
export function In({ d, children }: { d: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return <Animated.View entering={reduce ? undefined : riseIn((d - 1) * STAGGER_MS + 40)}>{children}</Animated.View>;
}

function StatLine({ icon, tone = "soft", children }: { icon: "clock" | "flame" | "up"; tone?: "soft" | "student"; children: React.ReactNode }) {
  const c = tone === "student" ? colour.student : colour.muted;
  const p = { stroke: c, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <View style={styles.stat}>
      <Svg width={14} height={14} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
        {icon === "clock" && (
          <>
            <Circle cx={12} cy={12} r={8.5} {...p} />
            <Path d="M12 7.5V12l3 2" {...p} />
          </>
        )}
        {icon === "flame" && <Path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 2 1 3 2 3 4" {...p} />}
        {icon === "up" && (
          <>
            <Path d="M4 16l5-5 4 4 7-7" {...p} />
            <Path d="M15 8h5v5" {...p} />
          </>
        )}
      </Svg>
      <T size={13} tone={tone}>
        {children}
      </T>
    </View>
  );
}

export const mins = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);

const styles = StyleSheet.create({
  sentence: { marginTop: 38, fontFamily: font.regular, fontSize: 27, lineHeight: 27 * 1.32, letterSpacing: -27 * 0.015, color: "#D6D9DE" },
  // The numbers in the sentence: silver-blue with a dotted underline; gaps in coral.
  hl: { fontFamily: font.medium, color: "#C9D6F0", textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: "rgba(169,190,230,0.75)" },
  hlGap: { color: "#F5B09A", textDecorationColor: "rgba(240,154,128,0.75)" },
  stats: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 16 },
  stat: { flexDirection: "row", alignItems: "center", gap: 6 },
  start: { marginTop: 18, height: 64, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 22, paddingRight: 6 },
  look: { marginTop: 10, height: 50, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20 },
  card: { marginTop: 10, borderRadius: 24, padding: 16, paddingBottom: 14 },
});
