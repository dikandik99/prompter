import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { ActionSheet, SheetAction } from "@/src/components/Sheet";
import { Button } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { formatClock } from "@/src/lib/text";
import { requestMediaPermission, saveToGallery as saveToGalleryNative } from "@/src/lib/media";
import { useLibrary } from "@/src/store/library";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Preview() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { recordingId } = useLocalSearchParams<{ recordingId: string }>();
  const { recordings, deleteRecording, updateRecording } = useLibrary();
  const rec = recordings.find((r) => r.id === recordingId);

  const player = useVideoPlayer(rec?.uri ?? null, (p) => { p.loop = false; });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(rec?.scriptTitle ?? "");

  if (!rec) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.meta}>Rekaman tidak ditemukan</Text>
        <Button label="Kembali" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  async function saveToGallery() {
    try {
      const granted = await requestMediaPermission();
      if (!granted) return toast.show("Izin galeri diperlukan", "error");
      await saveToGalleryNative(rec!.uri);
      toast.show("Tersimpan ke galeri", "success");
    } catch {
      toast.show("Gagal menyimpan. Periksa penyimpanan.", "error");
    }
  }
  async function share() {
    try {
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(rec!.uri);
      else toast.show("Berbagi tidak tersedia", "error");
    } catch {
      toast.show("Gagal berbagi", "error");
    }
  }

  const menuActions: SheetAction[] = [
    { label: "Ganti nama", icon: "create-outline", onPress: () => { setName(rec.scriptTitle); setRenaming(true); } },
    { label: "Bagikan", icon: "share-outline", onPress: share },
    { label: "Hapus", icon: "trash", destructive: true, onPress: () => { deleteRecording(rec.id); router.back(); } },
  ];

  return (
    <View style={styles.container} testID="preview-screen">
      <View style={styles.videoArea}>
        {Platform.OS === "web" || !rec.uri ? (
          <View style={styles.center}>
            <Ionicons name="film-outline" size={48} color={colors.muted} />
            <Text style={styles.meta}>Pemutaran video tersedia di perangkat</Text>
          </View>
        ) : (
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />
        )}

        <Pressable style={[styles.closeBtn, { top: insets.top + spacing.sm }]} onPress={() => router.replace("/(tabs)/library")} testID="preview-close">
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <Pressable style={[styles.menuBtn, { top: insets.top + spacing.sm }]} onPress={() => setMenuOpen(true)} testID="preview-menu">
          <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
        </Pressable>

        {Platform.OS !== "web" && rec.uri ? (
          <Pressable style={styles.playOverlay} onPress={() => (isPlaying ? player.pause() : player.play())}>
            {!isPlaying ? (
              <View style={styles.playCircle}>
                <Ionicons name="play" size={32} color="#000000" />
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.title}>{rec.scriptTitle}</Text>
        <View style={styles.metaRow}>
          <Meta icon="time-outline" text={formatClock(rec.durationMs)} />
          <Meta icon="expand-outline" text={rec.resolution} />
          <Meta icon="calendar-outline" text={new Date(rec.createdAt).toLocaleDateString()} />
        </View>

        <View style={styles.actions}>
          <Button label="Simpan ke Galeri" icon="download" onPress={saveToGallery} testID="preview-save" style={{ flex: 1 }} />
          <Button label="Bagikan" icon="share-social" variant="secondary" onPress={share} testID="preview-share" style={{ flex: 1 }} />
        </View>
        <View style={styles.actions}>
          <Button label="Rekam ulang" icon="videocam" variant="ghost" onPress={() => router.replace(rec.scriptId ? `/camera?scriptId=${rec.scriptId}` : "/camera")} testID="preview-retake" style={{ flex: 1 }} />
          {rec.scriptId ? (
            <Button label="Edit Skrip" icon="create" variant="ghost" onPress={() => router.replace(`/editor/${rec.scriptId}`)} style={{ flex: 1 }} />
          ) : null}
        </View>
      </View>

      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={rec.scriptTitle} actions={menuActions} />

      {renaming ? (
        <View style={styles.renameBackdrop}>
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>Ganti nama</Text>
            <TextInput style={styles.renameInput} value={name} onChangeText={setName} autoFocus placeholderTextColor={colors.muted} />
            <View style={styles.actions}>
              <Button label="Batal" variant="secondary" onPress={() => setRenaming(false)} style={{ flex: 1 }} />
              <Button label="Simpan" onPress={() => { updateRecording(rec.id, { scriptTitle: name || rec.scriptTitle }); setRenaming(false); toast.show("Diperbarui", "success"); }} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.meta2}>
      <Ionicons name={icon as any} size={15} color={colors.muted} />
      <Text style={styles.meta}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: "#000000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  videoArea: { flex: 1, backgroundColor: "#000000" },
  closeBtn: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  menuBtn: { position: "absolute", right: spacing.lg, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  playCircle: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  panel: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  metaRow: { flexDirection: "row", gap: spacing.lg },
  meta2: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  actions: { flexDirection: "row", gap: spacing.md },
  renameBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  renameCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, width: "100%", gap: spacing.md },
  renameTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  renameInput: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 16 },
}));
