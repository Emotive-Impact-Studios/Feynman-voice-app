// The in-call Show me card. When the learner takes Fenny's offer of a quick
// explanation, it appears over the call: a short explanation (from their notes
// when there are any), then "Now tell Fenny in your own words", which closes it
// so they can explain it back. Fenny itself never explains.
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { showMe, type Turn } from "../api";
import { TELL_ME_BUTTON } from "../data/lastCall";
import { colour } from "../theme";
import { Glass, Label, PillButton, T } from "../ui/kit";
import { spring } from "../ui/motion";

export function ShowMeCard({ topic, gap, notes, turns, bottom, onDone }: { topic: string; gap: { title: string }; notes?: string; turns: Turn[]; bottom: number; onDone: () => void }) {
  const [shown, setShown] = useState<{ explanation: string; fromNotes: boolean } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const ctl = new AbortController();
    showMe({ topic, gap, notes, turns }, ctl.signal)
      .then(setShown)
      .catch((e) => !ctl.signal.aborted && setErr(e instanceof Error ? e.message : String(e)));
    return () => ctl.abort();
    // Fetched once per gap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gap.title]);

  return (
    <Animated.View
      entering={FadeInDown.springify().duration(spring.smooth.duration).dampingRatio(spring.smooth.dampingRatio)}
      exiting={FadeOutDown}
      style={[styles.wrap, { bottom }]}
    >
      <Glass strong style={styles.card}>
        <Label tone={shown?.fromNotes ? "student" : "muted"}>{shown?.fromNotes ? "From your notes" : "A quick explanation"}</Label>
        <T size={17} weight="semibold" style={{ marginTop: 8 }}>
          {gap.title}
        </T>
        {shown ? (
          <>
            <T size={15.5} tone="soft" style={{ marginTop: 10 }}>
              {shown.explanation}
            </T>
            {!shown.fromNotes && (
              <T size={12.5} tone="muted" style={{ marginTop: 8 }}>
                {notes ? "Your notes don't cover this, so check it against your course." : "Check this against your course."}
              </T>
            )}
          </>
        ) : err ? (
          <T size={14} tone="gap" style={{ marginTop: 10 }}>
            {err}
          </T>
        ) : (
          <View style={{ height: 60, justifyContent: "center" }}>
            <ActivityIndicator color={colour.soft} />
          </View>
        )}
        <PillButton label={TELL_ME_BUTTON} variant="solid" onPress={onDone} style={{ marginTop: 16, height: 50 }} />
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 10, right: 10 },
  card: { borderRadius: 32, padding: 18 },
});
