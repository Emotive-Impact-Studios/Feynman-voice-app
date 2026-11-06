// Home's shared chrome, from the canvas board: a top bar (tab title,
// minutes, you) and the bottom bar (three tabs plus the light to start).
import { Press } from "../ui/Press";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { colour } from "../theme";
import { Glass, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { smooth } from "../ui/motion";
import { TabLight } from "../ui/TabLight";
import { NAV_HEIGHT, navOffset } from "./styles";

export type HomeTab = "today" | "topics" | "me";
const TABS: { id: HomeTab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "topics", label: "Topics" },
  { id: "me", label: "Me" },
];

export function TopBar({ top, tab, minutes, initial, onMe }: { top: number; tab: HomeTab; minutes: number; initial: string; onMe: () => void }) {
  return (
    <View style={[styles.top, { paddingTop: top + 6 }]}>
      <T size={17} weight="semibold">
        {TABS.find((t) => t.id === tab)?.label}
      </T>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Press onPress={onMe} accessibilityRole="button" accessibilityLabel={`${minutes} minutes left`}>
          <Glass style={styles.minutes}>
            <T size={13} weight="mono">
              {minutes} min
            </T>
          </Glass>
        </Press>
        <Press onPress={onMe} accessibilityRole="button" accessibilityLabel="You">
          <Glass style={styles.avatar}>
            <T size={14} weight="semibold">
              {initial}
            </T>
          </Glass>
        </Press>
      </View>
    </View>
  );
}

export function Nav({ bottom, tab, onChange, onStart, width }: { bottom: number; tab: HomeTab; onChange: (t: HomeTab) => void; onStart: () => void; width: number }) {
  // One lit pill springs between tabs instead of each tab having its own.
  const barW = width - 32 - 10 - NAV_HEIGHT - 12;
  const slot = barW / 3;
  const x = useSharedValue(TABS.findIndex((t) => t.id === tab) * slot);
  useEffect(() => {
    x.value = smooth(TABS.findIndex((t) => t.id === tab) * slot);
  }, [tab, slot, x]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <>
    {/* A fade behind the bar, so content scrolls out of sight before reaching it. */}
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(8,9,11,0)", "rgba(8,9,11,0.82)", colour.ground]}
      locations={[0, 0.52, 1]}
      style={styles.scrim}
    />
    <View style={[styles.nav, { bottom: navOffset(bottom) }]} accessibilityRole="tablist">
      <Glass strong blur={30} style={[styles.navBar, styles.solidBar]}>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 6, top: 6 }, ringStyle]}>
          <TabLight width={slot} height={52} />
        </Animated.View>
        {TABS.map((t) => (
          <Press
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: t.id === tab }}
            onPress={() => onChange(t.id)}
            style={styles.navItem}
          >
            <T size={12.5} tone={t.id === tab ? "text" : "muted"}>
              {t.label}
            </T>
          </Press>
        ))}
      </Glass>
      <Press accessibilityRole="button" accessibilityLabel="Start explaining something new" onPress={onStart}>
        <View style={[styles.navLight, styles.solidBar]}>
          <LivingLight size={40} peek />
        </View>
      </Press>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: 20, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 5 },
  minutes: { height: 36, borderRadius: 999, paddingHorizontal: 12, justifyContent: "center" },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colour.glass },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 170 },
  solidBar: { backgroundColor: "rgba(22,24,28,0.94)" },
  nav: { position: "absolute", left: 16, right: 16, flexDirection: "row", gap: 10 },
  navBar: { flex: 1, height: NAV_HEIGHT, borderRadius: 999, flexDirection: "row", alignItems: "center", padding: 6 },
  navItem: { flex: 1, height: 52, alignItems: "center", justifyContent: "center" },
  navLight: { width: NAV_HEIGHT, height: NAV_HEIGHT, borderRadius: 999, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
});
