import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { ScriptCard } from "@/src/components/cards";
import { ActionSheet, SheetAction } from "@/src/components/Sheet";
import { Chip, EmptyState } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useI18n } from "@/src/i18n";
import { useLibrary, type Script } from "@/src/store/library";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ScriptsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { scripts, folders, deleteScript, duplicateScript, toggleFavoriteScript } = useLibrary();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [menuFor, setMenuFor] = useState<Script | null>(null);

  const filtered = useMemo(() => {
    let list = [...scripts].sort((a, b) => b.updatedAt - a.updatedAt);
    if (filter === "fav") list = list.filter((s) => s.isFavorite);
    else if (filter !== "all") list = list.filter((s) => s.folderId === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q));
    }
    return list;
  }, [scripts, filter, query]);

  const folderName = (id: string | null) => folders.find((f) => f.id === id)?.name;

  const menuActions: SheetAction[] = menuFor
    ? [
        { label: t("editor.record"), icon: "videocam", onPress: () => router.push(`/camera?scriptId=${menuFor.id}`) },
        { label: t("editor.teleprompter"), icon: "tv", onPress: () => router.push(`/teleprompter?scriptId=${menuFor.id}`) },
        {
          label: "Duplikat",
          icon: "copy",
          onPress: () => {
            duplicateScript(menuFor.id);
            toast.show("Skrip diduplikat", "success");
          },
        },
        {
          label: t("common.delete"),
          icon: "trash",
          destructive: true,
          onPress: () => {
            deleteScript(menuFor.id);
            toast.show("Skrip dihapus", "success");
          },
        },
      ]
    : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="scripts-screen">
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("scripts.title")}</Text>
        <Pressable style={styles.createBtn} onPress={() => router.push("/editor/new")} testID="create-script-button">
          <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
          <Text style={styles.createText}>{t("scripts.new")}</Text>
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          testID="scripts-search"
          style={styles.searchInput}
          placeholder={t("common.search")}
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipContent}
        >
          <Chip label={t("scripts.all")} active={filter === "all"} onPress={() => setFilter("all")} testID="chip-all" />
          <Chip label={t("scripts.favorites")} active={filter === "fav"} onPress={() => setFilter("fav")} testID="chip-fav" />
          {folders.map((f) => (
            <Chip key={f.id} label={f.name} active={filter === f.id} onPress={() => setFilter(f.id)} testID={`chip-${f.id}`} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title={t("scripts.empty.title")}
            description={t("scripts.empty.desc")}
            ctaLabel={t("scripts.new")}
            onCta={() => router.push("/editor/new")}
            testID="scripts-empty"
          />
        }
        renderItem={({ item }) => (
          <ScriptCard
            script={item}
            folderName={folderName(item.folderId)}
            onPress={() => router.push(`/editor/${item.id}`)}
            onMenu={() => setMenuFor(item)}
            onFavorite={() => toggleFavoriteScript(item.id)}
            testID={`script-card-${item.id}`}
          />
        )}
      />

      <ActionSheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.title || "Skrip"}
        actions={menuActions}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: 30, fontWeight: "800" },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill },
  createText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 14 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15 },
  chipRow: { height: 56, justifyContent: "center" },
  chipContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, flexGrow: 1 },
}));
