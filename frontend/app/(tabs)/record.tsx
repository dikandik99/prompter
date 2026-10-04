import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useI18n } from "@/src/i18n";
import { useLibrary } from "@/src/store/library";
import { formatDuration } from "@/src/lib/text";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function RecordScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scripts } = useLibrary();

  const recent = useMemo(
    () => [...scripts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
    [scripts],
  );

  return (
    <ScrollView
      style={[styles.container]}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}
      showsVerticalScrollIndicator={false}
      testID="record-screen"
    >
      <Text style={styles.title}>{t("record.title")}</Text>

      <Pressable onPress={() => router.push("/camera")} testID="quick-record-button">
        <LinearGradient colors={[colors.brand, colors.brandSecondary]} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.recCircle}>
            <View style={styles.recDot} />
          </View>
          <Text style={styles.heroTitle}>{t("record.start")}</Text>
          <Text style={styles.heroSub}>{t("record.quick")}</Text>
        </LinearGradient>
      </Pressable>

      <View style={styles.guide}>
        <Text style={styles.guideTitle}>Siap untuk merekam?</Text>
        {[
          "Skrip akan muncul di layar",
          "Baca dengan nyaman",
          "Tekan tombol record",
          "Skrip berjalan otomatis",
        ].map((s, i) => (
          <View key={i} style={styles.guideRow}>
            <View style={styles.guideNum}>
              <Text style={styles.guideNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.guideText}>{s}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>{t("record.pick")}</Text>
      {recent.length === 0 ? (
        <Text style={styles.emptyHint}>Belum ada skrip. Buat skrip di tab Skrip.</Text>
      ) : (
        recent.map((s) => (
          <Pressable
            key={s.id}
            style={styles.scriptRow}
            onPress={() => router.push(`/camera?scriptId=${s.id}`)}
            testID={`record-pick-${s.id}`}
          >
            <View style={styles.scriptIcon}>
              <Ionicons name="document-text" size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scriptTitle} numberOfLines={1}>
                {s.title || "Untitled"}
              </Text>
              <Text style={styles.scriptMeta}>
                {s.wordCount} kata · {formatDuration(s.estimatedDuration)}
              </Text>
            </View>
            <View style={styles.goRec}>
              <Ionicons name="videocam" size={18} color={colors.onBrandPrimary} />
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.onSurface, fontSize: 30, fontWeight: "800", marginBottom: spacing.lg },
  hero: { borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", marginBottom: spacing.lg },
  recCircle: { width: 84, height: 84, borderRadius: radius.pill, borderWidth: 4, borderColor: "rgba(10,10,10,0.25)", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  recDot: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: "#0A0A0A" },
  heroTitle: { color: "#0A0A0A", fontSize: 22, fontWeight: "800" },
  heroSub: { color: "rgba(10,10,10,0.7)", fontSize: 14, fontWeight: "600", marginTop: 2 },
  guide: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md },
  guideTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700", marginBottom: spacing.xs },
  guideRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  guideNum: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  guideNumText: { color: colors.brand, fontWeight: "800", fontSize: 13 },
  guideText: { color: colors.muted, fontSize: 14, flex: 1 },
  section: { color: colors.onSurface, fontSize: 18, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.md },
  emptyHint: { color: colors.muted, fontSize: 14 },
  scriptRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  scriptIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  scriptTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  scriptMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  goRec: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
}));
