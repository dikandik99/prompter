import { Camera } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Button } from "@/src/components/ui";
import { useI18n } from "@/src/i18n";
import { requestMediaPermission } from "@/src/lib/media";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { ONBOARDED_KEY } from "./index";

const SLIDES = [
  { icon: "sparkles", key: 1 },
  { icon: "eye", key: 2 },
  { icon: "videocam", key: 3 },
  { icon: "rocket", key: 4 },
] as const;

export default function Onboarding() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [perms, setPerms] = useState<{ camera?: boolean; mic?: boolean; media?: boolean }>({});

  const isPermStep = step === SLIDES.length;

  async function requestCamera() {
    try {
      const cam = await Camera.requestCameraPermissionsAsync();
      const mic = await Camera.requestMicrophonePermissionsAsync();
      setPerms((p) => ({ ...p, camera: cam.granted, mic: mic.granted }));
    } catch {
      setPerms((p) => ({ ...p, camera: false, mic: false }));
    }
  }
  async function requestMedia() {
    const granted = await requestMediaPermission();
    setPerms((p) => ({ ...p, media: granted }));
  }

  async function finish() {
    await storage.setItem(ONBOARDED_KEY, true);
    router.replace("/(tabs)");
  }

  if (isPermStep) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
        <Animated.View entering={FadeIn} style={styles.permHeader}>
          <Text style={styles.title}>Izinkan akses</Text>
          <Text style={styles.permSub}>
            PROMPTERA perlu akses berikut untuk merekam. Anda selalu bisa mengubahnya di Pengaturan.
          </Text>
        </Animated.View>

        <View style={styles.permList}>
          <PermCard
            icon="camera"
            title="Kamera"
            desc="Rekam video dengan teleprompter"
            granted={perms.camera}
            onPress={requestCamera}
          />
          <PermCard
            icon="mic"
            title="Mikrofon"
            desc="Rekam audio bersama video Anda"
            granted={perms.mic}
            onPress={requestCamera}
          />
          <PermCard
            icon="images"
            title="Galeri / Media"
            desc="Simpan rekaman ke galeri perangkat"
            granted={perms.media}
            onPress={requestMedia}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Button label={t("common.continue")} onPress={finish} testID="onboarding-finish" />
          <Pressable onPress={finish} style={styles.skip}>
            <Text style={styles.skipText}>{t("common.skip")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const slide = SLIDES[step];
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>PROMPTERA</Text>
        <Pressable onPress={() => setStep(SLIDES.length)} hitSlop={10}>
          <Text style={styles.skipText}>{t("common.skip")}</Text>
        </Pressable>
      </View>

      <Animated.View key={step} entering={FadeInRight.springify().damping(18)} style={styles.hero}>
        <LinearGradient colors={[colors.brand, colors.brandSecondary]} style={styles.heroCircle}>
          <Ionicons name={slide.icon as any} size={72} color={colors.onBrandPrimary} />
        </LinearGradient>
        <Text style={styles.title}>{t(`onboard.${slide.key}.title`)}</Text>
        <Text style={styles.desc}>{t(`onboard.${slide.key}.desc`)}</Text>
      </Animated.View>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <Button
          label={step === SLIDES.length - 1 ? t("common.getStarted") : t("common.next")}
          onPress={() => setStep((s) => s + 1)}
          testID="onboarding-next"
        />
      </View>
    </View>
  );
}

function PermCard({
  icon,
  title,
  desc,
  granted,
  onPress,
}: {
  icon: string;
  title: string;
  desc: string;
  granted?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={styles.permCard} onPress={onPress} disabled={granted}>
      <View style={styles.permIcon}>
        <Ionicons name={icon as any} size={24} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.permTitle}>{title}</Text>
        <Text style={styles.permDesc}>{desc}</Text>
      </View>
      {granted ? (
        <Ionicons name="checkmark-circle" size={26} color={colors.success} />
      ) : Platform.OS === "web" ? (
        <Ionicons name="chevron-forward" size={22} color={colors.muted} />
      ) : (
        <View style={styles.allow}>
          <Text style={styles.allowText}>Izinkan</Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, justifyContent: "space-between" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  brand: { color: colors.brand, fontWeight: "900", letterSpacing: 2, fontSize: 15 },
  hero: { alignItems: "center", paddingHorizontal: spacing.xl, flex: 1, justifyContent: "center" },
  heroCircle: {
    width: 150,
    height: 150,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxl,
  },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: spacing.md, lineHeight: 34 },
  desc: { color: colors.muted, fontSize: 16, textAlign: "center", lineHeight: 24 },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceTertiary },
  dotActive: { backgroundColor: colors.brand, width: 22 },
  permHeader: { paddingHorizontal: spacing.lg },
  permSub: { color: colors.muted, fontSize: 15, marginTop: spacing.sm, lineHeight: 22 },
  permList: { gap: spacing.md, paddingHorizontal: spacing.lg, flex: 1, justifyContent: "center" },
  permCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  permIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  permTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  permDesc: { color: colors.muted, fontSize: 13, marginTop: 2 },
  allow: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  allowText: { color: colors.brand, fontWeight: "700", fontSize: 13 },
  skip: { alignItems: "center", paddingVertical: spacing.md },
  skipText: { color: colors.muted, fontSize: 15, fontWeight: "600" },
}));
