import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { ActionSheet, SheetAction } from "@/src/components/Sheet";
import { Button, Chip } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/auth/AuthProvider";
import { apiFetch } from "@/src/lib/api";
import { useLibrary } from "@/src/store/library";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Lang = { code: string; name: string };
type Mode = { id: string; label: string };

export default function Translate() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getScript, updateScript, createScript } = useLibrary();
  const { user } = useAuth();

  const script = id && id !== "new" ? getScript(id) : undefined;
  const [source, setSource] = useState(script?.content ?? "");
  const [result, setResult] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");
  const [mode, setMode] = useState("natural");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<null | "source" | "target">(null);

  const { data } = useQuery<{ languages: Lang[]; modes: Mode[] }>({
    queryKey: ["ai-langs"],
    queryFn: () => apiFetch("/ai/languages"),
  });
  const langs = data?.languages ?? [];
  const modes = data?.modes ?? [];
  const langName = (c: string) => (c === "auto" ? "Deteksi otomatis" : langs.find((l) => l.code === c)?.name ?? c);

  async function translate() {
    if (!user) {
      toast.show("Masuk untuk menggunakan AI", "info");
      router.push("/auth");
      return;
    }
    if (!source.trim()) return toast.show("Masukkan teks dulu", "info");
    setBusy(true);
    try {
      const res = await apiFetch<{ translation: string }>("/ai/translate", {
        method: "POST",
        auth: true,
        body: { text: source, source_lang: sourceLang, target_lang: langName(targetLang), mode },
      });
      setResult(res.translation);
    } catch (e: any) {
      if (e.status === 503) toast.show("Terjemahan belum dikonfigurasi (perlu kunci DeepSeek).", "info");
      else toast.show(e.message || "Terjemahan gagal", "error");
    } finally {
      setBusy(false);
    }
  }

  const pickerActions: SheetAction[] = [
    ...(picker === "source" ? [{ code: "auto", name: "Deteksi otomatis" }] : []),
    ...langs,
  ].map((l: any) => ({
    label: l.name,
    icon: "globe-outline",
    onPress: () => (picker === "source" ? setSourceLang(l.code) : setTargetLang(l.code)),
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="translate-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="translate-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Terjemahkan</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.langRow}>
          <Pressable style={styles.langBox} onPress={() => setPicker("source")} testID="translate-source">
            <Text style={styles.langLabel}>Dari</Text>
            <Text style={styles.langValue} numberOfLines={1}>{langName(sourceLang)}</Text>
          </Pressable>
          <Ionicons name="arrow-forward" size={20} color={colors.brand} />
          <Pressable style={styles.langBox} onPress={() => setPicker("target")} testID="translate-target">
            <Text style={styles.langLabel}>Ke</Text>
            <Text style={styles.langValue} numberOfLines={1}>{langName(targetLang)}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Gaya</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
          {modes.map((m) => (
            <Chip key={m.id} label={m.label} active={mode === m.id} onPress={() => setMode(m.id)} testID={`mode-${m.id}`} />
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Teks asli</Text>
        <TextInput
          testID="translate-input"
          style={styles.input}
          value={source}
          onChangeText={setSource}
          placeholder="Tempel atau ketik teks…"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
        />

        <Button label={busy ? "Menerjemahkan…" : "Terjemahkan Skrip"} icon="language" loading={busy} onPress={translate} testID="translate-run" style={{ marginTop: spacing.lg }} />

        {result ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Hasil ({langName(targetLang)})</Text>
            </View>
            <Text style={styles.resultText}>{result}</Text>
            <View style={styles.resultActions}>
              <Button
                label="Ganti asli"
                variant="secondary"
                size="md"
                onPress={() => { if (script) { updateScript(script.id, { content: result, language: targetLang }); toast.show("Skrip diperbarui", "success"); router.back(); } else { setSource(result); setResult(""); } }}
                testID="translate-replace"
                style={{ flex: 1 }}
              />
              <Button
                label="Simpan baru"
                size="md"
                onPress={() => { const s = createScript({ title: `${script?.title || "Terjemahan"} (${targetLang})`, content: result, language: targetLang, folderId: script?.folderId ?? null }); toast.show("Disimpan sebagai skrip baru", "success"); router.replace(`/editor/${s.id}`); }}
                testID="translate-savenew"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <ActionSheet visible={!!picker} onClose={() => setPicker(null)} title="Pilih bahasa" actions={pickerActions} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  langRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  langBox: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  langLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  langValue: { color: colors.onSurface, fontSize: 15, fontWeight: "700", marginTop: 2 },
  sectionLabel: { color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  modeRow: { gap: spacing.sm, paddingRight: spacing.lg },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 16, minHeight: 140, lineHeight: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  resultCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.brand, gap: spacing.md },
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultTitle: { color: colors.brand, fontSize: 14, fontWeight: "700" },
  resultText: { color: colors.onSurface, fontSize: 16, lineHeight: 24 },
  resultActions: { flexDirection: "row", gap: spacing.md },
}));
