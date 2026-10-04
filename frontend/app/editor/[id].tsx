import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Ionicons from "@react-native-vector-icons/ionicons";

import { ActionSheet, SheetAction } from "@/src/components/Sheet";
import { Chip } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useI18n } from "@/src/i18n";
import { countChars, countWords, estimateSeconds, formatDuration } from "@/src/lib/text";
import { useLibrary } from "@/src/store/library";
import { useSettings } from "@/src/store/settings";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const SPEEDS = [
  { k: "slow", wpm: 100 },
  { k: "normal", wpm: 130 },
  { k: "fast", wpm: 160 },
];

export default function Editor() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getScript, createScript, updateScript } = useLibrary();
  const { tele } = useSettings();

  const existing = id && id !== "new" ? getScript(id) : undefined;
  const currentId = useRef<string | null>(existing?.id ?? null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [speed, setSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [importOpen, setImportOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wpm = SPEEDS.find((s) => s.k === speed)!.wpm;
  const words = countWords(content);
  const chars = countChars(content);
  const duration = estimateSeconds(words, wpm);

  // Debounced autosave to local storage.
  useEffect(() => {
    if (!title && !content) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!currentId.current) {
        const created = createScript({ title, content });
        currentId.current = created.id;
      } else {
        updateScript(currentId.current, { title, content });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  function ensureSaved(): string | null {
    if (currentId.current) {
      updateScript(currentId.current, { title, content });
      return currentId.current;
    }
    if (title || content) {
      const created = createScript({ title, content });
      currentId.current = created.id;
      return created.id;
    }
    return null;
  }

  async function importFromClipboard() {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setContent((c) => (c ? `${c}\n${text}` : text));
      toast.show("Teks ditempel", "success");
    } else toast.show("Clipboard kosong", "info");
  }

  async function importFromFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["text/plain", "text/*"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const name = asset.name?.toLowerCase() ?? "";
      if (!name.endsWith(".txt")) {
        toast.show("DOCX/PDF akan hadir. Gunakan .txt untuk saat ini.", "info");
        return;
      }
      const text = await FileSystem.readAsStringAsync(asset.uri);
      setContent((c) => (c ? `${c}\n${text}` : text));
      if (!title) setTitle(name.replace(/\.txt$/, ""));
      toast.show("File diimpor", "success");
    } catch {
      toast.show("Gagal mengimpor file", "error");
    }
  }

  const importActions: SheetAction[] = [
    { label: "Dari Clipboard", icon: "clipboard-outline", onPress: importFromClipboard },
    { label: "Dari File (.txt)", icon: "document-outline", onPress: importFromFile },
  ];

  const toolbar = useMemo(
    () => [
      { icon: "language", label: t("editor.translate"), onPress: () => { const sid = ensureSaved(); router.push(sid ? `/translate/${sid}` : "/translate/new"); } },
      { icon: "tv", label: t("editor.teleprompter"), onPress: () => { const sid = ensureSaved(); if (sid) router.push(`/teleprompter?scriptId=${sid}`); else toast.show("Tulis skrip dulu", "info"); } },
      { icon: "cloud-download", label: t("editor.import"), onPress: () => setImportOpen(true) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, content],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="editor-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="editor-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.savedWrap}>
          {saved ? (
            <>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.savedText}>{t("editor.saved")}</Text>
            </>
          ) : null}
        </View>
        <Pressable
          style={styles.recBtn}
          onPress={() => { const sid = ensureSaved(); router.push(sid ? `/camera?scriptId=${sid}` : "/camera"); }}
          testID="editor-record"
        >
          <Ionicons name="videocam" size={16} color={colors.onBrandPrimary} />
          <Text style={styles.recText}>{t("editor.record")}</Text>
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        bottomOffset={80}
      >
        <TextInput
          testID="editor-title"
          style={styles.titleInput}
          placeholder={t("editor.title")}
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.statsRow}>
          <Stat label={t("editor.words")} value={String(words)} />
          <Stat label={t("editor.chars")} value={String(chars)} />
          <Stat label={t("editor.duration")} value={formatDuration(duration)} highlight />
        </View>

        <View style={styles.speedRow}>
          <Text style={styles.speedLabel}>{t("editor.speed")}</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {SPEEDS.map((s) => (
              <Chip key={s.k} label={t(`editor.${s.k}`)} active={speed === s.k} onPress={() => setSpeed(s.k as any)} testID={`speed-${s.k}`} />
            ))}
          </View>
        </View>

        <TextInput
          testID="editor-content"
          style={styles.contentInput}
          placeholder={t("editor.placeholder")}
          placeholderTextColor={colors.muted}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View style={[styles.toolbar, { paddingBottom: insets.bottom + spacing.sm }]}>
          {toolbar.map((item) => (
            <Pressable key={item.label} style={styles.toolBtn} onPress={item.onPress} testID={`toolbar-${item.icon}`}>
              <Ionicons name={item.icon as any} size={20} color={colors.brand} />
              <Text style={styles.toolText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </KeyboardStickyView>

      <ActionSheet visible={importOpen} onClose={() => setImportOpen(false)} title={t("editor.import")} actions={importActions} />
    </View>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, highlight && styles.statHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
  savedWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  savedText: { color: colors.success, fontSize: 13, fontWeight: "600" },
  recBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill },
  recText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 14 },
  titleInput: { color: colors.onSurface, fontSize: 24, fontWeight: "800", paddingVertical: spacing.sm },
  statsRow: { flexDirection: "row", gap: spacing.md, marginVertical: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statValue: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  statHighlight: { color: colors.brand },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  speedRow: { marginBottom: spacing.md, gap: spacing.sm },
  speedLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  contentInput: { color: colors.onSurface, fontSize: 17, lineHeight: 26, minHeight: 320, fontWeight: "500" },
  toolbar: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md, paddingHorizontal: spacing.lg, justifyContent: "space-around" },
  toolBtn: { alignItems: "center", gap: 4, flex: 1 },
  toolText: { color: colors.brand, fontSize: 12, fontWeight: "700" },
}));
