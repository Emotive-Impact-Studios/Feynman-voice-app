// Home: Today, Topics and Me, from the canvas board "THE APP: start here".
// First run goes to the intro.
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TELL_ME } from "../data/lastCall";
import { minutesLeft, replayIntro, useProfile, type SavedGap } from "../data/profile";
import { Me } from "../home/Me";
import { Nav, TopBar, type HomeTab } from "../home/Nav";
import { homeStyles } from "../home/styles";
import { Today } from "../home/Today";
import { Topics } from "../home/Topics";
import { Backdrop } from "../ui/kit";
import { ScreenIn } from "../ui/ScreenIn";

const dusk = require("../../assets/images/home-dusk.webp");

export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const profile = useProfile();
  const [tab, setTab] = useState<HomeTab>("today");
  if (!profile.introDone) return <Redirect href="/intro" />;

  const onNew = () => router.push("/topic");
  const onTopic = (topic: string) => router.push({ pathname: "/session", params: { topic } });
  // A saved gap opens a call on that gap, with Fenny asking them to tell it in their own words.
  const onGap = (topic: string, gap: SavedGap) =>
    router.push({ pathname: "/session", params: { topic, prompt: TELL_ME, focus: gap.title, focusId: gap.id } });
  const common = { profile, top: insets.top, bottom: insets.bottom };

  return (
    <View style={homeStyles.root}>
      <Backdrop source={dusk} opacity={tab === "today" ? 0.85 : 0.45} flip={tab === "topics"} />
      <ScreenIn key={tab}>
        {tab === "today" && <Today {...common} onNew={onNew} onTopic={onTopic} onGap={onGap} />}
        {tab === "topics" && <Topics {...common} onNew={onNew} onTopic={onTopic} />}
        {tab === "me" && (
          <Me
            {...common}
            onReplayIntro={() => {
              replayIntro();
            }}
          />
        )}
      </ScreenIn>
      <TopBar top={insets.top} tab={tab} minutes={minutesLeft(profile)} initial={(profile.name[0] ?? "?").toUpperCase()} onMe={() => setTab("me")} />
      <Nav bottom={insets.bottom} tab={tab} onChange={setTab} onStart={onNew} width={width} />
    </View>
  );
}
