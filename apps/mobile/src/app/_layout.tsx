import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts, InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from "@expo-google-fonts/instrument-sans";
import { GeistMono_400Regular, GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import { View } from "react-native";
import { colour } from "../theme";

export default function RootLayout() {
  const [loaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colour.ground }} />;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colour.ground }, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="session" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
        <Stack.Screen name="intro" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="topic" options={{ presentation: "transparentModal", animation: "none" }} />
        <Stack.Screen name="dev" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}
