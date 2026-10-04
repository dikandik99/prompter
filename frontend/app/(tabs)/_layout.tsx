import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useI18n } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="doc.text.fill" />
          <NativeTabs.Trigger.Label>{t("tabs.scripts")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="record">
          <NativeTabs.Trigger.Icon sf="video.fill" />
          <NativeTabs.Trigger.Label>{t("tabs.record")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="library">
          <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" />
          <NativeTabs.Trigger.Label>{t("tabs.library")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="tools">
          <NativeTabs.Trigger.Icon sf="wrench.and.screwdriver.fill" />
          <NativeTabs.Trigger.Label>{t("tabs.tools")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>{t("tabs.settings")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  const icon =
    (name: string) =>
    ({ color, focused }: { color: string; focused: boolean }) =>
      <Ionicons name={(focused ? name : `${name}-outline`) as any} size={24} color={color} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.scripts"), tabBarIcon: icon("document-text") }} />
      <Tabs.Screen name="record" options={{ title: t("tabs.record"), tabBarIcon: icon("videocam") }} />
      <Tabs.Screen name="library" options={{ title: t("tabs.library"), tabBarIcon: icon("albums") }} />
      <Tabs.Screen name="tools" options={{ title: t("tabs.tools"), tabBarIcon: icon("construct") }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings"), tabBarIcon: icon("settings") }} />
    </Tabs>
  );
}
