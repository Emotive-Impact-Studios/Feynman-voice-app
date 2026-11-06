// Teach me: when the learner clearly doesn't know a bit yet, the call steps
// aside for a two minute lesson on just that idea. A few bites, each with a
// picture and a quick puzzle, built from their notes on the server. Then
// back to Fenny to explain it in their own words. Fenny never teaches: this
// screen is the notes talking, and Fenny only listens again afterwards.
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { fetchLesson, type Lesson } from "../api";
import { colour } from "../theme";
import { Backdrop, Label, PillButton, Stat, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { useFennyCue } from "../ui/FennyOrb";
import { Press } from "../ui/Press";
import { riseIn, STAGGER_MS } from "../ui/motion";
import { Picture } from "./Picture";
import { Puzzle } from "./Puzzle";

type Step = { kind: "read"; i: number } | { kind: "try"; i: number } | { kind: "finish" };

export function TeachMode({
  topic,
  idea,
  said,
  notes,
  onClose,
  onDone,
  speak,
  hush,
}: {
  topic: string;
  idea: string;
  said?: string;
  notes?: string;
  /** Leave without finishing: back to the call as it was. */
  onClose: () => void;
  /** Finished: Fenny's question about what they just learnt. */
  onDone: (question: string) => void;
  /** Read a line aloud in Fenny's chosen voice (Cartesia or Phonon). */
  speak?: (text: string) => Promise<void>;
  /** Stop reading aloud. */
  hush?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: "read", i: 0 });
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [right, setRight] = useState(0);
  // Fenny reacts to each puzzle answer, and cheers at the end.
  const [cue, react] = useFennyCue();
  const [attempt, setAttempt] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    const abort = new AbortController();
    setError(null);
    fetchLesson({ topic, idea, said, notes }, abort.signal)
      .then(setLesson)
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e instanceof Error ? e.message : e));
      });
    return () => abort.abort();
  }, [topic, idea, said, notes, attempt]);

  // Fenny reads each bite aloud as it appears, in the voice chosen in Me.
  useEffect(() => {
    if (!lesson || !speak) return;
    // The finish is said once back in the call, as Fenny's question.
    if (step.kind === "read") {
      const b = lesson.bites[step.i];
      speak(`${b.title}. ${b.text}`);
    }
    return () => hush?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, step]);

  const go = (s: Step) => {
    setAnswered(null);
    setStep(s);
    scroll.current?.scrollTo({ y: 0, animated: false });
    Haptics.selectionAsync().catch(() => {});
  };
  const next = () => {
    if (!lesson) return;
    if (step.kind === "read") go({ kind: "try", i: step.i });
    else if (step.kind === "try") go(step.i + 1 < lesson.bites.length ? { kind: "read", i: step.i + 1 } : { kind: "finish" });
  };

  const total = lesson ? lesson.bites.length * 2 : 4;
  const done = !lesson ? 0 : step.kind === "finish" ? total : step.i * 2 + (step.kind === "try" ? 1 : 0);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colour.ground }]} />
      <Backdrop scene="intro" />

      <ScrollView ref={scroll} contentContainerStyle={{ paddingTop: insets.top + 84, paddingHorizontal: 24, paddingBottom: 200, flexGrow: 1 }}>
        {!lesson && !error && (
          <View style={styles.centre}>
            <LivingLight size={90} energy={0.5} mood="think" touchable />
            <T size={18} weight="medium" style={{ textAlign: "center", marginTop: 26 }}>
              Making a short lesson
            </T>
            <T size={15} tone="soft" style={{ textAlign: "center", marginTop: 8, maxWidth: 300 }}>
              {idea}
            </T>
          </View>
        )}

        {error && (
          <View style={styles.centre}>
            <T size={18} weight="medium" style={{ textAlign: "center" }}>
              The lesson didn't load
            </T>
            <T size={14.5} tone="soft" style={{ textAlign: "center", marginTop: 8, maxWidth: 300 }}>
              {error}
            </T>
            <PillButton label="Try again" variant="solid" style={{ marginTop: 26, alignSelf: "stretch" }} onPress={() => setAttempt((n) => n + 1)} />
            <PillButton label="Back to the call" style={{ marginTop: 10, alignSelf: "stretch" }} onPress={onClose} />
          </View>
        )}

        {lesson && step.kind === "read" && (
          <Animated.View key={`read${step.i}`} entering={riseIn()} style={{ gap: 22 }}>
            <Label tone="student">
              {lesson.bites[step.i].fromNotes ? "From your notes · " : ""}Idea {step.i + 1} of {lesson.bites.length}
            </Label>
            <T size={30} weight="medium" style={{ lineHeight: 35 }}>
              {lesson.bites[step.i].title}
            </T>
            <T size={17} tone="soft" style={{ lineHeight: 26 }}>
              {lesson.bites[step.i].text}
            </T>
            <Animated.View entering={riseIn(STAGGER_MS * 3)} style={{ marginTop: 8 }}>
              <Picture kind={lesson.bites[step.i].picture.kind} labels={lesson.bites[step.i].picture.labels} />
            </Animated.View>
            {lesson.bites[step.i].fromNotes && lesson.bites[step.i].quote ? (
              <View style={styles.quote}>
                <T size={14} tone="soft" style={{ fontStyle: "italic", lineHeight: 21 }}>
                  "{lesson.bites[step.i].quote}"
                </T>
              </View>
            ) : null}
          </Animated.View>
        )}

        {lesson && step.kind === "try" && (
          <Animated.View key={`try${step.i}`} entering={riseIn()} style={{ gap: 18 }}>
            <Label tone="student">Try it</Label>
            <Puzzle
              puzzle={lesson.bites[step.i].puzzle}
              onDone={(ok) => {
                setAnswered(ok);
                if (ok) setRight((n) => n + 1);
                // After the sheet's Fenny has risen in.
                setTimeout(() => react(ok ? "yay" : "oops"), 260);
              }}
            />
          </Animated.View>
        )}

        {lesson && step.kind === "finish" && (
          <Animated.View entering={riseIn()} style={[styles.centre, { gap: 0 }]}>
            <LivingLight size={110} energy={1} mood="got" cue={cue} touchable />
            <T size={30} weight="medium" style={{ textAlign: "center", marginTop: 28, lineHeight: 35 }}>
              You've got it.{"\n"}
              <T size={30} weight="medium" tone="student">
                Now teach it to Fenny.
              </T>
            </T>
            <T size={16} tone="soft" style={{ textAlign: "center", marginTop: 14, maxWidth: 320, lineHeight: 24 }}>
              {lesson.recap}
            </T>
            <Animated.View entering={riseIn(STAGGER_MS * 3)} style={styles.stats}>
              <Stat value={String(lesson.bites.length)} label="ideas learnt" tone="student" />
              <Stat value={`${right}/${lesson.bites.length}`} label="first try" />
            </Animated.View>
          </Animated.View>
        )}
      </ScrollView>
      {/* Top: a way back, and one segment per bite and puzzle. Drawn after the
          scroll so nothing can sit over the back button. */}
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Press accessibilityRole="button" accessibilityLabel="Back to the call" onPress={onClose} style={styles.back} hitSlop={10}>
          <T size={14} tone="soft">
            Back to the call
          </T>
        </Press>
        <View style={styles.segments} accessibilityLabel={`Step ${Math.min(done + 1, total)} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.segment, i < done && styles.segmentDone, i === done && styles.segmentNow]} />
          ))}
        </View>
      </View>


      {/* Bottom: the next step. After a puzzle, a short sheet says why. */}
      {lesson && (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]} pointerEvents="box-none">
          {step.kind === "try" && answered !== null && (
            <Animated.View entering={riseIn()} style={[styles.sheet, { backgroundColor: answered ? "rgba(169,190,230,0.14)" : "rgba(240,154,128,0.14)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <LivingLight size={30} mood={answered ? "got" : "curious"} cue={cue} />
                <T size={16} weight="semibold" style={{ color: answered ? colour.student : colour.gap, flex: 1 }}>
                  {answered ? "Nice, that's it." : "Not quite, here's the right one."}
                </T>
              </View>
              <T size={14.5} tone="soft" style={{ marginTop: 4, lineHeight: 21 }}>
                {lesson.bites[step.i].puzzle.why}
              </T>
            </Animated.View>
          )}
          {step.kind === "read" && <PillButton label="Got it" variant="solid" onPress={next} />}
          {step.kind === "try" && answered !== null && <PillButton label="Continue" variant="solid" onPress={next} />}
          {step.kind === "finish" && <PillButton label="Back to Fenny" variant="solid" onPress={() => onDone(`Welcome back! ${lesson.explainBack}`)} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", left: 0, right: 0, zIndex: 2, paddingHorizontal: 20, gap: 14 },
  back: { alignSelf: "flex-start", paddingVertical: 6 },
  segments: { flexDirection: "row", gap: 5 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.10)" },
  segmentDone: { backgroundColor: colour.student },
  segmentNow: { backgroundColor: "rgba(169,190,230,0.45)" },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  quote: { borderLeftWidth: 2, borderLeftColor: "rgba(169,190,230,0.45)", paddingLeft: 14, paddingVertical: 2 },
  stats: { flexDirection: "row", gap: 44, marginTop: 30 },
  bottom: { position: "absolute", left: 20, right: 20, bottom: 0, gap: 12 },
  sheet: { borderRadius: 24, padding: 18 },
});
