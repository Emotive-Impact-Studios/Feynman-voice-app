// Today, from the canvas board "THE APP: start here". One way in, your last
// topic to pick up, and the gaps from your sessions to explain again. (The
// spaced review queue, build step 6, will decide which day each comes back.)
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ago, greeting, openGaps, type Profile, type SavedGap } from "../data/profile";
import { colour } from "../theme";
import { Glass, Icon, Label, PillButton, T } from "../ui/kit";
import { spring } from "../ui/motion";
import { SilverRing } from "../ui/SilverRing";
import { homeStyles } from "./styles";

export function Today({
  profile,
  top,
  bottom,
  onNew,
  onTopic,
  onGap,
}: {
  profile: Profile;
  top: number;
  bottom: number;
  onNew: () => void;
  onTopic: (t: string) => void;
  onGap: (topic: string, gap: SavedGap) => void;
}) {
  const last = profile.topics[0];
  const gaps = openGaps(profile);
  return (
    <ScrollView contentContainerStyle={[homeStyles.scroll, { paddingTop: top + 70, paddingBottom: bottom + 130 }]} showsVerticalScrollIndicator={false}>
      <In d={1}>
        <T size={16} tone="soft" style={{ marginTop: 70 }}>
          {greeting()}
          {profile.name ? `, ${profile.name}.` : "."}{" "}
          <T size={16} tone="muted">
            {gaps.length === 0 ? "All caught up." : gaps.length === 1 ? "One gap to go over." : `${gaps.length} gaps to go over.`}
          </T>
        </T>
        <T size={40} weight="medium" style={{ marginTop: 8, lineHeight: 42 }}>
          What are we{"\n"}explaining?
        </T>
      </In>
      <In d={2}>
        <Pressable onPress={onNew} accessibilityRole="button" accessibilityLabel="Pick a topic, or say one">
          <Glass style={styles.start}>
            <T size={16} tone="soft" style={{ flex: 1 }}>
              Pick a topic, or say one
            </T>
            <SilverRing width={52} height={52}>
              <Icon name="mic" />
            </SilverRing>
          </Glass>
        </Pressable>
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
        <Label style={{ marginTop: 22 }}>Explain again</Label>
        {gaps.length === 0 ? (
          <T size={15} tone="soft" style={{ marginTop: 10 }}>
            {profile.topics.length ? "Nothing to go over. Gaps from your sessions come back here." : "Nothing yet. Explain your first topic and this fills up."}
          </T>
        ) : (
          <Glass style={styles.list}>
            {gaps.slice(0, 5).map(({ topic, gap }, i) => (
              <Pressable
                key={gap.id}
                onPress={() => onGap(topic, gap)}
                accessibilityRole="button"
                accessibilityLabel={`Explain again: ${gap.title}`}
                style={({ pressed }) => [styles.gapRow, i > 0 && styles.divider, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={[styles.dot, gap.kind === "skipped" ? { borderWidth: 1.5, borderColor: colour.student } : { backgroundColor: colour.gap }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={12} style={{ color: gap.kind === "skipped" ? colour.student : "#F5B09A" }}>
                    {gap.named ? "You named it" : gap.kind === "skipped" ? "Skipped" : gap.kind === "muddled" ? "Not quite" : "Gap"} · {topic}
                  </T>
                  <T size={15} lines={1}>
                    {gap.title}
                  </T>
                </View>
                <T size={13} tone="muted">
                  {ago(gap.at)}
                </T>
              </Pressable>
            ))}
          </Glass>
        )}
      </In>
    </ScrollView>
  );
}

export function In({ d, children }: { d: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(d * 80).springify().duration(spring.smooth.duration).dampingRatio(spring.smooth.dampingRatio)}>
      {children}
    </Animated.View>
  );
}

export const mins = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);

const styles = StyleSheet.create({
  start: { marginTop: 18, height: 64, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 22, paddingRight: 6 },
  card: { marginTop: 10, borderRadius: 24, padding: 16, paddingBottom: 14 },
  list: { marginTop: 10, borderRadius: 24 },
  gapRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  divider: { borderTopWidth: 1, borderTopColor: colour.hairlineSoft },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
