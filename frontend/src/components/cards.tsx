import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@react-native-vector-icons/ionicons";

import type { Recording, Script } from "@/src/store/library";
import { formatClock, formatDuration } from "@/src/lib/text";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function ScriptCard({
  script,
  folderName,
  onPress,
  onMenu,
  onFavorite,
  testID,
}: {
  script: Script;
  folderName?: string;
  onPress: () => void;
  onMenu: () => void;
  onFavorite: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const preview = script.content.replace(/\n+/g, " ").trim() || "—";
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardTop}>
        <Text style={styles.title} numberOfLines={1}>
          {script.title || "Untitled"}
        </Text>
        <Pressable onPress={onFavorite} hitSlop={8} testID={testID ? `${testID}-fav` : undefined}>
          <Ionicons
            name={script.isFavorite ? "star" : "star-outline"}
            size={20}
            color={script.isFavorite ? colors.brand : colors.muted}
          />
        </Pressable>
      </View>
      <Text style={styles.preview} numberOfLines={2}>
        {preview}
      </Text>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="text" size={13} color={colors.muted} />
          <Text style={styles.metaText}>{script.wordCount} kata</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Text style={styles.metaText}>{formatDuration(script.estimatedDuration)}</Text>
        </View>
        {folderName ? (
          <View style={styles.folderTag}>
            <Text style={styles.folderText} numberOfLines={1}>
              {folderName}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onMenu} hitSlop={8} testID={testID ? `${testID}-menu` : undefined}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export function RecordingCard({
  rec,
  onPress,
  onMenu,
  grid,
  testID,
}: {
  rec: Recording;
  onPress: () => void;
  onMenu: () => void;
  grid?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [grid ? styles.gridCard : styles.listCard, pressed && styles.pressed]}>
      <View style={[styles.thumb, grid ? styles.thumbGrid : styles.thumbList]}>
        {rec.thumbnailUri ? (
          <Image source={{ uri: rec.thumbnailUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Ionicons name="play" size={grid ? 30 : 22} color={colors.onSurface} />
        )}
        <View style={styles.durBadge}>
          <Text style={styles.durText}>{formatClock(rec.durationMs)}</Text>
        </View>
        {rec.isFavorite ? (
          <View style={styles.favBadge}>
            <Ionicons name="star" size={12} color={colors.brand} />
          </View>
        ) : null}
      </View>
      <View style={grid ? styles.gridInfo : styles.listInfo}>
        <Text style={styles.recTitle} numberOfLines={1}>
          {rec.scriptTitle}
        </Text>
        <Text style={styles.recMeta} numberOfLines={1}>
          {rec.orientation} · {new Date(rec.createdAt).toLocaleDateString()}
        </Text>
      </View>
      {!grid ? (
        <Pressable onPress={onMenu} hitSlop={8} testID={testID ? `${testID}-menu` : undefined} style={styles.listMenu}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "700", flex: 1 },
  preview: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  folderTag: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm, maxWidth: 110 },
  folderText: { color: colors.brand, fontSize: 11, fontWeight: "700" },

  listCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  gridCard: { flex: 1, gap: spacing.sm },
  thumb: { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbList: { width: 64, height: 88, borderRadius: radius.md },
  thumbGrid: { width: "100%", aspectRatio: 9 / 16, borderRadius: radius.md },
  durBadge: { position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  durText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  favBadge: { position: "absolute", top: 4, left: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: radius.pill, padding: 3 },
  listInfo: { flex: 1 },
  gridInfo: {},
  recTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  recMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  listMenu: { padding: spacing.sm },
}));
