import { StyleSheet } from "react-native";
import { colour } from "../theme";

export const NAV_HEIGHT = 64;
/** Distance from the screen's bottom edge to the bottom of the nav bar. */
export const navOffset = (bottomInset: number) => Math.max(bottomInset, 16) + 6;

export const homeStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colour.ground },
  page: { flex: 1, paddingHorizontal: 22 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stats: { flexDirection: "row", justifyContent: "center", gap: 40 },
});

export const pad = (n: number) => String(n).padStart(2, "0");
