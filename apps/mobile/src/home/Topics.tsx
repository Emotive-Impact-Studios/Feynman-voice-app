// Topics, from the canvas board: every topic you've explained.
import { Press } from "../ui/Press";
import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ago, photoFor, type Profile } from "../data/profile";
import { Glass, PillButton, T } from "../ui/kit";
import { homeStyles } from "./styles";
import { In, mins } from "./Today";

export function Topics({ profile, top, bottom, onNew, onTopic }: { profile: Profile; top: number; bottom: number; onNew: () => void; onTopic: (t: string) => void }) {
  const n = profile.topics.length;
  return (
    <ScrollView contentContainerStyle={[homeStyles.scroll, { paddingTop: top + 70, paddingBottom: bottom + 130, gap: 10 }]} showsVerticalScrollIndicator={false}>
      <In d={1}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 40, marginBottom: 10 }}>
          <T size={34} weight="medium" style={{ lineHeight: 36 }}>
            <T size={34} weight="medium" tone="muted">
              {n === 0 ? "No topics yet." : n === 1 ? "1 topic." : `${n} topics.`}
            </T>
            {"\n"}
            {n === 0 ? "Start one." : "Keep going."}
          </T>
          <PillButton label="+ New topic" onPress={onNew} style={{ height: 40, paddingHorizontal: 16 }} />
        </View>
      </In>
      {profile.topics.map((t, i) => (
        <In key={t.title} d={2 + Math.min(i, 6)}>
          <Press
            // A topic with ideas opens its stars; one without starts a call.
            onPress={() => (t.ideas?.length ? router.push({ pathname: "/map", params: { topic: t.title } }) : onTopic(t.title))}
            accessibilityRole="button"
            accessibilityLabel={t.ideas?.length ? `See ${t.title}` : `Explain ${t.title} again`}
          >
            <Glass style={[styles.row, photoFor(profile, t.title) ? styles.rowPhoto : null]}>
              {/* Teach me this thing: the photo the topic started from. */}
              {photoFor(profile, t.title) ? <Image source={{ uri: photoFor(profile, t.title) }} style={styles.photo} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <T size={17} weight="semibold" style={{ flex: 1 }} lines={1}>
                  {t.title}
                </T>
                <T size={12} weight="mono" tone="muted">
                  {mins(t.seconds)}
                </T>
              </View>
              <T size={13} tone="muted">
                {t.sessions === 1 ? "1 session" : `${t.sessions} sessions`} · {t.questions} questions asked · {ago(t.at)}
              </T>
              {t.ideas?.length ? <Dots total={Math.min(t.ideas.length, 7)} lit={t.ideas.slice(0, 7).filter((k) => t.known?.includes(k.id)).length} /> : null}
            </Glass>
          </Press>
        </In>
      ))}
    </ScrollView>
  );
}

/** The topic's ideas as a row of small stars, lit ones first. */
function Dots({ total, lit }: { total: number; lit: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }} accessibilityLabel={`${lit} of ${total} ideas explained`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i < lit && styles.dotLit]} />
      ))}
      <T size={12} tone="muted" style={{ marginLeft: 4 }}>
        {lit} of {total} ideas
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: "rgba(214,218,226,0.35)" },
  dotLit: { backgroundColor: "#E6E9EE", borderColor: "#E6E9EE" },
  row: { borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, gap: 8 },
  rowPhoto: { paddingLeft: 18 + 56 + 14, minHeight: 88 },
  photo: { position: "absolute", left: 16, top: 16, width: 56, height: 56, borderRadius: 16, backgroundColor: "#24272C" },
});
