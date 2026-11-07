// Teach me this thing. Point the camera at something real, Fenny has a look,
// reacts, and asks a curious question that fits your subjects. You do the
// explaining: "Explain it" opens a normal session on that question, and the
// photo becomes the topic's card in Topics.
//
// The server names the thing for now (see apps/api/src/look.ts). When Cactus
// Mirage gets a React Native package, an instant on-phone guess can go in
// lookAt's `guess` and the server confirms it.
import { useCallback, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { Directory, File, Paths } from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import { lookAt, type Look } from "../api";
import { setTopicPhoto, SUBJECTS, useProfile } from "../data/profile";
import { colour } from "../theme";
import { useFennyCue } from "../ui/FennyOrb";
import { Glass, Icon, Label, PillButton, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { riseIn } from "../ui/motion";
import { Press } from "../ui/Press";
import { Soft } from "../ui/Soft";

type Phase = "aim" | "looking" | "seen" | "unclear" | "error";

/**
 * The smallest picture size with a long side of at least 1000 px: plenty for
 * the server (it looks at a small tile) and for the topic card, and quick to send.
 * Sizes the phone names without numbers ("Photo", "High") are skipped.
 */
export function pickPictureSize(sizes: string[]): string | undefined {
  const sized = sizes
    .map((s) => {
      const m = /(\d+)x(\d+)/.exec(s);
      return m ? { s, long: Math.max(Number(m[1]), Number(m[2])) } : null;
    })
    .filter((x): x is { s: string; long: number } => !!x)
    .sort((a, b) => a.long - b.long);
  return (sized.find((x) => x.long >= 1000) ?? sized[sized.length - 1])?.s;
}

/** Subject labels for the server, from the ids saved in the intro. */
function subjectLabels(ids: string[]): string[] {
  return ids.flatMap((id) => {
    const label = SUBJECTS.find(([k]) => k === id)?.[1];
    return label && id !== "other" ? [label] : [];
  });
}

/** Keep the photo in the app's documents, so the topic card can show it later. */
function keepPhoto(uri: string): string {
  try {
    const dir = new Directory(Paths.document, "looks");
    dir.create({ idempotent: true, intermediates: true });
    const dest = new File(dir, `${Date.now()}.jpg`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

export default function LookMode() {
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const reduce = useReducedMotion();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState<string | undefined>();
  const [phase, setPhase] = useState<Phase>("aim");
  const [photo, setPhoto] = useState<string | null>(null);
  const [look, setLook] = useState<Look | null>(null);
  const [pick, setPick] = useState(0);
  const [error, setError] = useState("");
  const [cue, react] = useFennyCue();
  const abort = useRef<AbortController | null>(null);

  const onReady = useCallback(async () => {
    setReady(true);
    try {
      const sizes = (await camera.current?.getAvailablePictureSizesAsync()) ?? [];
      setSize(pickPictureSize(sizes));
    } catch {
      // The default size works too, it is just bigger to send.
    }
  }, []);

  const snap = async () => {
    if (!camera.current || !ready || phase !== "aim") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const shot = await camera.current.takePictureAsync({ quality: 0.5, base64: true, shutterSound: false });
      if (!shot?.base64) throw new Error("No photo");
      setPhoto(shot.uri);
      setPhase("looking");
      react("hmm");
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      const l = await lookAt({ image: shot.base64, subjects: subjectLabels(profile.subjects) }, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setLook(l);
      setPick(0);
      setPhase(l.clear ? "seen" : "unclear");
      react(l.clear ? "aha" : "oops");
      if (l.clear) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message || "Something went wrong");
      setPhase("error");
      react("oops");
    }
  };

  const again = () => {
    abort.current?.abort();
    setPhoto(null);
    setLook(null);
    setError("");
    setPhase("aim");
  };

  const close = () => {
    abort.current?.abort();
    router.back();
  };

  const explain = () => {
    const angle = look?.angles[pick];
    if (!angle || !photo) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTopicPhoto(angle.topic, keepPhoto(photo));
    router.replace({ pathname: "/session", params: { topic: angle.topic, prompt: angle.question } });
  };

  // Waiting on the permission answer.
  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.centre, { paddingHorizontal: 28 }]}>
        <TopRow top={insets.top} onClose={close} />
        <LivingLight size={96} peek />
        <T size={26} weight="medium" style={{ textAlign: "center", marginTop: 24 }}>
          Show Fenny something real
        </T>
        <T size={15} tone="soft" style={{ textAlign: "center", marginTop: 10 }}>
          Point your camera at a thing you could explain, and Fenny will ask you about it. Photos are only used to work out what it is.
        </T>
        <PillButton
          label={permission.canAskAgain ? "Allow the camera" : "Open Settings"}
          variant="solid"
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          style={{ height: 52, marginTop: 26, paddingHorizontal: 28 }}
        />
      </View>
    );
  }

  const angle = look?.angles[pick];
  const enter = (d: number) => (reduce ? undefined : riseIn(d));

  return (
    <View style={styles.root}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" pictureSize={size} onCameraReady={onReady} animateShutter={false} active={phase === "aim"} />
      {photo && (
        <Animated.View entering={reduce ? undefined : FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      )}
      {/* A soft fade so the words and the button sit on dark. */}
      <LinearGradient pointerEvents="none" colors={["rgba(8,9,11,0.55)", "rgba(8,9,11,0)"]} style={[styles.fadeTop, { height: insets.top + 90 }]} />
      <LinearGradient pointerEvents="none" colors={["rgba(8,9,11,0)", "rgba(8,9,11,0.7)", colour.ground]} locations={[0, 0.45, 1]} style={styles.fadeBottom} />

      <TopRow top={insets.top} onClose={close} />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]} pointerEvents="box-none">
        {phase === "aim" && (
          <Animated.View key="aim" entering={enter(0)} exiting={reduce ? undefined : FadeOut.duration(120)} style={styles.centre}>
            <T size={16} tone="soft" style={{ textAlign: "center", marginBottom: 22 }}>
              Point at something you could explain
            </T>
            <Press onPress={snap} disabled={!ready} accessibilityRole="button" accessibilityLabel="Show Fenny">
              <Soft lit glow style={{ width: 78, height: 78, opacity: ready ? 1 : 0.5 }} />
            </Press>
          </Animated.View>
        )}

        {phase === "looking" && (
          <Animated.View key="looking" entering={enter(0)} style={styles.centre}>
            <LivingLight size={84} mood="curious" energy={0.5} cue={cue} />
            <T size={16} tone="soft" style={{ marginTop: 14 }}>
              Having a look
            </T>
          </Animated.View>
        )}

        {phase === "seen" && look && angle && (
          <Animated.View key="seen" entering={enter(0)}>
            <View style={{ alignItems: "center", marginBottom: -18, zIndex: 2 }}>
              <LivingLight size={76} mood="curious" cue={cue} peek />
            </View>
            <Glass style={styles.sheet}>
              <T size={26} weight="medium" style={{ marginTop: 10 }}>
                {look.reaction || `${look.thing.charAt(0).toUpperCase()}${look.thing.slice(1)}!`}
              </T>
              <T size={19} tone="text" style={{ marginTop: 10, color: "#D6D9DE" }}>
                {angle.question}
              </T>
              {look.angles.length > 1 && (
                <>
                  <Label style={{ marginTop: 18 }}>Or ask as</Label>
                  <View style={styles.chips}>
                    {look.angles.map((a, i) => (
                      <Press
                        key={i}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setPick(i);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: i === pick }}
                        accessibilityLabel={`Ask as ${a.subject}`}
                        style={[styles.chip, i === pick && styles.chipOn]}
                      >
                        <T size={13.5} tone={i === pick ? "dark" : "soft"} weight={i === pick ? "medium" : "regular"}>
                          {a.subject === "everyday" ? "Everyday" : a.subject}
                        </T>
                      </Press>
                    ))}
                  </View>
                </>
              )}
              <View style={styles.buttons}>
                <PillButton label="Try another" onPress={again} style={{ flex: 1, height: 52 }} />
                <PillButton label="Explain it" variant="solid" onPress={explain} style={{ flex: 1.4, height: 52 }} />
              </View>
            </Glass>
          </Animated.View>
        )}

        {(phase === "unclear" || phase === "error") && (
          <Animated.View key="retry" entering={enter(0)}>
            <View style={{ alignItems: "center", marginBottom: -18, zIndex: 2 }}>
              <LivingLight size={76} mood="lost" cue={cue} />
            </View>
            <Glass style={styles.sheet}>
              <T size={19} style={{ marginTop: 12, color: "#D6D9DE" }}>
                {phase === "unclear" ? look?.retry : error}
              </T>
              <PillButton label="Try again" variant="solid" onPress={again} style={{ height: 52, marginTop: 18 }} />
            </Glass>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function TopRow({ top, onClose }: { top: number; onClose: () => void }) {
  return (
    <View style={[styles.top, { paddingTop: top + 8 }]}>
      <Press onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
        <Soft style={{ width: 40, height: 40 }}>
          <Icon name="close" size={18} color={colour.soft} />
        </Soft>
      </Press>
      <Label tone="soft">Teach me this thing</Label>
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colour.ground },
  centre: { alignItems: "center", justifyContent: "center" },
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 5 },
  fadeTop: { position: "absolute", left: 0, right: 0, top: 0 },
  fadeBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 380 },
  bottom: { position: "absolute", left: 16, right: 16, bottom: 0 },
  sheet: { borderRadius: 32, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, backgroundColor: "rgba(18,19,22,0.82)" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: "#24272C" },
  chipOn: { backgroundColor: "#E4E7EB" },
  buttons: { flexDirection: "row", gap: 10, marginTop: 20 },
});
