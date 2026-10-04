import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { ActionSheet, SheetAction } from "@/src/components/Sheet";
import { Button } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/AuthProvider";
import { useI18n } from "@/src/i18n";
import { apiFetch } from "@/src/lib/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Plan = { id: string; interval: string; price_display: string; best_value: boolean; savings_pct?: number; monthly_equivalent?: string };
type Pricing = { currency: string; providers: string[]; features: { icon: string; key: string }[]; plans: Plan[] };

const PROVIDER_META: Record<string, { label: string; icon: string }> = {
  midtrans: { label: "Midtrans", icon: "card-outline" },
  dana: { label: "DANA", icon: "wallet-outline" },
  paypal: { label: "PayPal", icon: "logo-paypal" },
  appstore: { label: "App Store", icon: "logo-apple" },
  playstore: { label: "Google Play", icon: "logo-google-playstore" },
};

export default function Paywall() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, isPro, refresh, setEntitlement } = useAuth();

  const [selected, setSelected] = useState("pro_yearly");
  const [providerOpen, setProviderOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery<Pricing>({
    queryKey: ["pricing", "ID"],
    queryFn: () => apiFetch<Pricing>("/pricing?country=ID"),
  });

  async function startCheckout(provider: string) {
    if (!user) {
      router.push("/auth");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ message: string }>("/subscription/checkout", {
        method: "POST",
        auth: true,
        body: { plan_id: selected, provider, country: "ID" },
      });
      toast.show(res.message, "info");
    } catch (e: any) {
      toast.show(e.message || "Checkout gagal", "error");
    } finally {
      setBusy(false);
    }
  }

  async function demoActivate() {
    if (!user) return router.push("/auth");
    setBusy(true);
    try {
      const ent = await apiFetch<any>("/subscription/dev-activate", {
        method: "POST",
        auth: true,
        body: { plan_id: selected, provider: "midtrans", country: "ID" },
      });
      setEntitlement(ent);
      await refresh();
      toast.show("PRO aktif (demo)", "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message || "Gagal", "error");
    } finally {
      setBusy(false);
    }
  }

  const providerActions: SheetAction[] = (data?.providers ?? []).map((p) => ({
    label: PROVIDER_META[p]?.label ?? p,
    icon: PROVIDER_META[p]?.icon ?? "card-outline",
    onPress: () => startCheckout(p),
  }));

  return (
    <View style={styles.container} testID="paywall-screen">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 180, paddingHorizontal: spacing.lg }} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} testID="paywall-close">
            <Ionicons name="close" size={28} color={colors.onSurface} />
          </Pressable>
        </View>

        <LinearGradient colors={[colors.brand, colors.brandSecondary]} style={styles.badge}>
          <Ionicons name="sparkles" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.badgeText}>PROMPTERA PRO</Text>
        </LinearGradient>

        <Text style={styles.headline}>{t("paywall.headline")}</Text>
        <Text style={styles.sub}>{t("paywall.sub")}</Text>

        <View style={styles.features}>
          {(data?.features ?? []).map((f) => (
            <View key={f.key} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={16} color={colors.brand} />
              </View>
              <Text style={styles.featureText}>{t(`feat.${f.key}`)}</Text>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            </View>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.xl }} />
        ) : (
          <View style={styles.plans}>
            {(data?.plans ?? []).map((p) => {
              const active = selected === p.id;
              return (
                <Pressable key={p.id} onPress={() => setSelected(p.id)} style={[styles.planCard, active && styles.planActive]} testID={`plan-${p.id}`}>
                  {p.best_value ? (
                    <View style={styles.bestTag}>
                      <Text style={styles.bestText}>{t("paywall.bestValue")}</Text>
                    </View>
                  ) : null}
                  <View style={styles.planRow}>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{p.interval === "year" ? t("paywall.yearly") : t("paywall.monthly")}</Text>
                      {p.monthly_equivalent ? (
                        <Text style={styles.planEquiv}>≈ {p.monthly_equivalent}/bln · hemat {p.savings_pct}%</Text>
                      ) : null}
                    </View>
                    <Text style={styles.planPrice}>{p.price_display}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {isPro ? (
          <View style={styles.proActive}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.proActiveText}>Anda sudah PRO</Text>
          </View>
        ) : (
          <>
            <Button label={busy ? "Memproses…" : "Berlangganan Sekarang"} loading={busy} onPress={() => (user ? setProviderOpen(true) : router.push("/auth"))} testID="paywall-subscribe" />
            <Pressable onPress={demoActivate} style={styles.demo} testID="paywall-demo-activate">
              <Text style={styles.demoText}>Simulasikan pembayaran (demo)</Text>
            </Pressable>
          </>
        )}
        <View style={styles.legalRow}>
          <Pressable onPress={async () => { try { await apiFetch("/subscription/restore", { method: "POST", auth: true }); await refresh(); toast.show("Pembelian dipulihkan", "success"); } catch { toast.show("Masuk untuk memulihkan", "info"); } }} testID="paywall-restore">
            <Text style={styles.legalText}>{t("paywall.restore")}</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => router.push("/legal?doc=terms")}>
            <Text style={styles.legalText}>{t("paywall.terms")}</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => router.push("/legal?doc=privacy")}>
            <Text style={styles.legalText}>{t("paywall.privacy")}</Text>
          </Pressable>
        </View>
      </View>

      <ActionSheet visible={providerOpen} onClose={() => setProviderOpen(false)} title="Pilih metode pembayaran" actions={providerActions} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  topRow: { marginBottom: spacing.md },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, marginBottom: spacing.lg },
  badgeText: { color: colors.onBrandPrimary, fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  headline: { color: colors.onSurface, fontSize: 30, fontWeight: "800", lineHeight: 36 },
  sub: { color: colors.muted, fontSize: 16, marginTop: spacing.sm, lineHeight: 22 },
  features: { marginTop: spacing.xl, gap: spacing.md },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  featureIcon: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  featureText: { color: colors.onSurface, fontSize: 15, fontWeight: "600", flex: 1 },
  plans: { marginTop: spacing.xl, gap: spacing.md },
  planCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 2, borderColor: colors.border },
  planActive: { borderColor: colors.brand },
  bestTag: { position: "absolute", top: -10, right: spacing.lg, backgroundColor: colors.brand, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  bestText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  planRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  radio: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.brand },
  radioDot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.brand },
  planName: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  planEquiv: { color: colors.muted, fontSize: 12, marginTop: 2 },
  planPrice: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  demo: { alignItems: "center", paddingVertical: spacing.xs },
  demoText: { color: colors.muted, fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
  proActive: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md },
  proActiveText: { color: colors.success, fontSize: 16, fontWeight: "700" },
  legalRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  legalText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  legalDot: { color: colors.muted },
}));
