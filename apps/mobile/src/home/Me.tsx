// Me, from the canvas board: what you've done first, minutes after.
// Ideas mastered and gaps closed need gap analysis (build step 4), so this
// shows only what the phone really knows. The streak is soft on purpose: it
// forgives a missed day a week (see docs/behavioural-design.md).
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { minutesLeft, PROTOTYPE_MINUTES, softStreak, type Profile } from "../data/profile";
import { MinutesRing } from "../ui/Dots";
import { Glass, Label, T } from "../ui/kit";
import { homeStyles } from "./styles";
import { In, mins } from "./Today";

export function Me({ profile, top, bottom, onReplayIntro }: { profile: Profile; top: number; bottom: number; onReplayIntro: () => void }) {
  const left = minutesLeft(profile);
  const sessions = profile.topics.reduce((n, t) => n + t.sessions, 0);
  const questions = profile.topics.reduce((n, t) => n + t.questions, 0);
  const streak = softStreak(profile.days);
  return (
    <ScrollView contentContainerStyle={[homeStyles.scroll, { paddingTop: top + 70, paddingBottom: bottom + 130 }]} showsVerticalScrollIndicator={false}>
      <In d={1}>
        <Label style={{ marginTop: 40 }}>What you've done</Label>
        <T size={40} weight="medium" style={{ marginTop: 10, lineHeight: 42 }}>
          <T size={40} weight="mono">
            {profile.topics.length}
          </T>{" "}
          {profile.topics.length === 1 ? "topic" : "topics"}
          {"\n"}explained.
        </T>
      </In>
      <In d={2}>
        <View style={styles.stats}>
          <Stat value={String(sessions)} label="sessions" />
          <Stat value={String(questions)} label="questions answered" />
          <Stat value={mins(profile.secondsUsed)} label="explaining" />
        </View>
        {streak > 1 && (
          <T size={13} tone="soft" style={{ marginTop: 10 }}>
            {streak} days explaining in a row. Missing one day a week is fine.
          </T>
        )}
      </In>

      <In d={3}>
        <Label style={{ marginTop: 28 }}>Minutes</Label>
        <Glass style={styles.plan}>
          <MinutesRing left={left} total={PROTOTYPE_MINUTES} size={140} />
          <View style={{ flex: 1, gap: 4 }}>
            <T size={20} weight="semibold">
              <T size={20} weight="mono">
                {left}
              </T>{" "}
              min left
            </T>
            <T size={13} tone="soft">
              Of {PROTOTYPE_MINUTES} in this prototype. Plans come later.
            </T>
            <T size={12} tone="muted" style={{ marginTop: 4 }}>
              Only your speaking time counts. The student's questions are free.
            </T>
          </View>
        </Glass>
      </In>

      <In d={4}>
        <Label style={{ marginTop: 28 }}>{profile.name || "You"}</Label>
        <Glass style={{ marginTop: 10, borderRadius: 24 }}>
          <Pressable onPress={onReplayIntro} style={styles.rowBtn} accessibilityRole="button">
            <T size={15}>Play the intro again</T>
          </Pressable>
        </Glass>
      </In>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Glass style={{ flex: 1, borderRadius: 20, padding: 14, gap: 2 }}>
      <T size={22} weight="mono" style={{ lineHeight: 26 }}>
        {value}
      </T>
      <T size={12} tone="soft">
        {label}
      </T>
    </Glass>
  );
}

const styles = StyleSheet.create({
  stats: { marginTop: 18, flexDirection: "row", gap: 8 },
  plan: { marginTop: 10, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, paddingRight: 16 },
  rowBtn: { paddingVertical: 16, paddingHorizontal: 18 },
});
