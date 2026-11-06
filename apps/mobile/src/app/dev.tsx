// Developer screen: the plain voice loop with its timing and cost numbers.
// Opened from /dev. The real session UI lives in session.tsx.
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from "react-native";
import { useVoiceLoop } from "../useVoiceLoop";

const LABELS = {
  loading: "Getting ready...",
  ready: "Tap and start explaining",
  listening: "Listening. Tap when you pause.",
  thinking: "Thinking of a question...",
  speaking: "Your student is asking...",
  error: "Something went wrong",
} as const;

export default function Dev() {
  const dark = useColorScheme() === "dark";
  const c = dark ? { bg: "#111", fg: "#eee", muted: "#999", card: "#1d1d1d" } : { bg: "#fff", fg: "#111", muted: "#666", card: "#f3f3f3" };
  const [topic, setTopic] = useState("How the heart and circulation work");
  const loop = useVoiceLoop(topic);

  const totals = loop.stats.reduce(
    (t, s) => ({ secs: t.secs + s.speakingSeconds, pence: t.pence + s.pence }),
    { secs: 0, pence: 0 },
  );
  const last = loop.stats.at(-1);
  const lastQuestion = [...loop.turns].reverse().find((t) => t.speaker === "student");
  const canTap = loop.phase === "ready" || loop.phase === "listening";

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.label, { color: c.muted }]}>Topic</Text>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          editable={loop.turns.length === 0}
          style={[styles.input, { color: c.fg, backgroundColor: c.card }]}
        />

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text style={[styles.question, { color: c.fg }]}>
            {lastQuestion?.text ?? "Explain the topic as if I know nothing. I'll ask when I get lost."}
          </Text>
        </View>

        <Pressable
          disabled={!canTap}
          onPress={loop.phase === "listening" ? loop.finish : () => loop.start()}
          style={[styles.button, { backgroundColor: loop.phase === "listening" ? "#c0392b" : c.fg, opacity: canTap ? 1 : 0.4 }]}
        >
          <Text style={[styles.buttonText, { color: loop.phase === "listening" ? "#fff" : c.bg }]}>
            {loop.phase === "listening" ? "Done, ask me" : "Talk"}
          </Text>
        </Pressable>
        <Text style={[styles.status, { color: c.muted }]}>
          {LABELS[loop.phase]}
          {loop.phase === "listening" ? `  ${loop.liveSpeaking.toFixed(1)}s spoken${loop.isTalking ? "  ●" : ""}` : ""}
        </Text>
        {loop.error && <Text style={styles.error}>{loop.error}</Text>}

        <Text style={[styles.label, { color: c.muted }]}>Numbers</Text>
        <Text style={[styles.mono, { color: c.fg }]}>
          {last
            ? `Last turn: ${last.speakingSeconds.toFixed(1)}s spoken of ${last.recordedSeconds.toFixed(1)}s\n` +
              `Wait: ${last.waitMs}ms (server ${last.brainMs}ms, voice ${last.ttsMs}ms)\n` +
              `Cost: ${last.pence.toFixed(3)}p\n`
            : "No turns yet\n"}
          {totals.secs > 0
            ? `Session: ${(totals.secs / 60).toFixed(2)} min spoken, ${totals.pence.toFixed(3)}p, ` +
              `${(totals.pence / (totals.secs / 60)).toFixed(3)}p per minute`
            : ""}
        </Text>

        <Text style={[styles.label, { color: c.muted }]}>Transcript</Text>
        {loop.turns.map((t, i) => (
          <Text key={i} style={{ color: t.speaker === "student" ? c.muted : c.fg, marginBottom: 8 }}>
            {t.speaker === "student" ? "Student: " : "You: "}
            {t.text}
          </Text>
        ))}
        {loop.turns.length > 0 && (
          <Pressable onPress={loop.reset}>
            <Text style={[styles.status, { color: c.muted, textDecorationLine: "underline" }]}>Start a new session</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 20, gap: 12 },
  label: { fontSize: 13, marginTop: 8 },
  input: { borderRadius: 8, padding: 12, fontSize: 16 },
  card: { borderRadius: 12, padding: 20, minHeight: 110, justifyContent: "center" },
  question: { fontSize: 22, lineHeight: 30 },
  button: { borderRadius: 999, paddingVertical: 18, alignItems: "center" },
  buttonText: { fontSize: 18, fontWeight: "600" },
  status: { textAlign: "center", fontSize: 14 },
  error: { color: "#c0392b", textAlign: "center" },
  mono: { fontFamily: "Courier", fontSize: 13, lineHeight: 20 },
});
