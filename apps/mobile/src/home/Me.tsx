// H3: minutes and last topic, also shown when minutes run low.
import { StyleSheet, View } from "react-native";
import { lastTopic, me } from "../data/mock";
import { colour } from "../theme";
import { MinutesRing } from "../ui/Dots";
import { Backdrop, Glass, images, Label, PillButton, T } from "../ui/kit";
import { homeStyles } from "./styles";

export function Me({ top, onNew, onCarryOn }: { top: number; onNew: () => void; onCarryOn: () => void }) {
  return (
    <>
      <Backdrop source={images.horizon} opacity={0.5} flip offsetY={-380} />
      <View style={[homeStyles.page, { paddingTop: top + 16, alignItems: "center" }]}>
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
            <View style={homeStyles.rowBetween}>
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

const styles = StyleSheet.create({
  panelWrap: { position: "absolute", left: 10, right: 10, bottom: 100, height: 250 },
  panel: { flex: 1, borderRadius: 38 },
});
