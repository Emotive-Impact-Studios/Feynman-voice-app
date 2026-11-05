// A stack of tall cards with artwork, used for reviews (H2) and gaps (feedback).
import type { ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { colour, radius } from "../theme";
import { Glass, T } from "./kit";

interface Props {
  art: number;
  tags: string[];
  title: string;
  note?: string;
  height?: number;
  actions: ReactNode;
  /** How many cards sit behind this one (0 to 2). */
  behind?: number;
}

/** Space the stack needs below the card for the cards peeking out behind it. */
const BEHIND = 26;

/**
 * Card height that fits the screen: the window minus what sits above the card
 * and below the stack, kept between min and max so short phones still show
 * the action buttons.
 */
export function useCardHeight({ above, below, max, min = 300 }: { above: number; below: number; max: number; min?: number }) {
  const { height } = useWindowDimensions();
  return Math.round(Math.max(min, Math.min(max, height - above - below - BEHIND)));
}

export function CardStack({ art, tags, title, note, height = 470, actions, behind = 2 }: Props) {
  return (
    <View style={{ height, marginBottom: BEHIND }}>
      {behind > 1 && <View style={[styles.back, { left: 30, right: 30, top: 26, bottom: -26, backgroundColor: "#15161A" }]} />}
      {behind > 0 && <View style={[styles.back, { left: 15, right: 15, top: 13, bottom: -13, backgroundColor: "#1B1D21" }]} />}
      <View style={styles.card}>
        <Image source={art} contentFit="cover" style={[StyleSheet.absoluteFill, { opacity: 0.8 }]} />
        <LinearGradient colors={["rgba(10,11,13,0)", "rgba(10,11,13,0.82)"]} locations={[0.3, 0.75]} style={StyleSheet.absoluteFill} />
        <View style={styles.body}>
          <View style={styles.tags}>
            {tags.map((t) => (
              <Glass key={t} style={styles.tag} strong>
                <T size={13}>{t}</T>
              </Glass>
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <T size={25} weight="semibold">
            {title}
          </T>
          {note ? (
            <T size={14} tone="soft" style={{ marginTop: 10 }}>
              {note}
            </T>
          ) : null}
          <View style={styles.actions}>{actions}</View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: "absolute", borderRadius: radius.card, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  card: { flex: 1, borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: colour.hairline, backgroundColor: "#0B0F18" },
  body: { flex: 1, padding: 22 },
  tags: { flexDirection: "row", justifyContent: "space-between" },
  tag: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  actions: { flexDirection: "row", gap: 10, marginTop: 22, alignItems: "center" },
});
