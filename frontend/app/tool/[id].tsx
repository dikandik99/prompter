import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Screen } from "@/src/components/Screen";
import { Button } from "@/src/components/ui";
import { countChars, countWords, estimateSeconds, formatDuration } from "@/src/lib/text";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ToolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const map: Record<string, { title: string; node: React.ReactNode }> = {
    countdown: { title: "Countdown Timer", node: <CountdownTool /> },
    speaking: { title: "Speaking Timer", node: <SpeakingTool /> },
    wordcount: { title: "Word Counter", node: <WordCountTool /> },
    readingspeed: { title: "Reading Speed", node: <DurationTool reading /> },
    duration: { title: "Script Duration", node: <DurationTool /> },
    voiceglide: { title: "VoiceGlide", node: <InfoTool icon="mic" title="Teleprompter mengikuti suara" desc="VoiceGlide mendengarkan suara Anda melalui mikrofon dan memajukan skrip secara otomatis mengikuti tempo bicara. Arsitektur engine (VoiceRecognition → SpeechAlignment → Teleprompter) sudah disiapkan. Mode manual tersedia penuh hari ini; pengenalan suara on-device aktif pada build perangkat." /> },
    ai: { title: "AI Assistant", node: <InfoTool icon="sparkles" title="Asisten Skrip AI" desc="Hasilkan hook, CTA, perpendek atau tulis ulang skrip menggunakan DeepSeek. Fitur ini berjalan melalui AI Gateway aman kami dengan kuota & cache. Aktif setelah kunci DeepSeek dikonfigurasi di server." /> },
  };
  const tool = map[id as string] ?? map.wordcount;
  return (
    <Screen title={tool.title} showBack testID={`tool-screen-${id}`}>
      {tool.node}
    </Screen>
  );
}

function CountdownTool() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [secs, setSecs] = useState(10);
  const [remaining, setRemaining] = useState(10);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (ref.current) clearInterval(ref.current); }, []);
  useEffect(() => { if (!running) setRemaining(secs); }, [secs, running]);

  function start() {
    setRunning(true);
    setRemaining(secs);
    ref.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { if (ref.current) clearInterval(ref.current); setRunning(false); return 0; }
        return r - 1;
      });
    }, 1000);
  }
  function reset() { if (ref.current) clearInterval(ref.current); setRunning(false); setRemaining(secs); }

  return (
    <View style={styles.center}>
      <Text style={styles.bigNumber}>{remaining}</Text>
      {!running ? (
        <View style={styles.presetRow}>
          {[3, 5, 10, 30, 60].map((p) => (
            <Pressable key={p} style={[styles.preset, secs === p && styles.presetActive]} onPress={() => setSecs(p)} testID={`cd-preset-${p}`}>
              <Text style={[styles.presetText, secs === p && { color: colors.onBrandPrimary }]}>{p}s</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.btnRow}>
        <Button label={running ? "Reset" : "Mulai"} icon={running ? "refresh" : "play"} onPress={running ? reset : start} testID="cd-start" style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function SpeakingTool() {
  const styles = useStyles();
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (ref.current) clearInterval(ref.current); }, []);

  function toggle() {
    if (running) { if (ref.current) clearInterval(ref.current); setRunning(false); }
    else { setRunning(true); ref.current = setInterval(() => setMs((m) => m + 100), 100); }
  }
  return (
    <View style={styles.center}>
      <Text style={styles.bigNumber}>{formatDuration(ms / 1000)}</Text>
      <View style={styles.btnRow}>
        <Button label={running ? "Jeda" : "Mulai"} icon={running ? "pause" : "play"} onPress={toggle} style={{ flex: 1 }} testID="sp-toggle" />
        <Button label="Reset" icon="refresh" variant="secondary" onPress={() => { if (ref.current) clearInterval(ref.current); setRunning(false); setMs(0); }} style={{ flex: 1 }} testID="sp-reset" />
      </View>
    </View>
  );
}

function WordCountTool() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const words = countWords(text);
  const chars = countChars(text);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim()).length;
  return (
    <View>
      <View style={styles.statsRow}>
        <StatBox label="Kata" value={String(words)} />
        <StatBox label="Karakter" value={String(chars)} />
        <StatBox label="Kalimat" value={String(sentences)} />
      </View>
      <TextInput style={styles.area} value={text} onChangeText={setText} placeholder="Tempel teks Anda…" placeholderTextColor={colors.muted} multiline textAlignVertical="top" testID="wc-input" />
    </View>
  );
}

function DurationTool({ reading }: { reading?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const [wpm, setWpm] = useState(130);
  const words = countWords(text);
  const secs = estimateSeconds(words, wpm);
  return (
    <View>
      <View style={styles.statsRow}>
        <StatBox label="Kata" value={String(words)} />
        <StatBox label="WPM" value={String(wpm)} />
        <StatBox label="Durasi" value={formatDuration(secs)} highlight />
      </View>
      <View style={styles.wpmRow}>
        <Text style={styles.wpmLabel}>Kata per menit</Text>
        <View style={styles.stepper}>
          <Pressable style={styles.stepBtn} onPress={() => setWpm((w) => Math.max(80, w - 5))} testID="dur-minus"><Ionicons name="remove" size={18} color={colors.onSurface} /></Pressable>
          <Text style={styles.stepVal}>{wpm}</Text>
          <Pressable style={styles.stepBtn} onPress={() => setWpm((w) => Math.min(220, w + 5))} testID="dur-plus"><Ionicons name="add" size={18} color={colors.onSurface} /></Pressable>
        </View>
      </View>
      <TextInput style={styles.area} value={text} onChangeText={setText} placeholder={reading ? "Tempel teks untuk menghitung durasi baca…" : "Tempel skrip…"} placeholderTextColor={colors.muted} multiline textAlignVertical="top" testID="dur-input" />
    </View>
  );
}

function InfoTool({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={{ alignItems: "center", paddingTop: spacing.xl }}>
      <View style={styles.infoIcon}><Ionicons name={icon as any} size={40} color={colors.brand} /></View>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoDesc}>{desc}</Text>
      <View style={styles.proBanner}><Text style={styles.proBannerText}>Fitur PRO</Text></View>
      <Button label="Lihat PROMPTERA Pro" icon="sparkles" onPress={() => router.push("/paywall")} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
    </View>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, highlight && styles.statHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  center: { alignItems: "center", paddingTop: spacing.xl, gap: spacing.xl },
  bigNumber: { color: colors.onSurface, fontSize: 96, fontWeight: "900", fontVariant: ["tabular-nums"] },
  presetRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", justifyContent: "center" },
  preset: { paddingHorizontal: spacing.lg, height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  presetActive: { backgroundColor: colors.brand },
  presetText: { color: colors.onSurface, fontWeight: "700", fontSize: 15 },
  btnRow: { flexDirection: "row", gap: spacing.md, alignSelf: "stretch" },
  statsRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
  statBox: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statValue: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  statHighlight: { color: colors.brand },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  area: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 16, minHeight: 220, lineHeight: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  wpmRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  wpmLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 3 },
  stepBtn: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  stepVal: { color: colors.onSurface, fontSize: 15, fontWeight: "700", minWidth: 44, textAlign: "center" },
  infoIcon: { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  infoTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800", textAlign: "center" },
  infoDesc: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: "center", marginTop: spacing.md },
  proBanner: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.lg },
  proBannerText: { color: colors.brand, fontWeight: "800", fontSize: 12 },
}));
