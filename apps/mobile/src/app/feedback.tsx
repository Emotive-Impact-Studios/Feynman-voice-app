// Session feedback (F1): gaps come back one at a time, each with the line
// from your notes. Fix it now, or send it to review.
// Uses stand-in findings until the gap analysis (build step 4) exists.
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sessionFindings } from "../data/mock";
import { colour } from "../theme";
import { CardStack } from "../ui/CardStack";
import { Backdrop, images, PillButton, Stat, T } from "../ui/kit";

const pad = (n: number) => String(n).padStart(2, "0");

export default function Feedback() {
  const insets = useSafeAreaInsets();
  const toFix = sessionFindings.filter((f) => f.status !== "clear");
  const clear = sessionFindings.filter((f) => f.status === "clear").length;
  const gaps = toFix.filter((f) => f.status === "gap").length;
  const skipped = toFix.length - gaps;
  const [i, setI] = useState(0);
  const f = toFix[i];

  const next = () => (i + 1 < toFix.length ? setI(i + 1) : router.replace("/"));

  return (
    <View style={styles.root}>
      <Backdrop source={images.horizon} opacity={0.45} />
      <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20 }}>
        <View style={styles.stats}>
          <Stat value={pad(clear)} label="Clear" />
          <Stat value={pad(gaps)} label="Gaps" tone="gap" />
          <Stat value={pad(skipped)} label="Skipped" tone="student" />
        </View>
        {f ? (
          <View style={{ marginTop: 34 }}>
            <CardStack
              key={f.id}
              height={500}
              art={f.status === "gap" ? images.cardGap : images.cardReview}
              tags={[`${f.status === "gap" ? "Gap" : "Skipped"} ${i + 1} of ${toFix.length}`, f.sourceRef]}
              title={f.title}
              note={f.fromNotes ? `Your notes: “${f.fromNotes}”` : undefined}
              behind={Math.min(2, toFix.length - i - 1)}
              actions={
                <>
                  <PillButton label="Later" onPress={next} style={{ flex: 1 }} />
                  <PillButton label="Explain it now" variant="solid" onPress={() => router.replace("/session")} style={{ flex: 1.4 }} />
                </>
              }
            />
          </View>
        ) : (
          <T size={22} weight="medium" style={{ marginTop: 60, textAlign: "center" }}>
            Everything came across clearly.
          </T>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colour.ground },
  stats: { flexDirection: "row", justifyContent: "center", gap: 40 },
});
