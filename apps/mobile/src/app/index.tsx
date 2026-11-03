// Home. One screen with three states:
//   explain (H1): nothing due, one way in
//   today   (H2): reviews are due, the card stack takes over
//   me      (H3): minutes and last topic, also shown when minutes run low
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { lastTopic, me, reviewQueue } from "../data/mock";
import { colour } from "../theme";
import { CardStack } from "../ui/CardStack";
import { MinutesRing } from "../ui/Dots";
import { Backdrop, Glass, Icon, images, Label, PillButton, RoundButton, Stat, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { SilverRing } from "../ui/SilverRing";

type HomeState = "explain" | "today" | "me";
const LOW_MINUTES = 20;

const pad = (n: number) => String(n).padStart(2, "0");

export default function Home() {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState(reviewQueue);
  const [mastered, setMastered] = useState(me.mastered);
  const initial: HomeState = me.minutesLeft < LOW_MINUTES ? "me" : queue.length > 0 ? "today" : "explain";
  const [state, setState] = useState<HomeState>(initial);
  const startSession = () => router.push("/session");

  const answer = (knewIt: boolean) => {
    if (knewIt) setMastered((m) => m + 1);
    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length === 0) setState("explain");
  };

  return (
    <View style={styles.root}>
      {state === "explain" && <Explain top={insets.top} onStart={startSession} onReviews={() => setState("today")} onMe={() => setState("me")} due={queue.length} />}
      {state === "today" && <Today top={insets.top} queue={queue} mastered={mastered} onAnswer={answer} onExplain={startSession} />}
      {state === "me" && <Me top={insets.top} onNew={() => setState("explain")} onCarryOn={startSession} />}
      {state !== "explain" && <Nav bottom={insets.bottom} state={state} onChange={setState} onStart={startSession} />}
    </View>
  );
}

function Explain({ top, onStart, onReviews, onMe, due }: { top: number; onStart: () => void; onReviews: () => void; onMe: () => void; due: number }) {
  return (
    <>
      <Backdrop source={images.horizon} opacity={0.85} />
      <View style={[styles.page, { paddingTop: top + 16, paddingBottom: 36 }]}>
        <View style={styles.rowBetween}>
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
        <View style={[styles.rowBetween, { marginTop: 10 }]}>
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

function Today({ top, queue, mastered, onAnswer, onExplain }: { top: number; queue: typeof reviewQueue; mastered: number; onAnswer: (knewIt: boolean) => void; onExplain: () => void }) {
  const card = queue[0];
  return (
    <>
      <Backdrop source={images.horizon} opacity={0.45} />
      <View style={[styles.page, { paddingTop: top + 20 }]}>
        <View style={styles.stats}>
          <Stat value={String(me.minutesLeft)} label="Minutes" />
          <Stat value={pad(queue.length)} label="Due" />
          <Stat value={pad(mastered)} label="Mastered" />
        </View>
        {card && (
          <View style={{ marginTop: 34 }}>
            <CardStack
              key={card.id}
              art={images.cardReview}
              tags={[`Due today · ${card.topic}`]}
              title={card.prompt}
              note={card.note}
              behind={Math.min(2, queue.length - 1)}
              actions={
                <>
                  <PillButton accessibilityLabel="Explain again later" onPress={() => onAnswer(false)} style={{ flex: 1 }}>
                    <Icon name="close" />
                  </PillButton>
                  <Pressable accessibilityRole="button" accessibilityLabel="Explain it now" onPress={onExplain}>
                    <SilverRing width={56} height={56}>
                      <Icon name="mic" />
                    </SilverRing>
                  </Pressable>
                  <PillButton accessibilityLabel="I know this" onPress={() => onAnswer(true)} style={{ flex: 1 }}>
                    <Icon name="check" />
                  </PillButton>
                </>
              }
            />
          </View>
        )}
      </View>
    </>
  );
}

function Me({ top, onNew, onCarryOn }: { top: number; onNew: () => void; onCarryOn: () => void }) {
  return (
    <>
      <Backdrop source={images.horizon} opacity={0.5} flip offsetY={-380} />
      <View style={[styles.page, { paddingTop: top + 16, alignItems: "center" }]}>
        <Label>Minutes left</Label>
        <View style={{ marginTop: 22 }}>
          <MinutesRing left={me.minutesLeft} total={me.minutesTotal} size={300} />
        </View>
        <T size={13} tone="muted" style={{ marginTop: -96 }}>
          of {me.minutesTotal} · renews {me.renews}
        </T>
      </View>
      <View style={styles.panelWrap}>
        <Glass strong style={styles.panel}>
          <Backdrop source={images.titanium} opacity={0.35} />
          <View style={{ padding: 24, flex: 1 }}>
            <View style={styles.rowBetween}>
              <Label tone="soft">Last topic</Label>
              <Label tone="soft">
                {lastTopic.clear} / {lastTopic.total} clear
              </Label>
            </View>
            <T size={26} weight="medium" style={{ marginTop: 12 }}>
              {lastTopic.title}
            </T>
            <Progress clear={lastTopic.clear} gaps={lastTopic.gaps} total={lastTopic.total} />
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <PillButton label="New topic" onPress={onNew} style={{ flex: 1 }} />
              <PillButton label="Carry on" variant="solid" onPress={onCarryOn} style={{ flex: 1.4 }} />
            </View>
          </View>
        </Glass>
      </View>
    </>
  );
}

function Progress({ clear, gaps, total }: { clear: number; gaps: number; total: number }) {
  return (
    <View
      style={{ flexDirection: "row", gap: 4, marginTop: 16 }}
      accessible
      accessibilityLabel={`${clear} of ${total} clear, ${gaps} gaps`}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < clear ? colour.clear : i < clear + gaps ? colour.gap : "rgba(255,255,255,0.15)" }}
        />
      ))}
    </View>
  );
}

