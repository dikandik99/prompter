import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export const ONBOARDED_KEY = "promptera.onboarded";

export default function Index() {
  const { colors } = useTheme();
  const [state, setState] = useState<"loading" | "onboard" | "app">("loading");

  useEffect(() => {
    storage.getItem<boolean>(ONBOARDED_KEY, false).then((done) => {
      setState(done ? "app" : "onboard");
    });
  }, []);

  if (state === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return <Redirect href={state === "onboard" ? "/onboarding" : "/(tabs)"} />;
}
