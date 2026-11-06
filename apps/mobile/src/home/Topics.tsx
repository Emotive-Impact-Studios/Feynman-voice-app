// Topics, from the canvas board: every topic you've explained.
import { Press } from "../ui/Press";
import { ScrollView, StyleSheet, View } from "react-native";
import { ago, type Profile } from "../data/profile";
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
          <Press onPress={() => onTopic(t.title)} accessibilityRole="button" accessibilityLabel={`Explain ${t.title} again`}>
            <Glass style={styles.row}>
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
            </Glass>
          </Press>
        </In>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ row: { borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18, gap: 8 } });
