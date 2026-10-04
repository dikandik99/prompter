import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Button } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/AuthProvider";
import { useI18n } from "@/src/i18n";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Auth() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || password.length < 6) {
      toast.show("Email valid & sandi min. 6 karakter", "error");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password, name.trim());
      toast.show(mode === "login" ? "Selamat datang!" : "Akun dibuat!", "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message || "Gagal", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container} testID="auth-screen">
      <KeyboardAwareScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }} showsVerticalScrollIndicator={false} bottomOffset={40}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close} testID="auth-close">
          <Ionicons name="close" size={28} color={colors.onSurface} />
        </Pressable>

        <LinearGradient colors={[colors.brand, colors.brandSecondary]} style={styles.logo}>
          <Ionicons name="videocam" size={34} color={colors.onBrandPrimary} />
        </LinearGradient>
        <Text style={styles.title}>{mode === "login" ? t("auth.login") : t("auth.register")}</Text>
        <Text style={styles.subtitle}>Sinkronisasi skrip, langganan & fitur AI</Text>

        <View style={styles.form}>
          {mode === "register" ? (
            <Field icon="person-outline" placeholder={t("auth.name")} value={name} onChangeText={setName} testID="auth-name" />
          ) : null}
          <Field icon="mail-outline" placeholder={t("auth.email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="auth-email" />
          <Field icon="lock-closed-outline" placeholder={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry testID="auth-password" />
        </View>

        <Button label={mode === "login" ? t("auth.login") : t("auth.register")} loading={busy} onPress={submit} testID="auth-submit" style={{ marginTop: spacing.lg }} />

        <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")} style={styles.switch} testID="auth-switch">
          <Text style={styles.switchText}>{mode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.guest} testID="auth-guest">
          <Text style={styles.guestText}>{t("auth.guest")}</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field(props: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { icon, ...rest } = props;
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <TextInput style={styles.input} placeholderTextColor={colors.muted} {...rest} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  close: { alignSelf: "flex-start", marginBottom: spacing.lg },
  logo: { width: 72, height: 72, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: spacing.xs, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  field: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 54 },
  input: { flex: 1, color: colors.onSurface, fontSize: 16 },
  switch: { alignItems: "center", paddingVertical: spacing.lg },
  switchText: { color: colors.brand, fontSize: 15, fontWeight: "700" },
  guest: { alignItems: "center", paddingVertical: spacing.sm },
  guestText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
}));
