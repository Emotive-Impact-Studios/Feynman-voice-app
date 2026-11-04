// H2: reviews are due, the card stack takes over. Shows a caught-up state
// once the queue is empty, so the tab never opens on a blank page.
import { Pressable, View } from "react-native";
import { me, type ReviewCard } from "../data/mock";
import { CardStack, useCardHeight } from "../ui/CardStack";
import { Backdrop, Icon, images, PillButton, Stat, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { SilverRing } from "../ui/SilverRing";
import { homeStyles, NAV_HEIGHT, navOffset, pad } from "./styles";

// Stats row (about 52) plus the gap above the card.
const ABOVE_CARD = 20 + 52 + 34;

export function Today({
  top,
  bottom,
  queue,
  mastered,
  onAnswer,
  onExplain,
  onStart,
}: {
  top: number;
  bottom: number;
  queue: ReviewCard[];
  mastered: number;
  onAnswer: (knewIt: boolean) => void;
  onExplain: (card: ReviewCard) => void;
  onStart: () => void;
}) {
  const card = queue[0];
  const height = useCardHeight({ above: top + ABOVE_CARD, below: navOffset(bottom) + NAV_HEIGHT + 12, max: 470 });
  return (
    <>
      <Backdrop source={images.horizon} opacity={0.45} />
      <View style={[homeStyles.page, { paddingTop: top + 20 }]}>
        <View style={homeStyles.stats}>
          <Stat value={String(me.minutesLeft)} label="Minutes" />
          <Stat value={pad(queue.length)} label="Due" />
          <Stat value={pad(mastered)} label="Mastered" />
        </View>
        {card ? (
          <View style={{ marginTop: 34 }}>
            <CardStack
              key={card.id}
              height={height}
              art={images.cardReview}
              tags={[`Due today · ${card.topic}`]}
              title={card.prompt}
              note={card.note}
              behind={Math.min(2, queue.length - 1)}
              actions={
                <>
                  <PillButton accessibilityLabel="Explain again later" onPress={() => onAnswer(false)} style={{ flex: 1 }}>
                    <Icon name="close" />
                  </PillButton>
                  <Pressable accessibilityRole="button" accessibilityLabel="Explain it now" onPress={() => onExplain(card)}>
                    <SilverRing width={56} height={56}>
                      <Icon name="mic" />
                    </SilverRing>
                  </Pressable>
                  <PillButton accessibilityLabel="I know this" onPress={() => onAnswer(true)} style={{ flex: 1 }}>
                    <Icon name="check" />
                  </PillButton>
                </>
              }
            />
          </View>
        ) : (
          <View style={{ marginTop: 72, alignItems: "center", gap: 18 }}>
            <LivingLight size={96} />
            <T size={26} weight="medium" style={{ textAlign: "center" }}>
              <T size={26} weight="medium" tone="dim">
                All caught up.
              </T>
              {"\n"}Nothing due today.
            </T>
            <PillButton label="Start explaining" variant="solid" onPress={onStart} style={{ marginTop: 10, paddingHorizontal: 28 }} />
          </View>
        )}
      </View>
    </>
  );
}
