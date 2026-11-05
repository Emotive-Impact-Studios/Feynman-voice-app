// Live session. One voice loop, three ways to see it:
//   light     (S1): the student is the living light in the middle
//   subtitles (S2): the question fills the screen, your voice glows along the bottom
//   chat      (S3): the conversation as bubbles
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { minutesLeft, recordSession, useProfile } from "../data/profile";
import { colour } from "../theme";
import { DotWave } from "../ui/Dots";
import { Backdrop, Glass, Icon, images, Label, PillButton, RoundButton, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { SilverRing } from "../ui/SilverRing";
import { VoiceGlow } from "../ui/VoiceGlow";
import type { LiveEars, LiveVoice } from "../api";
import { phononAvailable, useLiveCall, type CallTurnStats } from "../live/useLiveCall";

type View3 = "light" | "subtitles" | "chat";
const VIEWS: { id: View3; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "subtitles", label: "Subtitles" },
  { id: "chat", label: "Chat" },
];

const OPENING = "Explain it as if I know nothing. I'll ask when I get lost.";

const STATUS = {
  loading: "Getting ready",
  ready: "Tap the ring to start the call",
  listening: "Listening",
  thinking: "Thinking of a question. Keep talking to carry on.",
  speaking: "Your student is asking. Talk or tap to cut in.",
  error: "Something went wrong",
} as const;

// Test switches: which voice speaks and which service hears.
const VOICES: { id: LiveVoice; label: string }[] = [
  ...(phononAvailable ? [{ id: "phonon" as const, label: "Phonon" }] : []),
  { id: "sonic", label: "Sonic" },
  { id: "kitten", label: "Kitten" },
];
const EARS: { id: LiveEars; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "cartesia", label: "Cartesia" },
  { id: "openai", label: "OpenAI" },
];
const VOICE_NAME: Record<LiveVoice, string> = { phonon: "Phonon", sonic: "Sonic", kitten: "Kitten" };

function statLine(s: CallTurnStats) {
  const first = s.firstWordMs ? `first word ${(s.firstWordMs / 1000).toFixed(1)}s` : "no sound";
  const ears = s.ears === "cartesia" ? "Cartesia" : "OpenAI";
  return `${VOICE_NAME[s.voice]} voice, ${ears} ears. ${first}, ${s.pence.toFixed(2)}p`;
}

function Segmented<V extends string>({ items, value, onChange }: { items: { id: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={styles.segment}>
      {items.map((it) => (
        <Pressable
          key={it.id}
          accessibilityRole="button"
          accessibilityState={{ selected: it.id === value }}
          onPress={() => onChange(it.id)}
          style={[styles.switchItem, it.id === value && { backgroundColor: "rgba(255,255,255,0.14)" }]}
        >
          <T size={13} tone={it.id === value ? "text" : "muted"}>
            {it.label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

function clock(seconds: number) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function Session() {
  // A review card opens the session on its own topic and question.
  const params = useLocalSearchParams<{ topic?: string; prompt?: string }>();
  const topic = params.topic?.trim() || "Anything you like";
  const profile = useProfile();
  const opening = params.prompt ?? OPENING;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<View3>("light");
  const [voice, setVoice] = useState<LiveVoice>("sonic");
  const [ears, setEars] = useState<LiveEars>("auto");
  const [showSettings, setShowSettings] = useState(false);
  const loop = useLiveCall(topic, { voice, ears });
  const lastStat = loop.stats.at(-1);

  const spokenBefore = useMemo(() => loop.stats.reduce((t, s) => t + s.speakingSeconds, 0), [loop.stats]);
  const spoken = spokenBefore + (loop.phase === "listening" ? loop.liveSpeaking : 0);
  const asked = [...loop.turns].reverse().find((t) => t.speaker === "student")?.text ?? opening;
  const question = loop.liveQuestion ?? asked;
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

  // The ring starts the call, sends the turn early, or cuts the student off.
  const canTap = loop.phase !== "loading";
  const onRing =
    loop.phase === "listening" ? loop.finish : loop.phase === "thinking" || loop.phase === "speaking" ? loop.interrupt : loop.start;
  const ringIcon = loop.phase === "listening" ? "check" : loop.phase === "thinking" || loop.phase === "speaking" ? "pause" : "mic";
  const ringLabel =
    loop.phase === "listening" ? "Done, ask me" : loop.phase === "thinking" || loop.phase === "speaking" ? "Cut in" : "Start the call";
  // Stop the microphone, any pending turn and any reply before leaving.
  // Save the topic and the speaking time, then back to Today. (Session
  // feedback returns with gap analysis, build step 4.)
  const end = () => {
    loop.cancel();
    recordSession(topic, spoken, loop.turns.filter((t) => t.speaker === "student").length);
    router.back();
  };
  const close = end;

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
            {(loop.turns.length ? loop.turns : [{ speaker: "student" as const, text: opening }]).map((t, i) =>
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
              {clock(spoken)} · {Math.max(0, minutesLeft(profile) - Math.floor(spoken / 60))} min left
            </Label>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <RoundButton label="Voice settings" size={44} onPress={() => setShowSettings((v) => !v)}>
              <Icon name="wave" size={15} />
            </RoundButton>
            <RoundButton label="Close session" size={44} onPress={close}>
              <Icon name="close" size={15} />
            </RoundButton>
          </View>
        </View>
        {showSettings && (
          <Glass strong style={styles.settings}>
            <Label>Voice</Label>
            <Segmented items={VOICES} value={voice} onChange={setVoice} />
            <Label>Ears</Label>
            <Segmented items={EARS} value={ears} onChange={setEars} />
            <T size={12.5} tone="muted">
              {lastStat ? `Last turn: ${statLine(lastStat)}` : "Changes apply from your next turn."}
            </T>
          </Glass>
        )}
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
          accessibilityLabel={ringLabel}
          disabled={!canTap}
          onPress={onRing}
          style={{ opacity: canTap ? 1 : 0.4 }}
        >
          <SilverRing width={58} height={58}>
            <Icon name={ringIcon} />
          </SilverRing>
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          {loop.phase === "listening" ? (
            <DotWave width={width - 210} height={34} level={loop.isTalking ? 1 : 0.3} tick={tick} />
          ) : (
            <T size={14} tone="muted" lines={2}>
              {loop.notice ?? loop.error ?? STATUS[loop.phase]}
            </T>
          )}
          {lastStat && !showSettings ? (
            <T size={11.5} tone="dim" lines={1}>
              {statLine(lastStat)}
            </T>
          ) : null}
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
  segment: { flexDirection: "row", gap: 2, padding: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", alignSelf: "flex-start" },
  settings: { padding: 14, borderRadius: 24, gap: 8 },
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
