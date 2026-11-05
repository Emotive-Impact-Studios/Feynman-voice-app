// Today, from the canvas board "THE APP: start here". One way in, your last
// topic to pick up, and reviews (empty until gap analysis and the review
// queue exist, build steps 4 and 6).
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ago, greeting, type Profile } from "../data/profile";
import { Glass, Icon, Label, PillButton, T } from "../ui/kit";
import { spring } from "../ui/motion";
import { SilverRing } from "../ui/SilverRing";
import { homeStyles } from "./styles";

export function Today({ profile, top, bottom, onNew, onTopic }: { profile: Profile; top: number; bottom: number; onNew: () => void; onTopic: (t: string) => void }) {
  const last = profile.topics[0];
  return (
    <ScrollView contentContainerStyle={[homeStyles.scroll, { paddingTop: top + 70, paddingBottom: bottom + 130 }]} showsVerticalScrollIndicator={false}>
      <In d={1}>
        <T size={16} tone="soft" style={{ marginTop: 70 }}>
          {greeting()}
          {profile.name ? `, ${profile.name}.` : "."} <T size={16} tone="muted">All caught up.</T>
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
});
