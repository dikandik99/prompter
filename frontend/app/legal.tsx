import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { Screen } from "@/src/components/Screen";
import { makeStyles, spacing } from "@/src/theme";

const TERMS = `KETENTUAN LAYANAN — PROMPTERA

Terakhir diperbarui: 2026

PROMPTERA dimiliki dan dioperasikan oleh PT Samudera Kreatif Indonesia.

1. Penerimaan Ketentuan
Dengan menggunakan PROMPTERA Anda menyetujui ketentuan ini.

2. Lisensi
Kami memberi Anda lisensi terbatas, non-eksklusif untuk menggunakan aplikasi untuk membuat konten.

3. Konten Anda
Skrip dan rekaman Anda adalah milik Anda. Secara default, rekaman disimpan secara lokal di perangkat Anda dan tidak diunggah ke server kami.

4. Langganan
PROMPTERA Pro ditawarkan sebagai langganan bulanan atau tahunan. Pembayaran diproses melalui penyedia pihak ketiga.

5. Pembatasan
Anda setuju untuk tidak menyalahgunakan fitur AI atau melanggar hukum yang berlaku.

6. Perubahan
Kami dapat memperbarui ketentuan ini dari waktu ke waktu.

Dokumen ini adalah placeholder dan harus ditinjau secara hukum sebelum peluncuran komersial.`;

const PRIVACY = `KEBIJAKAN PRIVASI — PROMPTERA

Terakhir diperbarui: 2026

PROMPTERA dirancang dengan prinsip local-first.

1. Data yang Kami Proses
- Akun: email dan nama (jika Anda mendaftar)
- Skrip: disimpan secara lokal; sinkronisasi cloud bersifat opsional
- Rekaman: disimpan secara lokal di perangkat Anda dan TIDAK diunggah otomatis

2. Kamera & Mikrofon
Digunakan hanya untuk merekam di perangkat Anda. Kami tidak mengakses footage Anda.

3. Fitur AI
Teks yang Anda kirim untuk diterjemahkan diproses melalui penyedia AI melalui server aman kami. Kami tidak menyimpan konten rekaman.

4. Analitik
Kami mengumpulkan peristiwa penggunaan anonim (tanpa konten skrip/rekaman).

5. Keamanan
Kredensial pembayaran dan kunci API tidak pernah disimpan di aplikasi.

6. Kontak
privacy@promptera.app

Dokumen ini adalah placeholder dan harus ditinjau secara hukum sebelum peluncuran komersial.`;

export default function Legal() {
  const styles = useStyles();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const isPrivacy = doc === "privacy";
  return (
    <Screen title={isPrivacy ? "Kebijakan Privasi" : "Ketentuan Layanan"} showBack testID="legal-screen">
      <Text style={styles.body}>{isPrivacy ? PRIVACY : TERMS}</Text>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  body: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 22, paddingVertical: spacing.md },
}));
