import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";

export type Lang = "id" | "en";

const STRINGS: Record<Lang, Record<string, string>> = {
  id: {
    "common.cancel": "Batal",
    "common.save": "Simpan",
    "common.delete": "Hapus",
    "common.done": "Selesai",
    "common.next": "Lanjut",
    "common.skip": "Lewati",
    "common.getStarted": "Mulai",
    "common.continue": "Lanjutkan",
    "common.search": "Cari",
    "common.retry": "Coba lagi",
    "common.close": "Tutup",
    "common.pro": "PRO",
    "common.upgrade": "Upgrade ke Pro",

    "tabs.scripts": "Skrip",
    "tabs.record": "Rekam",
    "tabs.library": "Pustaka",
    "tabs.tools": "Alat",
    "tabs.settings": "Pengaturan",

    "onboard.1.title": "Bicara alami. Rekam percaya diri.",
    "onboard.1.desc": "Kamera profesional dan teleprompter Anda untuk membuat konten yang lebih baik.",
    "onboard.2.title": "Baca sambil merekam",
    "onboard.2.desc": "Jaga skrip Anda dekat kamera agar kontak mata tetap alami.",
    "onboard.3.title": "Rekam video profesional",
    "onboard.3.desc": "Atur kamera, mikrofon, kecepatan skrip, dan pengalaman merekam dari satu tempat.",
    "onboard.4.title": "Berkarya di mana saja",
    "onboard.4.desc": "Skrip dan rekaman Anda tertata dan siap kapan pun inspirasi datang.",

    "scripts.title": "Skrip",
    "scripts.new": "Buat Skrip",
    "scripts.empty.title": "Belum ada skrip",
    "scripts.empty.desc": "Mulai dengan membuat skrip pertama Anda.",
    "scripts.favorites": "Favorit",
    "scripts.recent": "Terbaru",
    "scripts.all": "Semua",
    "scripts.words": "kata",
    "scripts.untitled": "Tanpa judul",

    "editor.title": "Judul skrip",
    "editor.placeholder": "Tulis skrip Anda di sini…",
    "editor.words": "Kata",
    "editor.chars": "Karakter",
    "editor.duration": "Perkiraan durasi",
    "editor.speed": "Kecepatan bicara",
    "editor.slow": "Lambat",
    "editor.normal": "Normal",
    "editor.fast": "Cepat",
    "editor.translate": "Terjemahkan",
    "editor.teleprompter": "Teleprompter",
    "editor.record": "Rekam",
    "editor.import": "Impor",
    "editor.saved": "Tersimpan",

    "record.title": "Rekam",
    "record.pick": "Pilih skrip untuk mulai",
    "record.quick": "Rekam cepat (tanpa skrip)",
    "record.empty": "Belum ada rekaman",
    "record.emptyDesc": "Rekam video pertama Anda menggunakan teleprompter.",
    "record.start": "Mulai Rekam",

    "library.title": "Pustaka",
    "library.empty.title": "Belum ada rekaman",
    "library.empty.desc": "Rekam video pertama Anda menggunakan teleprompter.",

    "tools.title": "Alat",
    "settings.title": "Pengaturan",

    "paywall.headline": "Berkarya dengan percaya diri.",
    "paywall.sub": "Semua yang Anda butuhkan untuk merekam konten profesional.",
    "paywall.monthly": "Bulanan",
    "paywall.yearly": "Tahunan",
    "paywall.bestValue": "PALING HEMAT",
    "paywall.cta": "Upgrade ke Pro",
    "paywall.restore": "Pulihkan Pembelian",
    "paywall.terms": "Ketentuan",
    "paywall.privacy": "Privasi",

    "auth.login": "Masuk",
    "auth.register": "Daftar",
    "auth.email": "Email",
    "auth.password": "Kata sandi",
    "auth.name": "Nama",
    "auth.noAccount": "Belum punya akun? Daftar",
    "auth.hasAccount": "Sudah punya akun? Masuk",
    "auth.guest": "Lanjut tanpa akun",
    "auth.google": "Lanjutkan dengan Google",
    "auth.or": "atau",
    "auth.googleFailed": "Masuk dengan Google gagal",

    "folders.manage": "Kelola folder",
    "folders.new": "Folder baru",
    "folders.placeholder": "Nama folder baru",
    "folders.rename": "Ubah nama",
    "folders.move": "Pindah ke folder",
    "folders.none": "Tanpa folder",
    "folders.scripts": "skrip",
    "folders.deleteHint": "Menghapus folder tidak menghapus skrip di dalamnya",
    "folders.empty": "Belum ada folder",
    "folders.created": "Folder dibuat",
    "folders.deleted": "Folder dihapus",
    "folders.moved": "Skrip dipindahkan",

    "feat.unlimited_scripts": "Skrip tanpa batas",
    "feat.pro_teleprompter": "Teleprompter profesional",
    "feat.voice_following": "Pengikut suara (VoiceGlide)",
    "feat.advanced_translation": "Terjemahan lanjutan",
    "feat.cloud_sync": "Sinkronisasi cloud",
    "feat.advanced_recording": "Perekaman lanjutan",
    "feat.premium_tools": "Alat premium",
  },
  en: {
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.done": "Done",
    "common.next": "Next",
    "common.skip": "Skip",
    "common.getStarted": "Get Started",
    "common.continue": "Continue",
    "common.search": "Search",
    "common.retry": "Retry",
    "common.close": "Close",
    "common.pro": "PRO",
    "common.upgrade": "Upgrade to Pro",

    "tabs.scripts": "Scripts",
    "tabs.record": "Record",
    "tabs.library": "Library",
    "tabs.tools": "Tools",
    "tabs.settings": "Settings",

    "onboard.1.title": "Speak naturally. Record confidently.",
    "onboard.1.desc": "Your professional camera and teleprompter for creating better content.",
    "onboard.2.title": "Read while you record",
    "onboard.2.desc": "Keep your script close to the camera so you can maintain natural eye contact.",
    "onboard.3.title": "Record professional videos",
    "onboard.3.desc": "Control your camera, microphone, script speed and recording experience from one place.",
    "onboard.4.title": "Create anywhere",
    "onboard.4.desc": "Your scripts and recordings are organized and ready whenever inspiration strikes.",

    "scripts.title": "Scripts",
    "scripts.new": "Create Script",
    "scripts.empty.title": "No scripts yet",
    "scripts.empty.desc": "Start by creating your first script.",
    "scripts.favorites": "Favorites",
    "scripts.recent": "Recent",
    "scripts.all": "All",
    "scripts.words": "words",
    "scripts.untitled": "Untitled",

    "editor.title": "Script title",
    "editor.placeholder": "Write your script here…",
    "editor.words": "Words",
    "editor.chars": "Characters",
    "editor.duration": "Estimated duration",
    "editor.speed": "Speaking speed",
    "editor.slow": "Slow",
    "editor.normal": "Normal",
    "editor.fast": "Fast",
    "editor.translate": "Translate",
    "editor.teleprompter": "Teleprompter",
    "editor.record": "Record",
    "editor.import": "Import",
    "editor.saved": "Saved",

    "record.title": "Record",
    "record.pick": "Pick a script to begin",
    "record.quick": "Quick record (no script)",
    "record.empty": "No recordings yet",
    "record.emptyDesc": "Record your first video using the teleprompter.",
    "record.start": "Start Recording",

    "library.title": "Library",
    "library.empty.title": "No recordings yet",
    "library.empty.desc": "Record your first video using the teleprompter.",

    "tools.title": "Tools",
    "settings.title": "Settings",

    "paywall.headline": "Create with confidence.",
    "paywall.sub": "Everything you need to record professional content.",
    "paywall.monthly": "Monthly",
    "paywall.yearly": "Yearly",
    "paywall.bestValue": "BEST VALUE",
    "paywall.cta": "Upgrade to Pro",
    "paywall.restore": "Restore Purchases",
    "paywall.terms": "Terms",
    "paywall.privacy": "Privacy",

    "auth.login": "Sign In",
    "auth.register": "Create Account",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.name": "Name",
    "auth.noAccount": "No account? Sign up",
    "auth.hasAccount": "Have an account? Sign in",
    "auth.guest": "Continue without account",
    "auth.google": "Continue with Google",
    "auth.or": "or",
    "auth.googleFailed": "Google sign-in failed",

    "folders.manage": "Manage folders",
    "folders.new": "New folder",
    "folders.placeholder": "New folder name",
    "folders.rename": "Rename",
    "folders.move": "Move to folder",
    "folders.none": "No folder",
    "folders.scripts": "scripts",
    "folders.deleteHint": "Deleting a folder keeps its scripts",
    "folders.empty": "No folders yet",
    "folders.created": "Folder created",
    "folders.deleted": "Folder deleted",
    "folders.moved": "Script moved",

    "feat.unlimited_scripts": "Unlimited scripts",
    "feat.pro_teleprompter": "Professional teleprompter",
    "feat.voice_following": "Voice-following (VoiceGlide)",
    "feat.advanced_translation": "Advanced translation",
    "feat.cloud_sync": "Cloud sync",
    "feat.advanced_recording": "Advanced recording",
    "feat.premium_tools": "Premium tools",
  },
};

const LANG_KEY = "promptera.lang";

type I18nCtx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };
const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    storage.getItem<Lang>(LANG_KEY, "id").then((v) => v && setLangState(v));
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback(
    (key: string) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("I18nProvider missing");
  return c;
}