function Nav({ bottom, state, onChange, onStart }: { bottom: number; state: HomeState; onChange: (s: HomeState) => void; onStart: () => void }) {
  const tabs: { id: HomeState; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "explain", label: "Explain" },
    { id: "me", label: "Me" },
  ];
  return (
    <View style={[styles.nav, { bottom: Math.max(bottom, 16) + 6 }]} accessibilityRole="tablist">
      <Glass strong style={styles.navBar}>
        {tabs.map((t) =>
          t.id === state ? (
            <View key={t.id} style={{ flex: 1 }} accessibilityRole="tab" accessibilityState={{ selected: true }}>
              <SilverRing width={100} height={52} fill="#1A1B1F" style={{ alignSelf: "center" }}>
                <T size={12.5}>{t.label}</T>
              </SilverRing>
            </View>
          ) : (
            <Pressable key={t.id} accessibilityRole="tab" onPress={() => onChange(t.id)} style={styles.navItem}>
              <T size={12.5} tone="muted">
                {t.label}
              </T>
            </Pressable>
          ),
        )}
      </Glass>
      <Pressable accessibilityRole="button" accessibilityLabel="Start explaining" onPress={onStart}>
        <Glass strong style={styles.navLight}>
          <LivingLight size={40} />
        </Glass>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colour.ground },
  page: { flex: 1, paddingHorizontal: 22 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  startPill: { height: 64, borderRadius: 999, flexDirection: "row", alignItems: "center", paddingLeft: 22, paddingRight: 6 },
  link: { paddingVertical: 10 },
  stats: { flexDirection: "row", justifyContent: "center", gap: 40 },
  panelWrap: { position: "absolute", left: 10, right: 10, bottom: 100, height: 250 },
  panel: { flex: 1, borderRadius: 38 },
  nav: { position: "absolute", left: 16, right: 16, flexDirection: "row", gap: 10 },
  navBar: { flex: 1, height: 64, borderRadius: 999, flexDirection: "row", alignItems: "center", padding: 6 },
  navItem: { flex: 1, height: 52, alignItems: "center", justifyContent: "center" },
  navLight: { width: 64, height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
