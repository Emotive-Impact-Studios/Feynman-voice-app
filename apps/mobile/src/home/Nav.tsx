// Home's bottom bar: the three states plus the living light to start talking.
import { Pressable, StyleSheet, View } from "react-native";
import { Glass, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { SilverRing } from "../ui/SilverRing";
import { NAV_HEIGHT, navOffset } from "./styles";

export type HomeState = "explain" | "today" | "me";

export function Nav({ bottom, state, onChange, onStart }: { bottom: number; state: HomeState; onChange: (s: HomeState) => void; onStart: () => void }) {
  const tabs: { id: HomeState; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "explain", label: "Explain" },
    { id: "me", label: "Me" },
  ];
  return (
    <View style={[styles.nav, { bottom: navOffset(bottom) }]} accessibilityRole="tablist">
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
  nav: { position: "absolute", left: 16, right: 16, flexDirection: "row", gap: 10 },
  navBar: { flex: 1, height: NAV_HEIGHT, borderRadius: 999, flexDirection: "row", alignItems: "center", padding: 6 },
  navItem: { flex: 1, height: 52, alignItems: "center", justifyContent: "center" },
  navLight: { width: NAV_HEIGHT, height: NAV_HEIGHT, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
