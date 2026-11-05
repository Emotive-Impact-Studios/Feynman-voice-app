// H1: nothing due, one way in.
import { Pressable, StyleSheet, View } from "react-native";
import { lastTopic, me } from "../data/mock";
import { Backdrop, Glass, Icon, images, Label, RoundButton, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { SilverRing } from "../ui/SilverRing";
import { homeStyles } from "./styles";

export function Explain({ top, onStart, onReviews, onMe, due }: { top: number; onStart: () => void; onReviews: () => void; onMe: () => void; due: number }) {
  return (
    <>
      <Backdrop source={images.horizon} opacity={0.85} />
      <View style={[homeStyles.page, { paddingTop: top + 16, paddingBottom: 36 }]}>
        <View style={homeStyles.rowBetween}>
          <Label tone="soft">{me.minutesLeft} min</Label>
          <RoundButton label="Your minutes and plan" onPress={onMe}>
            <Icon name="person" size={18} />
          </RoundButton>
        </View>
        <View style={{ marginTop: 72 }}>
          <LivingLight size={120} />
        </View>
        <T size={38} weight="medium" style={{ marginTop: 24 }}>
          <T size={38} weight="medium" tone="dim">
            {due > 0 ? `Evening, ${me.name}.` : `All caught up, ${me.name}.`}
          </T>
          {"\n"}Teach me something.
        </T>
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" onPress={onStart}>
          <Glass style={styles.startPill}>
            <T size={16} tone="soft" style={{ flex: 1 }}>
              Start explaining
            </T>
            <SilverRing width={52} height={52}>
              <Icon name="mic" />
            </SilverRing>
          </Glass>
        </Pressable>
        <View style={[homeStyles.rowBetween, { marginTop: 10 }]}>
          <Pressable accessibilityRole="button" onPress={onStart} style={styles.link}>
            <T size={14} tone="muted">
              Carry on: <T size={14}>{lastTopic.title}</T>
            </T>
          </Pressable>
          {due > 0 && (
            <Pressable accessibilityRole="button" onPress={onReviews} style={styles.link}>
              <T size={14} tone="muted">
                {due} due ↑
              </T>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  startPill: { height: 64, borderRadius: 999, flexDirection: "row", alignItems: "center", paddingLeft: 22, paddingRight: 6 },
  link: { paddingVertical: 10 },
});
