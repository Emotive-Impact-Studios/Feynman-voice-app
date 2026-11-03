// Live session. One voice loop, three ways to see it:
//   light     (S1): the student is the living light in the middle
//   subtitles (S2): the question fills the screen, your voice glows along the bottom
//   chat      (S3): the conversation as bubbles
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { lastTopic, me } from "../data/mock";
import { colour } from "../theme";
import { DotWave } from "../ui/Dots";
import { Backdrop, Glass, Icon, images, Label, PillButton, RoundButton, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { SilverRing } from "../ui/SilverRing";
import { VoiceGlow } from "../ui/VoiceGlow";
import { useVoiceLoop } from "../useVoiceLoop";

type View3 = "light" | "subtitles" | "chat";
const VIEWS: { id: View3; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "subtitles", label: "Subtitles" },
  { id: "chat", label: "Chat" },
];

const OPENING = "Explain it as if I know nothing. I'll ask when I get lost.";

const STATUS = {
  loading: "Getting ready",
  ready: "Tap the ring and start explaining",
  listening: "Listening",
  thinking: "Thinking of a question",
  speaking: "Your student is asking",
  error: "Something went wrong",
} as const;

function clock(seconds: number) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function Session() {
  const params = useLocalSearchParams<{ topic?: string }>();
  const topic = params.topic ?? lastTopic.title;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<View3>("light");
  const loop = useVoiceLoop(topic);

  const spokenBefore = useMemo(() => loop.stats.reduce((t, s) => t + s.speakingSeconds, 0), [loop.stats]);
  const spoken = spokenBefore + (loop.phase === "listening" ? loop.liveSpeaking : 0);
  const question = [...loop.turns].reverse().find((t) => t.speaker === "student")?.text ?? OPENING;
  const lastYou = [...loop.turns].reverse().find((t) => t.speaker === "learner")?.text;

  const studentEnergy = loop.phase === "speaking" ? 1 : loop.phase === "thinking" ? 0.5 : 0;
  const voiceLevel = loop.phase === "listening" ? (loop.isTalking ? 1 : 0.25) : 0;

  // Gently animate the dot wave while you talk.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (loop.phase !== "listening") return;
    const id = setInterval(() => setTick((t) => t + 0.6), 120);
    return () => clearInterval(id);
  }, [loop.phase]);

  const canTap = loop.phase === "ready" || loop.phase === "listening";
  const onRing = loop.phase === "listening" ? loop.finish : loop.start;
  const end = () => router.replace("/feedback");

  return (
    <View style={styles.root}>
      {view === "light" && (
        <>
          <Backdrop source={images.horizon} opacity={0.3} />
          <VoiceGlow level={voiceLevel} height={230} dim />
          <View style={[styles.centre, { paddingTop: insets.top + 120 }]}>
            <LivingLight size={230} energy={studentEnergy} />
            <Label tone="student" style={{ marginTop: 28 }}>
              Student
            </Label>
            <T size={22} weight="medium" style={{ textAlign: "center", marginTop: 10, maxWidth: 330, lineHeight: 30 }}>
              {question}
            </T>
          </View>
        </>
      )}

      {view === "subtitles" && (
        <>
          <VoiceGlow level={voiceLevel} height={260} />
          <View style={{ paddingTop: insets.top + 130, paddingHorizontal: 26 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <LivingLight size={30} energy={studentEnergy} />
              <Label tone="student">Student</Label>
            </View>
            <T size={36} weight="medium" style={{ marginTop: 14, lineHeight: 40 }}>
              {question}
            </T>
            {lastYou ? (
              <T size={16} tone="dim" style={{ marginTop: 28 }} lines={3}>
                You: {lastYou}
              </T>
            ) : null}
          </View>
        </>
      )}

      {view === "chat" && (
        <>
          <Backdrop source={images.aurora} opacity={0.9} />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: insets.top + 130, paddingBottom: 140, paddingHorizontal: 20, gap: 14, flexGrow: 1, justifyContent: "flex-end" }}
          >
            {(loop.turns.length ? loop.turns : [{ speaker: "student" as const, text: OPENING }]).map((t, i) =>
              t.speaker === "student" ? (
                <View key={i} style={styles.studentRow}>
                  <LivingLight size={34} energy={i === loop.turns.length - 1 ? studentEnergy : 0} />
                  <View style={styles.studentBubble}>
                    <T size={16.5}>{t.text}</T>
                  </View>
                </View>
              ) : (
                <View key={i} style={styles.youBubble}>
                  <T size={16.5} tone="soft">
                    {t.text}
                  </T>
                </View>
              ),
            )}
          </ScrollView>
        </>
      )}

      {/* Shared top bar and view switch */}
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <View style={styles.rowBetween}>
          <View>
            <T size={15} weight="semibold">
              {topic}
            </T>
            <Label>
              {clock(spoken)} · {Math.max(0, Math.floor(me.minutesLeft - spoken / 60))} min left
            </Label>
          </View>
          <RoundButton label="Close session" size={44} onPress={() => router.back()}>
            <Icon name="close" size={15} />
          </RoundButton>
        </View>
        <Glass strong style={styles.switch}>
          {VIEWS.map((v) => (
            <Pressable
              key={v.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: v.id === view }}
              onPress={() => setView(v.id)}
              style={[styles.switchItem, v.id === view && { backgroundColor: "rgba(255,255,255,0.14)" }]}
            >
              <T size={13} tone={v.id === view ? "text" : "muted"}>
                {v.label}
              </T>
            </Pressable>
          ))}
        </Glass>
      </View>

      {/* Shared controls */}
      <Glass strong style={[styles.controls, { bottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={loop.phase === "listening" ? "Done, ask me" : "Start talking"}
          disabled={!canTap}
          onPress={onRing}
          style={{ opacity: canTap ? 1 : 0.4 }}
        >
          <SilverRing width={58} height={58}>
            <Icon name={loop.phase === "listening" ? "check" : "mic"} />
          </SilverRing>
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          {loop.phase === "listening" ? (
            <DotWave width={width - 210} height={34} level={loop.isTalking ? 1 : 0.3} tick={tick} />
          ) : (
            <T size={14} tone="muted" lines={2}>
              {loop.error ?? STATUS[loop.phase]}
            </T>
          )}
        </View>
        <PillButton label="End" variant="solid" onPress={end} style={{ height: 54 }} />
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colour.ground },
  centre: { alignItems: "center", paddingHorizontal: 24 },
  top: { position: "absolute", left: 20, right: 20, gap: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switch: { alignSelf: "center", flexDirection: "row", padding: 4, borderRadius: 999, gap: 2 },
  switchItem: { height: 32, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center" },
  controls: { position: "absolute", left: 10, right: 10, height: 96, borderRadius: 38, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14 },
  studentRow: { alignSelf: "flex-start", flexDirection: "row", alignItems: "flex-end", gap: 10, maxWidth: 320 },
  studentBubble: {
    flexShrink: 1,
    padding: 15,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    backgroundColor: "rgba(169,190,230,0.12)",
    borderWidth: 1,
    borderColor: "rgba(169,190,230,0.22)",
  },
  youBubble: {
    alignSelf: "flex-end",
    maxWidth: 300,
    padding: 15,
    borderRadius: 22,
    borderBottomRightRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colour.hairline,
  },
});
