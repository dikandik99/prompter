import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/AuthProvider";
import { useI18n, type Lang } from "@/src/i18n";
import { useSettings } from "@/src/store/settings";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function SettingsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, isPro, logout } = useAuth();
  const { tele, cam, setTele, setCam } = useSettings();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg }}
      showsVerticalScrollIndicator={false}
      testID="settings-screen"
    >
      <Text style={styles.title}>{t("settings.title")}</Text>

      {/* Account */}
      <Pressable
        style={styles.accountCard}
        onPress={() => (user ? router.push("/account") : router.push("/auth"))}
        testID="settings-account"
      >
        <View style={styles.avatar}>
          <Ionicons name="person" size={26} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.accountName}>{user ? user.name || user.email : "Masuk / Daftar"}</Text>
          <Text style={styles.accountSub}>{user ? user.email : "Sinkronisasi & langganan"}</Text>
        </View>
        {isPro ? (
          <View style={styles.proTag}>
            <Text style={styles.proTagText}>PRO</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        )}
      </Pressable>

      {!isPro ? (
        <Pressable style={styles.upgrade} onPress={() => router.push("/paywall")} testID="settings-upgrade">
          <Ionicons name="sparkles" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.upgradeText}>{t("common.upgrade")}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      ) : null}

      {/* Teleprompter */}
      <Section title="TELEPROMPTER" />
      <View style={styles.group}>
        <Stepper label="Ukuran teks" value={tele.fontSize} suffix="px" step={2} min={16} max={60} onChange={(v) => setTele({ fontSize: v })} testID="set-fontsize" />
        <Divider />
        <Stepper label="Jarak baris" value={tele.lineSpacing} step={0.1} min={1} max={2.5} decimals={1} onChange={(v) => setTele({ lineSpacing: Math.round(v * 10) / 10 })} />
        <Divider />
        <Stepper label="Kecepatan scroll" value={tele.speed} suffix="px/s" step={5} min={10} max={160} onChange={(v) => setTele({ speed: v })} testID="set-speed" />
        <Divider />
        <Stepper label="Kata per menit" value={tele.wpm} step={5} min={80} max={220} onChange={(v) => setTele({ wpm: v })} />
        <Divider />
        <Segmented label="Warna teks" options={[{ k: "white", l: "Putih" }, { k: "orange", l: "Oranye" }]} value={tele.textColor} onChange={(v) => setTele({ textColor: v as any })} />
        <Divider />
        <Segmented label="Posisi" options={[{ k: "top", l: "Atas" }, { k: "center", l: "Tengah" }, { k: "bottom", l: "Bawah" }]} value={tele.position} onChange={(v) => setTele({ position: v as any })} />
        <Divider />
        <Segmented label="Hitung mundur" options={[{ k: "3", l: "3s" }, { k: "5", l: "5s" }, { k: "10", l: "10s" }]} value={String(tele.countdown)} onChange={(v) => setTele({ countdown: Number(v) as any })} />
        <Divider />
        <SwitchRow label="Teks cermin (mirror)" value={tele.mirror} onChange={(v) => setTele({ mirror: v })} />
      </View>

      {/* Recording */}
      <Section title="PEREKAMAN" />
      <View style={styles.group}>
        <Segmented label="Kamera" options={[{ k: "front", l: "Depan" }, { k: "back", l: "Belakang" }]} value={cam.facing} onChange={(v) => setCam({ facing: v as any })} />
        <Divider />
        <Segmented label="Rasio" options={[{ k: "9:16", l: "9:16" }, { k: "1:1", l: "1:1" }, { k: "16:9", l: "16:9" }]} value={cam.ratio} onChange={(v) => setCam({ ratio: v as any })} />
        <Divider />
        <Segmented label="Resolusi" options={[{ k: "720p", l: "720p" }, { k: "1080p", l: "1080p" }, { k: "4k", l: "4K" }]} value={cam.resolution} onChange={(v) => setCam({ resolution: v as any })} />
        <Divider />
        <SwitchRow label="Pratinjau cermin" value={cam.mirrorPreview} onChange={(v) => setCam({ mirrorPreview: v })} />
        <Divider />
        <SwitchRow label="Simpan video cermin" value={cam.saveMirrored} onChange={(v) => setCam({ saveMirrored: v })} />
      </View>

      {/* Language */}
      <Section title="BAHASA" />
      <View style={styles.group}>
        <Segmented
          label="Bahasa aplikasi"
          options={[{ k: "id", l: "Indonesia" }, { k: "en", l: "English" }]}
          value={lang}
          onChange={(v) => setLang(v as Lang)}
        />
      </View>

      {/* Support */}
      <Section title="DUKUNGAN" />
      <View style={styles.group}>
        <LinkRow icon="help-circle-outline" label="Pusat Bantuan" onPress={() => toast.show("Segera hadir", "info")} />
        <Divider />
        <LinkRow icon="chatbubble-ellipses-outline" label="Hubungi Dukungan" onPress={() => Linking.openURL("mailto:support@promptera.app")} />
        <Divider />
        <LinkRow icon="document-text-outline" label={t("paywall.terms")} onPress={() => router.push("/legal?doc=terms")} />
        <Divider />
        <LinkRow icon="shield-checkmark-outline" label={t("paywall.privacy")} onPress={() => router.push("/legal?doc=privacy")} />
      </View>

      {user ? (
        <Pressable style={styles.logout} onPress={() => { logout(); toast.show("Keluar berhasil", "success"); }} testID="settings-logout">
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Keluar</Text>
        </Pressable>
      ) : null}

      <Text style={styles.about}>PROMPTERA v1.0.0</Text>
      <Text style={styles.aboutOwner}>PT Samudera Kreatif Indonesia</Text>
    </ScrollView>
  );
}

