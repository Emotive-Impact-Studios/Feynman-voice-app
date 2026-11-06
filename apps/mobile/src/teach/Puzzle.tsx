// One quick puzzle per bite: true or false, pick one, fill the gap, put in
// order, or match them up. A wrong answer is never punished: the right one
// shows, with why, and they carry on.
import { useMemo, useState } from "react";
import { View } from "react-native";
import * as Haptics from "expo-haptics";
import type { LessonPuzzle } from "../api";
import { colour } from "../theme";
import { T } from "../ui/kit";
import { Press } from "../ui/Press";

type State = "idle" | "picked" | "right" | "wrong" | "shown";

const FILL: Record<State, string> = {
  idle: "rgba(255,255,255,0.06)",
  picked: "rgba(169,190,230,0.16)",
  right: "rgba(169,190,230,0.24)",
  wrong: "rgba(240,154,128,0.20)",
  shown: "rgba(169,190,230,0.14)",
};

function Choice({ label, state, onPress, disabled }: { label: string; state: State; onPress?: () => void; disabled?: boolean }) {
  const text = state === "wrong" ? colour.gap : state === "idle" ? colour.text : colour.student;
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: state !== "idle" }}
      disabled={disabled}
      onPress={onPress}
      style={{ paddingVertical: 15, paddingHorizontal: 18, borderRadius: 20, backgroundColor: FILL[state] }}
    >
      <T size={15.5} weight={state === "idle" ? "regular" : "medium"} style={{ color: text }}>
        {label}
      </T>
    </Press>
  );
}

/** A stable shuffle, so a re-render doesn't move the cards. Never returns the answer order when it can avoid it. */
function shuffled<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

const tick = (ok: boolean) => Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});

export function Puzzle({ puzzle, onDone }: { puzzle: LessonPuzzle; onDone: (correct: boolean) => void }) {
  if (puzzle.kind === "order") return <Order puzzle={puzzle} onDone={onDone} />;
  if (puzzle.kind === "match") return <Match puzzle={puzzle} onDone={onDone} />;
  return <Pick puzzle={puzzle} onDone={onDone} />;
}

/** True or false, pick one, and fill the gap. */
function Pick({ puzzle, onDone }: { puzzle: LessonPuzzle; onDone: (correct: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const answer = puzzle.answer[0];
  const options = useMemo(() => (puzzle.kind === "true_false" ? puzzle.options : shuffled(puzzle.options, puzzle.prompt)), [puzzle]);
  const pick = (o: string) => {
    if (picked) return;
    setPicked(o);
    tick(o === answer);
    onDone(o === answer);
  };
  const [before, after] = puzzle.kind === "fill_gap" ? puzzle.prompt.split("___") : [puzzle.prompt, undefined];
  const state = (o: string): State => (!picked ? "idle" : o === answer ? (o === picked ? "right" : "shown") : o === picked ? "wrong" : "idle");
  return (
    <View style={{ gap: 22 }}>
      {after !== undefined ? (
        <T size={22} weight="medium" style={{ lineHeight: 31 }}>
          {before}
          <T size={22} weight="medium" style={{ color: picked ? (picked === answer ? colour.student : colour.gap) : colour.muted }}>
            {picked ?? "_____"}
          </T>
          {after}
        </T>
      ) : (
        <T size={22} weight="medium" style={{ lineHeight: 30 }}>
          {before}
        </T>
      )}
      <View style={{ gap: 10, flexDirection: puzzle.kind === "true_false" ? "row" : "column" }}>
        {options.map((o) => (
          <View key={o} style={puzzle.kind === "true_false" ? { flex: 1 } : undefined}>
            <Choice label={o} state={state(o)} disabled={!!picked} onPress={() => pick(o)} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Put it in order: tap the steps one after another. Tap a placed step to take it back. */
function Order({ puzzle, onDone }: { puzzle: LessonPuzzle; onDone: (correct: boolean) => void }) {
  const pool = useMemo(() => shuffled(puzzle.answer, puzzle.prompt), [puzzle]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const place = (s: string) => {
    if (checked !== null) return;
    const next = [...placed, s];
    setPlaced(next);
    if (next.length === puzzle.answer.length) {
      const ok = next.every((x, i) => x === puzzle.answer[i]);
      setChecked(ok);
      tick(ok);
      onDone(ok);
    }
  };
  const order = checked === false ? puzzle.answer : placed;
  return (
    <View style={{ gap: 18 }}>
      <T size={22} weight="medium" style={{ lineHeight: 30 }}>
        {puzzle.prompt}
      </T>
      <View style={{ gap: 8 }}>
        {puzzle.answer.map((_, i) => {
          const s = order[i];
          return (
            <Press
              key={i}
              accessibilityRole="button"
              accessibilityLabel={s ? `Step ${i + 1}: ${s}. Tap to take it back.` : `Step ${i + 1}, empty`}
              disabled={!s || checked !== null}
              onPress={() => setPlaced((p) => p.slice(0, i))}
              style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 13, paddingHorizontal: 16, borderRadius: 18, backgroundColor: s ? FILL[checked === null ? "picked" : checked ? "right" : "shown"] : "rgba(255,255,255,0.03)" }}
            >
              <T size={12} weight="mono" tone="muted">
                {i + 1}
              </T>
              <T size={15} tone={s ? "text" : "muted"} style={{ flexShrink: 1 }}>
                {s ?? " "}
              </T>
            </Press>
          );
        })}
      </View>
      {checked === null && (
        <View style={{ gap: 8 }}>
          {pool
            .filter((s) => !placed.includes(s))
            .map((s) => (
              <Choice key={s} label={s} state="idle" onPress={() => place(s)} />
            ))}
        </View>
      )}
    </View>
  );
}

/** Match them up: tap a word on the left, then what it goes with on the right. */
function Match({ puzzle, onDone }: { puzzle: LessonPuzzle; onDone: (correct: boolean) => void }) {
  const right = useMemo(() => shuffled(puzzle.answer, puzzle.prompt), [puzzle]);
  const [left, setLeft] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [miss, setMiss] = useState<{ l: number; r: string } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const tryPair = (r: string) => {
    if (left === null) return;
    if (puzzle.answer[left] === r) {
      const next = [...done, left];
      setDone(next);
      setLeft(null);
      setMiss(null);
      Haptics.selectionAsync().catch(() => {});
      if (next.length === puzzle.options.length) {
        tick(mistakes === 0);
        onDone(mistakes === 0);
      }
    } else {
      setMiss({ l: left, r });
      setMistakes((m) => m + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  };
  const doneRight = done.map((i) => puzzle.answer[i]);
  return (
    <View style={{ gap: 18 }}>
      <T size={22} weight="medium" style={{ lineHeight: 30 }}>
        {puzzle.prompt}
      </T>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, gap: 8 }}>
          {puzzle.options.map((o, i) => (
            <Choice
              key={o}
              label={o}
              state={done.includes(i) ? "right" : miss?.l === i ? "wrong" : left === i ? "picked" : "idle"}
              disabled={done.includes(i)}
              onPress={() => {
                setLeft(i);
                setMiss(null);
              }}
            />
          ))}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          {right.map((r) => (
            <Choice
              key={r}
              label={r}
              state={doneRight.includes(r) ? "right" : miss?.r === r ? "wrong" : "idle"}
              disabled={doneRight.includes(r) || left === null}
              onPress={() => tryPair(r)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
