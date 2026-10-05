import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Teleprompter, type TeleprompterHandle } from "@/src/components/Teleprompter";
import { Button } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { formatClock } from "@/src/lib/text";
import { generateThumbnail } from "@/src/lib/thumbnails";
import { useLibrary } from "@/src/store/library";
import { useSettings } from "@/src/store/settings";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function CameraScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { scriptId } = useLocalSearchParams<{ scriptId?: string }>();
  const { getScript, addRecording } = useLibrary();
  const { tele, cam, setCam } = useSettings();

  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const teleRef = useRef<TeleprompterHandle>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [facing, setFacing] = useState(cam.facing);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);

  const script = scriptId ? getScript(scriptId) : undefined;
  const content = script?.content ?? "";
  const isWeb = Platform.OS === "web";

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function ensurePerms(): Promise<boolean> {
    let c = camPerm?.granted;
    let m = micPerm?.granted;
    if (!c) c = (await requestCam()).granted;
    if (!m) m = (await requestMic()).granted;
    return !!(c && m);
  }

  async function beginCountdown() {
    if (isWeb) {
      toast.show("Perekaman kamera hanya tersedia di perangkat (iOS/Android).", "info");
      return;
    }
    const ok = await ensurePerms();
    if (!ok) {
      toast.show("Izin kamera & mikrofon diperlukan", "error");
      return;
    }
    // Always start a fresh take from the top of the script — without this,
    // a second take (or an earlier manual drag) would silently resume from
    // wherever the teleprompter was left, making it look "stuck"/wrong.
    teleRef.current?.restart();
    let n = tele.countdown;
    setCountdown(n);
    const iv = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(iv);
        setCountdown(null);
        startRecording();
      } else {
        setCountdown(n);
      }
    }, 1000);
  }

  async function startRecording() {
    setRecording(true);
    setPlaying(true);
    setControlsVisible(false);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    try {
      const video = await cameraRef.current?.recordAsync();
      if (video?.uri) {
        const thumbnailUri = await generateThumbnail(video.uri);
        const rec = addRecording({
          scriptId: scriptId ?? null,
          scriptTitle: script?.title || "Rekaman",
          uri: video.uri,
          thumbnailUri,
          durationMs: elapsedRef.current * 1000,
          resolution: cam.resolution,
          orientation: cam.ratio,
          mirrored: facing === "front" && cam.saveMirrored,
        });
        router.replace(`/preview?recordingId=${rec.id}`);
      }
    } catch {
      toast.show("Gagal merekam", "error");
      cleanupRecording();
    }
  }

  const elapsedRef = useRef(0);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  function cleanupRecording() {
    setRecording(false);
    setPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function stopRecording() {
    cameraRef.current?.stopRecording();
    cleanupRecording();
  }

  // Permission gate (native)
  if (!isWeb && (!camPerm?.granted || !micPerm?.granted)) {
    const blocked = camPerm && !camPerm.granted && !camPerm.canAskAgain;
    return (
      <View style={[styles.permGate, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        <Pressable onPress={() => router.back()} style={styles.gateClose} testID="camera-close">
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.gateCenter}>
          <View style={styles.gateIcon}>
            <Ionicons name="camera" size={40} color={colors.brand} />
          </View>
          <Text style={styles.gateTitle}>Akses kamera & mikrofon</Text>
          <Text style={styles.gateDesc}>
            PROMPTERA memerlukan akses kamera dan mikrofon untuk merekam video dengan teleprompter.
          </Text>
          {blocked ? (
            <Button label="Buka Pengaturan" icon="settings" onPress={() => Linking.openSettings()} testID="camera-open-settings" />
          ) : (
            <Button label="Izinkan Akses" icon="checkmark" onPress={ensurePerms} testID="camera-grant" />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="camera-screen">
      {isWeb ? (
        <View style={styles.webPreview}>
          <Ionicons name="phone-portrait-outline" size={40} color={colors.muted} />
          <Text style={styles.webText}>Pratinjau kamera tersedia di perangkat iOS/Android</Text>
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          style={[StyleSheet.absoluteFill, facing === "front" && cam.mirrorPreview ? styles.mirrored : null]}
          facing={facing}
          mode="video"
        />
      )}

      {/* Teleprompter overlay */}
      {content ? (
        <Pressable style={styles.teleWrap} onPress={() => setControlsVisible((v) => !v)}>
          <Teleprompter ref={teleRef} content={content} settings={tele} playing={playing} overlayOpacity={tele.bgOpacity} />
        </Pressable>
      ) : (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setControlsVisible((v) => !v)} />
      )}

      {/* Top bar */}
      {controlsVisible ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.topBar, { top: insets.top + spacing.sm }]}>
          <Pressable style={styles.circleBtn} onPress={() => (recording ? stopRecording() : router.back())} testID="camera-close">
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          {recording ? (
            <View style={styles.recPill}>
              <View style={styles.recPillDot} />
              <Text style={styles.recPillText}>{formatClock(elapsed * 1000)}</Text>
            </View>
          ) : (
            <View style={styles.ratioPill}>
              <Text style={styles.ratioText}>{cam.ratio}</Text>
            </View>
          )}
          <Pressable style={styles.circleBtn} onPress={() => { const f = facing === "front" ? "back" : "front"; setFacing(f); setCam({ facing: f }); }} testID="camera-flip">
            <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Teleprompter mini controls */}
      {controlsVisible && content ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.teleControls, { bottom: insets.bottom + 150 }]}>
          <Pressable style={styles.teleBtn} onPress={() => teleRef.current?.jumpBy(-120)} testID="tele-rewind">
            <Ionicons name="play-back" size={18} color="#FFFFFF" />
          </Pressable>
          <Pressable style={styles.teleBtn} onPress={() => setPlaying((p) => !p)} testID="tele-play">
            <Ionicons name={playing ? "pause" : "play"} size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable style={styles.teleBtn} onPress={() => teleRef.current?.jumpBy(120)} testID="tele-forward">
            <Ionicons name="play-forward" size={18} color="#FFFFFF" />
          </Pressable>
          <Pressable style={styles.teleBtn} onPress={() => teleRef.current?.restart()} testID="tele-restart">
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { bottom: insets.bottom + spacing.lg }]}>
        <View style={styles.micPill}>
          <Ionicons name={micPerm?.granted || isWeb ? "mic" : "mic-off"} size={16} color={micPerm?.granted || isWeb ? colors.success : colors.error} />
          <Text style={styles.micText}>{isWeb ? "Mic" : micPerm?.granted ? "Mic aktif" : "Mic off"}</Text>
        </View>

        <Pressable onPress={() => (recording ? stopRecording() : beginCountdown())} testID="record-button">
          <View style={[styles.recordOuter, recording && styles.recordOuterActive]}>
            <View style={recording ? styles.recordInnerStop : styles.recordInner} />
          </View>
        </Pressable>

        <Pressable style={styles.sideBtn} onPress={() => setControlsVisible((v) => !v)} testID="toggle-controls">
          <Ionicons name={controlsVisible ? "eye" : "eye-off"} size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Countdown */}
      {countdown != null ? (
        <View style={styles.countdownWrap} pointerEvents="none">
          <Animated.Text key={countdown} entering={ZoomIn} style={styles.countdownText}>
            {countdown}
          </Animated.Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: "#000000" },
  mirrored: { transform: [{ scaleX: -1 }] },
  webPreview: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: "#0A0A0A" },
  webText: { color: colors.muted, fontSize: 14, paddingHorizontal: spacing.xl, textAlign: "center" },
  teleWrap: { ...StyleSheet.absoluteFillObject },
  topBar: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  circleBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  ratioPill: { backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  ratioText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  recPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,59,48,0.9)", paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill },
  recPillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  recPillText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  teleControls: { position: "absolute", alignSelf: "center", flexDirection: "row", gap: spacing.sm, backgroundColor: "rgba(0,0,0,0.5)", padding: spacing.sm, borderRadius: radius.pill },
  teleBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  bottomBar: { position: "absolute", left: spacing.xl, right: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  micPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, minWidth: 64 },
  micText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  sideBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  recordOuter: { width: 76, height: 76, borderRadius: radius.pill, borderWidth: 5, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  recordOuterActive: { borderColor: colors.recordRed },
  recordInner: { width: 58, height: 58, borderRadius: radius.pill, backgroundColor: colors.recordRed },
  recordInnerStop: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.recordRed },
  countdownWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  countdownText: { color: "#FFFFFF", fontSize: 140, fontWeight: "900" },
  permGate: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  gateClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  gateCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  gateIcon: { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  gateTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  gateDesc: { color: colors.muted, fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: spacing.lg, paddingHorizontal: spacing.lg },
}));