function Section({ title }: { title: string }) {
  const styles = useStyles();
  return <Text style={styles.sectionLabel}>{title}</Text>;
}
function Divider() {
  const styles = useStyles();
  return <View style={styles.rowDivider} />;
}

function Stepper({
  label, value, onChange, step = 1, min = 0, max = 999, suffix = "", decimals = 0, testID,
}: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; decimals?: number; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - step))} testID={testID ? `${testID}-minus` : undefined}>
          <Ionicons name="remove" size={18} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.stepVal}>{value.toFixed(decimals)}{suffix}</Text>
        <Pressable style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + step))} testID={testID ? `${testID}-plus` : undefined}>
          <Ionicons name="add" size={18} color={colors.onSurface} />
        </Pressable>
      </View>
    </View>
  );
}

function Segmented({ label, options, value, onChange }: { label: string; options: { k: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.segment}>
        {options.map((o) => (
          <Pressable key={o.k} onPress={() => onChange(o.k)} style={[styles.segItem, value === o.k && styles.segItemActive]}>
            <Text style={[styles.segText, value === o.k && styles.segTextActive]}>{o.l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brand, false: colors.borderStrong }} thumbColor="#FFFFFF" />
    </View>
  );
}

function LinkRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Ionicons name={icon as any} size={20} color={colors.muted} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.onSurface, fontSize: 30, fontWeight: "800", marginBottom: spacing.lg },
  accountCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  avatar: { width: 50, height: 50, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  accountName: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  accountSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  proTag: { backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.sm },
  proTagText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 12 },
  upgrade: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  upgradeText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15, flex: 1 },
  sectionLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.xs },
  group: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 52 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.lg },
  rowLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "500", flexShrink: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 3 },
  stepBtn: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  stepVal: { color: colors.onSurface, fontSize: 14, fontWeight: "700", minWidth: 56, textAlign: "center" },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 3 },
  segItem: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  segItemActive: { backgroundColor: colors.brand },
  segText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  segTextActive: { color: colors.onBrandPrimary },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl, padding: spacing.md },
  logoutText: { color: colors.error, fontWeight: "700", fontSize: 15 },
  about: { color: colors.muted, textAlign: "center", marginTop: spacing.xl, fontSize: 13, fontWeight: "600" },
  aboutOwner: { color: colors.muted, textAlign: "center", marginTop: 2, fontSize: 12, opacity: 0.7 },
}));
