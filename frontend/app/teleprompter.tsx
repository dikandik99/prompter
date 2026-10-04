import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Teleprompter, type TeleprompterHandle } from "@/src/components/Teleprompter";
import { useLibrary } from "@/src/store/library";
import { useSettings } from "@/src/store/settings";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function TeleprompterScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scriptId } = useLocalSearchParams<{ scriptId?: string }>();
  const { getScript } = useLibrary();
  const { tele, setTele } = useSettings();

  const teleRef = useRef<TeleprompterHandle>(null);
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const script = scriptId ? getScript(scriptId) : undefined;
  const content = script?.content ?? "Tidak ada skrip untuk ditampilkan.";

  function start() {
    let n = tele.countdown;
    setCountdown(n);
    teleRef.current?.restart();
    const iv = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(iv);
        setCountdown(null);
        setPlaying(true);
      } else setCountdown(n);
    }, 1000);
  }

  return (
    <View style={styles.container} testID="teleprompter-screen">
      <Teleprompter ref={teleRef} content={content} settings={tele} playing={playing} overlayOpacity={0} />

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <Pressable style={styles.circleBtn} onPress={() => router.back()} testID="tele-close">
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{script?.title || "Teleprompter"}</Text>
        <Pressable style={styles.circleBtn} onPress={() => setTele({ mirror: !tele.mirror })} testID="tele-mirror">
          <Ionicons name="swap-horizontal" size={24} color={tele.mirror ? colors.brand : "#FFFFFF"} />
        </Pressable>
      </View>

      <View style={[styles.controls, { bottom: insets.bottom + spacing.lg }]}>
        <View style={styles.speedBox}>
          <Pressable onPress={() => setTele({ speed: Math.max(10, tele.speed - 10) })} style={styles.smallBtn} testID="tele-slower">
            <Ionicons name="remove" size={18} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.speedText}>{tele.speed}</Text>
          <Pressable onPress={() => setTele({ speed: Math.min(160, tele.speed + 10) })} style={styles.smallBtn} testID="tele-faster">
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <Pressable style={styles.playBtn} onPress={() => (countdown == null ? (playing ? setPlaying(false) : start()) : null)} testID="tele-startpause">
          <Ionicons name={playing ? "pause" : "play"} size={30} color={colors.onBrandPrimary} />
        </Pressable>

        <View style={styles.speedBox}>
          <Pressable onPress={() => setTele({ fontSize: Math.max(16, tele.fontSize - 2) })} style={styles.smallBtn} testID="tele-fontdown">
            <Ionicons name="text" size={14} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.speedText}>{tele.fontSize}</Text>
          <Pressable onPress={() => setTele({ fontSize: Math.min(60, tele.fontSize + 2) })} style={styles.smallBtn} testID="tele-fontup">
            <Ionicons name="text" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {countdown != null ? (
        <View style={styles.countdownWrap} pointerEvents="none">
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  topBar: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  title: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", flex: 1, textAlign: "center" },
  circleBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  controls: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  speedBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.pill, padding: 4 },
  smallBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  speedText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", minWidth: 30, textAlign: "center" },
  playBtn: { width: 68, height: 68, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  countdownWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  countdownText: { color: "#FFFFFF", fontSize: 140, fontWeight: "900" },
}));
