import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { RecordingCard } from "@/src/components/cards";
import { ActionSheet, SheetAction } from "@/src/components/Sheet";
import { EmptyState, IconButton } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { useI18n } from "@/src/i18n";
import { generateThumbnail } from "@/src/lib/thumbnails";
import { useLibrary, type Recording } from "@/src/store/library";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function LibraryScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { recordings, deleteRecording, toggleFavoriteRecording, updateRecording } = useLibrary();

  const [grid, setGrid] = useState(true);
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [menuFor, setMenuFor] = useState<Recording | null>(null);

  // Backfill frame previews for clips recorded before thumbnails existed.
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    const missing = recordings.filter((r) => !r.thumbnailUri && r.uri && !attempted.current.has(r.id));
    if (!missing.length) return;
    (async () => {
      for (const r of missing) {
        attempted.current.add(r.id);
        const thumb = await generateThumbnail(r.uri);
        if (thumb) updateRecording(r.id, { thumbnailUri: thumb });
      }
    })();
  }, [recordings, updateRecording]);

  const filtered = useMemo(() => {
    let list = [...recordings];
    if (favOnly) list = list.filter((r) => r.isFavorite);
    if (query.trim()) list = list.filter((r) => r.scriptTitle.toLowerCase().includes(query.toLowerCase()));
    return list;
  }, [recordings, query, favOnly]);

  async function share(rec: Recording) {
    try {
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(rec.uri);
      else toast.show("Berbagi tidak tersedia di perangkat ini", "error");
    } catch {
      toast.show("Gagal berbagi", "error");
    }
  }

  const actions: SheetAction[] = menuFor
    ? [
        { label: "Pratinjau", icon: "play", onPress: () => router.push(`/preview?recordingId=${menuFor.id}`) },
        { label: menuFor.isFavorite ? "Hapus favorit" : "Favorit", icon: menuFor.isFavorite ? "star" : "star-outline", onPress: () => toggleFavoriteRecording(menuFor.id) },
        { label: "Bagikan", icon: "share-outline", onPress: () => share(menuFor) },
        { label: t("common.delete"), icon: "trash", destructive: true, onPress: () => { deleteRecording(menuFor.id); toast.show("Rekaman dihapus", "success"); } },
      ]
    : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="library-screen">
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t("library.title")}</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <IconButton icon="star" active={favOnly} onPress={() => setFavOnly((v) => !v)} testID="library-fav-toggle" />
          <IconButton icon={grid ? "list" : "grid"} onPress={() => setGrid((v) => !v)} testID="library-view-toggle" />
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          testID="library-search"
          style={styles.searchInput}
          placeholder={t("common.search")}
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        key={grid ? "grid" : "list"}
        data={filtered}
        keyExtractor={(r) => r.id}
        numColumns={grid ? 2 : 1}
        columnWrapperStyle={grid ? { gap: spacing.md } : undefined}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="videocam-outline"
            title={t("library.empty.title")}
            description={t("library.empty.desc")}
            ctaLabel={t("record.start")}
            onCta={() => router.push("/(tabs)/record")}
            testID="library-empty"
          />
        }
        renderItem={({ item }) => (
          <RecordingCard
            rec={item}
            grid={grid}
            onPress={() => router.push(`/preview?recordingId=${item.id}`)}
            onMenu={() => setMenuFor(item)}
            testID={`recording-card-${item.id}`}
          />
        )}
      />

      <ActionSheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.scriptTitle} actions={actions} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: 30, fontWeight: "800" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, height: 44, borderRadius: radius.md, marginBottom: spacing.md },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15 },
  listContent: { paddingHorizontal: spacing.lg, flexGrow: 1 },
}));
