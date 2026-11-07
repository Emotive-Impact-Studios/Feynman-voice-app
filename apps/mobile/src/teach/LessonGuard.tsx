// If anything in a Teach me lesson goes wrong while it shows, the learner
// sees a calm message and can go back to the call, instead of the whole app
// closing. (In a release build an error on screen closes the app.)
import { Component, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colour } from "../theme";
import { PillButton, T } from "../ui/kit";

export class LessonGuard extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Teach me lesson failed", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={[StyleSheet.absoluteFill, styles.centre]}>
        <T size={18} weight="medium" style={{ textAlign: "center" }}>
          The lesson hit a snag
        </T>
        <T size={14.5} tone="soft" style={{ textAlign: "center", marginTop: 8, maxWidth: 300 }}>
          Sorry about that. You can carry on explaining to Fenny.
        </T>
        <PillButton label="Back to the call" variant="solid" style={{ marginTop: 26, alignSelf: "stretch" }} onPress={this.props.onClose} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  centre: { backgroundColor: colour.ground, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
});
