// New topic, from the canvas board "Part: upload flow". A sheet over Today.
// Uploads arrive in build step 3, so the four sources are shown but marked
// "Soon"; for now you type (or dictate) the topic and your student asks
// about the basics.
import { Press } from "../ui/Press";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useProfile } from "../data/profile";
import { colour, font } from "../theme";
import { Glass, Icon, Label, PillButton, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { smooth, spring } from "../ui/motion";
import { Soft } from "../ui/Soft";

const SOURCES = [
  ["Slides or PDF", "PowerPoint, Keynote, PDF, Word"],
  ["Scan pages", "Textbook, handouts, notes"],
  ["From the cloud", "Google Drive, OneDrive"],
  ["Paste text", "Copied notes or a link"],
];

export default function NewTopic() {
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const recent = profile.topics.slice(0, 4);

  const dim = useSharedValue(0);
  const y = useSharedValue(600);
  useEffect(() => {
    dim.value = smooth(1);
    y.value = smooth(0);
  }, [dim, y]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const start = (t: string) => {
    const title = t.trim();
    if (!title) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.replace({ pathname: "/session", params: goal.trim() ? { topic: title, goal: goal.trim() } : { topic: title } });
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,5,6,0.6)" }, dimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { marginBottom: Math.max(insets.bottom, 8) }, sheetStyle]}>
          <View style={styles.grabber} />
          <Rise d={1}>
            <View style={{ marginTop: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <T size={30} weight="medium" style={{ lineHeight: 32 }}>
                <T size={30} weight="medium" tone="dim">
                  Give me your notes.
                </T>
                {"\n"}I'll learn from you.
              </T>
              <View style={{ width: 44, height: 44 }}>
                <LivingLight size={44} mood="listen" />
              </View>
            </View>
          </Rise>

          <Rise d={2}>
            <View style={styles.grid}>
              {SOURCES.map(([title, sub]) => (
                <Glass key={title} style={styles.source}>
                  <View style={styles.soon}>
                    <Label tone="muted" style={{ fontSize: 10 }}>
                      Soon
                    </Label>
                  </View>
                  <T size={15} weight="semibold" tone="soft">
                    {title}
                  </T>
                  <T size={12} tone="dim">
                    {sub}
                  </T>
                </Glass>
              ))}
            </View>
          </Rise>

          <Rise d={3}>
            <T size={15} style={{ marginTop: 18 }}>
              No notes? Just say the topic
            </T>
            <T size={12.5} tone="soft" style={{ marginTop: 2 }}>
              Your student will ask about the basics.
            </T>
            <View style={styles.inputRow}>
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder="Enzyme kinetics, the French Revolution…"
                placeholderTextColor={colour.textDim}
                returnKeyType="go"
                onSubmitEditing={() => start(topic)}
                style={styles.input}
                accessibilityLabel="Topic"
              />
              <Press onPress={() => start(topic)} disabled={!topic.trim()} accessibilityRole="button" accessibilityLabel="Start explaining" style={{ opacity: topic.trim() ? 1 : 0.4 }}>
                <Soft style={{ width: 50, height: 50 }}>
                  <Icon name="mic" />
                </Soft>
              </Press>
            </View>
            {topic.trim().length > 0 && (
              <Animated.View entering={FadeIn}>
                <TextInput
                  value={goal}
                  onChangeText={setGoal}
                  placeholder="By the exam I want to explain… (optional)"
                  placeholderTextColor={colour.textDim}
                  returnKeyType="go"
                  onSubmitEditing={() => start(topic)}
                  style={[styles.input, { marginTop: 8, flex: 0 }]}
                  accessibilityLabel="What you want to be able to explain"
                />
              </Animated.View>
            )}
          </Rise>

          {recent.length > 0 && (
            <Rise d={4}>
              <Label style={{ marginTop: 18 }}>Recent</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {recent.map((t) => (
                  <Press key={t.title} onPress={() => start(t.title)} accessibilityRole="button">
                    <Glass style={{ height: 40, borderRadius: 999, paddingHorizontal: 15, justifyContent: "center" }}>
                      <T size={14} tone="soft">
                        {t.title}
                      </T>
                    </Glass>
                  </Press>
                ))}
              </View>
            </Rise>
          )}

          <Animated.View entering={FadeIn.delay(450)}>
            <T size={12.5} tone="muted" style={{ marginTop: 16, textAlign: "center" }}>
              Reading is free; only speaking uses minutes.
            </T>
            <PillButton label="Not now" onPress={() => router.back()} style={{ marginTop: 4, backgroundColor: "transparent", borderWidth: 0 }} />
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Rise({ d, children }: { d: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(120 + d * 80).springify().duration(spring.smooth.duration).dampingRatio(spring.smooth.dampingRatio)}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: 8,
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderRadius: 40,
    backgroundColor: "rgba(18,19,22,0.96)",
    borderWidth: 1,
    borderColor: colour.hairline,
  },
  grabber: { alignSelf: "center", width: 38, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)" },
  grid: { marginTop: 20, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  source: { width: "48.5%", borderRadius: 22, padding: 14, gap: 2, opacity: 0.55 },
  soon: { position: "absolute", right: 10, top: 10 },
  inputRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    flex: 1,
    height: 54,
    borderRadius: 999,
    paddingHorizontal: 20,
    fontSize: 16,
    color: colour.text,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: colour.hairline,
    fontFamily: font.regular,
  },
});
