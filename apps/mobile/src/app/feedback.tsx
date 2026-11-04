// Session feedback (F1): gaps come back one at a time, each with the line
// from your notes. Fix it now, or send it to review.
// Uses stand-in findings until the gap analysis (build step 4) exists.
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sessionFindings } from "../data/mock";
import { colour } from "../theme";
import { CardStack, useCardHeight } from "../ui/CardStack";
import { Backdrop, images, PillButton, Stat, T } from "../ui/kit";

const pad = (n: number) => String(n).padStart(2, "0");
// Stats row (about 52) plus the gap above the card.
const ABOVE_CARD = 20 + 52 + 34;

export default function Feedback() {
  const insets = useSafeAreaInsets();
  const toFix = sessionFindings.filter((f) => f.status !== "clear");
  const clear = sessionFindings.filter((f) => f.status === "clear").length;
  const gaps = toFix.filter((f) => f.status === "gap").length;
  const skipped = toFix.length - gaps;
  const [i, setI] = useState(0);
  const f = toFix[i];
  const bottom = Math.max(insets.bottom, 16);
  const height = useCardHeight({ above: insets.top + ABOVE_CARD, below: bottom, max: 500 });

  // Go back to the Home already under this screen rather than mounting a new one.
  const next = () => (i + 1 < toFix.length ? setI(i + 1) : router.dismissTo("/"));

  return (
    <View style={styles.root}>
      <Backdrop source={images.horizon} opacity={0.45} />
      {/* Scrolls only if a very short screen still cannot fit the card. */}
      <ScrollView alwaysBounceVertical={false} contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: bottom }}>
        <View style={styles.stats}>
          <Stat value={pad(clear)} label="Clear" />
          <Stat value={pad(gaps)} label="Gaps" tone="gap" />
          <Stat value={pad(skipped)} label="Skipped" tone="student" />
        </View>
        {f ? (
          <View style={{ marginTop: 34 }}>
            <CardStack
              key={f.id}
              height={height}
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
          <View style={{ marginTop: 60, alignItems: "center", gap: 24 }}>
            <T size={22} weight="medium" style={{ textAlign: "center" }}>
              Everything came across clearly.
            </T>
            <PillButton label="Done" variant="solid" onPress={() => router.dismissTo("/")} style={{ paddingHorizontal: 32 }} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colour.ground },
  stats: { flexDirection: "row", justifyContent: "center", gap: 40 },
});
