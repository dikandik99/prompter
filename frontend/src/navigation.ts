import { Platform } from "react-native";

// Native tabs (liquid glass) only on iOS 26+. Everywhere else uses classic Tabs.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
