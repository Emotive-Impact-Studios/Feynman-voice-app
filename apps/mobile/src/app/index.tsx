// Home. One screen with three states:
//   explain (H1): nothing due, one way in
//   today   (H2): reviews are due, the card stack takes over
//   me      (H3): minutes and last topic, also shown when minutes run low
// The states live in src/home; review progress lives in src/data/reviews so
// it survives Home being mounted again after a session.
import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { me, type ReviewCard } from "../data/mock";
import { answerReview, useReviews } from "../data/reviews";
import { Explain } from "../home/Explain";
import { Me } from "../home/Me";
import { Nav, type HomeState } from "../home/Nav";
import { homeStyles } from "../home/styles";
import { Today } from "../home/Today";

const LOW_MINUTES = 20;

export default function Home() {
  const insets = useSafeAreaInsets();
  const { queue, mastered } = useReviews();
  const [state, setState] = useState<HomeState>(() => (me.minutesLeft < LOW_MINUTES ? "me" : queue.length > 0 ? "today" : "explain"));
  const startSession = () => router.push("/session");
  const explainCard = (card: ReviewCard) => router.push({ pathname: "/session", params: { topic: card.topic, prompt: card.prompt } });

  const answer = (knewIt: boolean) => {
    answerReview(knewIt);
    if (queue.length <= 1) setState("explain");
  };

  return (
    <View style={homeStyles.root}>
      {state === "explain" && <Explain top={insets.top} onStart={startSession} onReviews={() => setState("today")} onMe={() => setState("me")} due={queue.length} />}
      {state === "today" && (
        <Today top={insets.top} bottom={insets.bottom} queue={queue} mastered={mastered} onAnswer={answer} onExplain={explainCard} onStart={startSession} />
      )}
      {state === "me" && <Me top={insets.top} onNew={() => setState("explain")} onCarryOn={startSession} />}
      {state !== "explain" && <Nav bottom={insets.bottom} state={state} onChange={setState} onStart={startSession} />}
    </View>
  );
}
