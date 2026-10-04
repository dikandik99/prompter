import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Badge } from "@/src/components/ui";
import { useAuth } from "@/src/auth/AuthProvider";
import { useI18n } from "@/src/i18n";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Tool = { id: string; icon: string; title: string; desc: string; route: string; pro?: boolean };

const TOOLS: Tool[] = [
  { id: "countdown", icon: "timer-outline", title: "Countdown Timer", desc: "Hitung mundur sebelum rekam", route: "/tool/countdown" },
  { id: "speaking", icon: "stopwatch-outline", title: "Speaking Timer", desc: "Ukur durasi bicara", route: "/tool/speaking" },
  { id: "wordcount", icon: "text-outline", title: "Word Counter", desc: "Hitung kata & karakter", route: "/tool/wordcount" },
  { id: "readingspeed", icon: "speedometer-outline", title: "Reading Speed", desc: "Kalkulator kecepatan baca", route: "/tool/readingspeed" },
  { id: "duration", icon: "time-outline", title: "Script Duration", desc: "Estimasi durasi skrip", route: "/tool/duration" },
  { id: "translate", icon: "language-outline", title: "Translation", desc: "Terjemahkan skrip (AI)", route: "/translate/new", pro: true },
  { id: "voiceglide", icon: "mic-outline", title: "VoiceGlide", desc: "Teleprompter ikuti suara", route: "/tool/voiceglide", pro: true },
  { id: "teleset", icon: "tv-outline", title: "Teleprompter", desc: "Atur tampilan teleprompter", route: "/(tabs)/settings" },
  { id: "ai", icon: "sparkles-outline", title: "AI Assistant", desc: "Hook, CTA & rewrite", route: "/tool/ai", pro: true },
];

export default function ToolsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPro } = useAuth();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}
      showsVerticalScrollIndicator={false}
      testID="tools-screen"
    >
      <Text style={styles.title}>{t("tools.title")}</Text>
      <View style={styles.grid}>
        {TOOLS.map((tool) => (
          <Pressable
            key={tool.id}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(tool.route as any)}
            testID={`tool-${tool.id}`}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={tool.icon as any} size={24} color={colors.brand} />
            </View>
            {tool.pro && !isPro ? (
              <View style={styles.proBadge}>
                <Badge label="PRO" />
              </View>
            ) : null}
            <Text style={styles.cardTitle}>{tool.title}</Text>
            <Text style={styles.cardDesc} numberOfLines={2}>
              {tool.desc}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.onSurface, fontSize: 30, fontWeight: "800", marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: {
    width: "47.8%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minHeight: 130,
  },
  iconWrap: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  proBadge: { position: "absolute", top: spacing.md, right: spacing.md },
  cardTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  cardDesc: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
}));
