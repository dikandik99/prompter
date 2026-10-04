import { useRouter } from "expo-router";

import { Screen } from "@/src/components/Screen";
import { Button } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/AuthProvider";
import { apiFetch } from "@/src/lib/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

export default function Account() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { user, isPro, logout, refresh, setEntitlement } = useAuth();

  if (!user) {
    router.replace("/auth");
    return null;
  }
  const ent = user.entitlement;

  async function cancelSub() {
    try {
      const res = await apiFetch<any>("/subscription/cancel", { method: "POST", auth: true });
      setEntitlement(res);
      await refresh();
      toast.show("Langganan dibatalkan", "success");
    } catch {
      toast.show("Gagal membatalkan", "error");
    }
  }

  return (
    <Screen title="Akun" showBack testID="account-screen">
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={34} color={colors.brand} />
        </View>
        <Text style={styles.name}>{user.name || "Kreator"}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Status langganan</Text>
          <View style={[styles.statusPill, isPro ? styles.statusPro : styles.statusFree]}>
            <Text style={[styles.statusText, isPro && { color: colors.onBrandPrimary }]}>{isPro ? "PRO" : "FREE"}</Text>
          </View>
        </View>
        {isPro && ent?.current_period_end ? (
          <>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Berlaku hingga</Text>
              <Text style={styles.value}>{new Date(ent.current_period_end).toLocaleDateString()}</Text>
            </View>
          </>
        ) : null}
        {ent?.provider ? (
          <>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Metode</Text>
              <Text style={styles.value}>{ent.provider}</Text>
            </View>
          </>
        ) : null}
      </View>

      {!isPro ? (
        <Button label="Upgrade ke Pro" icon="sparkles" onPress={() => router.push("/paywall")} style={{ marginTop: spacing.lg }} testID="account-upgrade" />
      ) : (
        <Button label="Batalkan langganan" variant="secondary" onPress={cancelSub} style={{ marginTop: spacing.lg }} testID="account-cancel" />
      )}

      <Pressable style={styles.logout} onPress={() => { logout(); router.back(); }} testID="account-logout">
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Keluar</Text>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { alignItems: "center", paddingVertical: spacing.xl },
  avatar: { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  email: { color: colors.muted, fontSize: 14, marginTop: 2 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  label: { color: colors.muted, fontSize: 15 },
  value: { color: colors.onSurface, fontSize: 15, fontWeight: "600" },
  statusPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.sm },
  statusPro: { backgroundColor: colors.brand },
  statusFree: { backgroundColor: colors.surfaceTertiary },
  statusText: { fontSize: 12, fontWeight: "800", color: colors.muted },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl, padding: spacing.md },
  logoutText: { color: colors.error, fontWeight: "700", fontSize: 15 },
}));
