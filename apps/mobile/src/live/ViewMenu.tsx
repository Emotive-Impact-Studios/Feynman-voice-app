// The session's view menu, from the canvas board: "Show me" Light only,
// Subtitles or Full chat, with a tick on the current one. It springs in from
// the view button at the top right.
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeOut, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { colour } from "../theme";
import { Label, T } from "../ui/kit";
import { spring } from "../ui/motion";
import { Press } from "../ui/Press";

import type { SessionViewPref } from "../data/profile";

export type SessionView = SessionViewPref;

export const VIEWS: { id: SessionView; label: string }[] = [
  { id: "light", label: "Light only" },
  { id: "subtitles", label: "Subtitles" },
  { id: "chat", label: "Full chat" },
];

const VIEW_ICON: Record<SessionView, string> = {
  light: "M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 2v1.5M12 20.5V22M2 12h1.5M20.5 12H22",
  subtitles: "M4 6h16v12H4zM7.5 14h4M13.5 14h3M7.5 10.5h9",
  chat: "M5 5h14v10H10l-4 3.5V15H5z",
};

/** The session's options button: three sliders, so it reads as settings. */
export function OptionsIcon({ size = 18, color = colour.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" stroke={color} strokeWidth={1.7} strokeLinecap="round" fill="none" />
      <Path d="M15 5v4M9 10v4M17 15v4" stroke={color} strokeWidth={1.7} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function ViewIcon({ id, size = 18, color = colour.text }: { id: SessionView; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={VIEW_ICON[id]} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Grows from 0.85 near the button with a small drop, on the smooth spring.
function menuIn() {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.85 }, { translateY: -6 }] },
    animations: {
      opacity: withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
      transform: [{ scale: withSpring(1, spring.smooth) }, { translateY: withSpring(0, spring.smooth) }],
    },
  };
}

export function ViewMenu({
  top,
  view,
  onPick,
  onClose,
  onTesting,
}: {
  top: number;
  view: SessionView;
  onPick: (v: SessionView) => void;
  onClose: () => void;
  /** Opens the voice and ears switches used while testing. */
  onTesting: () => void;
}) {
  return (
    <>
      <Pressable style={[StyleSheet.absoluteFill, { zIndex: 30 }]} onPress={onClose} accessibilityLabel="Close menu" />
      <Animated.View entering={menuIn} exiting={FadeOut.duration(140)} style={[styles.menu, { top }]} accessibilityRole="menu" accessibilityLabel="Session view">
        <Label style={styles.head}>Show me</Label>
        {VIEWS.map((v) => {
          const on = v.id === view;
          return (
            <Press
              key={v.id}
              accessibilityRole="menuitem"
              accessibilityState={{ checked: on }}
              onPress={() => onPick(v.id)}
              style={[styles.item, on && { backgroundColor: "rgba(255,255,255,0.09)" }]}
            >
              <ViewIcon id={v.id} color={on ? colour.text : "#C9CCD2"} />
              <T size={15} style={{ flex: 1, color: on ? colour.text : "#C9CCD2" }}>
                {v.label}
              </T>
              <View style={{ opacity: on ? 1 : 0 }}>
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colour.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </Svg>
              </View>
            </Press>
          );
        })}
        <View style={styles.rule} />
        <Press accessibilityRole="menuitem" onPress={onTesting} style={styles.item}>
          <T size={13} tone="muted">
            Voice and ears (testing)
          </T>
        </Press>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    right: 16,
    zIndex: 31,
    width: 220,
    padding: 6,
    borderRadius: 22,
    backgroundColor: "rgba(24,25,29,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    transformOrigin: "85% 0%",
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 20 },
  },
  head: { fontSize: 11, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  item: { height: 48, paddingHorizontal: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colour.hairline, marginHorizontal: 12, marginTop: 6 },
});
