import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

import { genId } from "@/src/lib/ids";
import { countWords, estimateSeconds } from "@/src/lib/text";
import { useSettings } from "@/src/store/settings";
import { storage } from "@/src/utils/storage";

export type Folder = { id: string; name: string; createdAt: number };

export type Script = {
  id: string;
  folderId: string | null;
  title: string;
  content: string;
  language: string;
  wordCount: number;
  estimatedDuration: number; // seconds, based on the teleprompter "wpm" setting
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Recording = {
  id: string;
  scriptId: string | null;
  scriptTitle: string;
  uri: string;
  thumbnailUri: string | null;
  durationMs: number;
  resolution: string;
  orientation: string;
  mirrored: boolean;
  isFavorite: boolean;
  createdAt: number;
};

const SCRIPTS_KEY = "promptera.scripts";
const FOLDERS_KEY = "promptera.folders";
const RECORDINGS_KEY = "promptera.recordings";

const DEFAULT_FOLDERS: Folder[] = [
  { id: "f_tiktok", name: "TikTok", createdAt: 0 },
  { id: "f_instagram", name: "Instagram", createdAt: 0 },
  { id: "f_youtube", name: "YouTube", createdAt: 0 },
  { id: "f_review", name: "Product Review", createdAt: 0 },
  { id: "f_ads", name: "Ads", createdAt: 0 },
  { id: "f_education", name: "Education", createdAt: 0 },
  { id: "f_personal", name: "Personal", createdAt: 0 },
];

const SAMPLE_SCRIPTS: Script[] = [
  {
    id: "sample_1",
    folderId: "f_tiktok",
    title: "Hook pembuka 7 detik",
    content:
      "Berhenti scroll dulu! Dalam 30 detik ke depan, aku akan tunjukkan satu trik yang mengubah cara kamu membuat konten.\n\nSiap? Yuk mulai.",
    language: "id",
    wordCount: 0,
    estimatedDuration: 0,
    isFavorite: true,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: "sample_2",
    folderId: "f_review",
    title: "Product review intro",
    content:
      "Today I'm testing a product that everyone's been talking about. I've used it for two weeks straight, and here's my honest take.\n\nLet's get into it.",
    language: "en",
    wordCount: 0,
    estimatedDuration: 0,
    isFavorite: false,
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172800000,
  },
];

function hydrate(s: Script, wpm = 130): Script {
  const wordCount = countWords(s.content);
  return { ...s, wordCount, estimatedDuration: estimateSeconds(wordCount, wpm) };
}

type Ctx = {
  ready: boolean;
  scripts: Script[];
  folders: Folder[];
  recordings: Recording[];
  createScript: (data?: Partial<Script>) => Script;
  updateScript: (id: string, patch: Partial<Script>) => void;
  deleteScript: (id: string) => void;
  duplicateScript: (id: string) => Script | null;
  toggleFavoriteScript: (id: string) => void;
  getScript: (id: string) => Script | undefined;
  createFolder: (name: string) => Folder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  moveScript: (scriptId: string, folderId: string | null) => void;
  addRecording: (data: Partial<Recording>) => Recording;
  updateRecording: (id: string, patch: Partial<Recording>) => void;
  deleteRecording: (id: string) => void;
  toggleFavoriteRecording: (id: string) => void;
};

const LibraryCtx = createContext<Ctx | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { tele } = useSettings();
  const wpm = tele.wpm;
  const [ready, setReady] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);

  useEffect(() => {
    (async () => {
      const storedScripts = await storage.getItem<Script[] | null>(SCRIPTS_KEY, null);
      const storedFolders = await storage.getItem<Folder[] | null>(FOLDERS_KEY, null);
      const storedRec = await storage.getItem<Recording[] | null>(RECORDINGS_KEY, null);

      if (storedScripts == null) {
        const seeded = SAMPLE_SCRIPTS.map((s) => hydrate(s, wpm));
        setScripts(seeded);
        storage.setItem(SCRIPTS_KEY, seeded);
      } else {
        setScripts(storedScripts.map((s) => hydrate(s, wpm)));
      }

      if (storedFolders == null) {
        setFolders(DEFAULT_FOLDERS);
        storage.setItem(FOLDERS_KEY, DEFAULT_FOLDERS);
      } else {
        setFolders(storedFolders);
      }

      setRecordings(storedRec ?? []);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep every script's estimated duration in sync with the user's "Kata per
  // menit" setting (not just at creation/edit time) so the reading-pace
  // control visibly affects durations shown across Scripts/Library/Record.
  useEffect(() => {
    if (!ready) return;
    setScripts((prev) => {
      const next = prev.map((s) => hydrate(s, wpm));
      storage.setItem(SCRIPTS_KEY, next);
      return next;
    });
  }, [wpm, ready]);

  const persistScripts = useCallback((next: Script[]) => {
    setScripts(next);
    storage.setItem(SCRIPTS_KEY, next);
  }, []);
  const persistFolders = useCallback((next: Folder[]) => {
    setFolders(next);
    storage.setItem(FOLDERS_KEY, next);
  }, []);
  const persistRecordings = useCallback((next: Recording[]) => {
    setRecordings(next);
    storage.setItem(RECORDINGS_KEY, next);
  }, []);

  const createScript = useCallback(
    (data: Partial<Script> = {}) => {
      const now = Date.now();
      const base: Script = hydrate(
        {
          id: genId(),
          folderId: data.folderId ?? null,
          title: data.title ?? "",
          content: data.content ?? "",
          language: data.language ?? "id",
          wordCount: 0,
          estimatedDuration: 0,
          isFavorite: false,
          createdAt: now,
          updatedAt: now,
        },
        wpm,
      );
      setScripts((prev) => {
        const next = [base, ...prev];
        storage.setItem(SCRIPTS_KEY, next);
        return next;
      });
      return base;
    },
    [wpm],
  );

  const updateScript = useCallback((id: string, patch: Partial<Script>) => {
    setScripts((prev) => {
      const next = prev.map((s) =>
        s.id === id ? hydrate({ ...s, ...patch, updatedAt: Date.now() }, wpm) : s,
      );
      storage.setItem(SCRIPTS_KEY, next);
      return next;
    });
  }, [wpm]);

  const deleteScript = useCallback((id: string) => {
    setScripts((prev) => {
      const next = prev.filter((s) => s.id !== id);
      storage.setItem(SCRIPTS_KEY, next);
      return next;
    });
  }, []);

  const duplicateScript = useCallback((id: string) => {
    let created: Script | null = null;
    setScripts((prev) => {
      const src = prev.find((s) => s.id === id);
      if (!src) return prev;
      const now = Date.now();
      created = hydrate({ ...src, id: genId(), title: `${src.title || "Untitled"} (copy)`, createdAt: now, updatedAt: now, isFavorite: false }, wpm);
      const next = [created, ...prev];
      storage.setItem(SCRIPTS_KEY, next);
      return next;
    });
    return created;
  }, [wpm]);

  const toggleFavoriteScript = useCallback((id: string) => {
    setScripts((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s));
      storage.setItem(SCRIPTS_KEY, next);
      return next;
    });
  }, []);

  const getScript = useCallback((id: string) => scripts.find((s) => s.id === id), [scripts]);

  const createFolder = useCallback((name: string) => {
    const folder: Folder = { id: genId(), name, createdAt: Date.now() };
    setFolders((prev) => {
      const next = [...prev, folder];
      storage.setItem(FOLDERS_KEY, next);
      return next;
    });
    return folder;
  }, []);

  const renameFolder = useCallback((id: string, name: string) => {
    setFolders((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, name } : f));
      storage.setItem(FOLDERS_KEY, next);
      return next;
    });
  }, []);

  const moveScript = useCallback((scriptId: string, folderId: string | null) => {
    setScripts((prev) => {
      const next = prev.map((s) => (s.id === scriptId ? { ...s, folderId } : s));
      storage.setItem(SCRIPTS_KEY, next);
      return next;
    });
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders((prev) => {
      const next = prev.filter((f) => f.id !== id);
      storage.setItem(FOLDERS_KEY, next);
      return next;
    });
    setScripts((prev) => {
      const next = prev.map((s) => (s.folderId === id ? { ...s, folderId: null } : s));
      storage.setItem(SCRIPTS_KEY, next);
      return next;
    });
  }, []);

  const addRecording = useCallback((data: Partial<Recording>) => {
    const rec: Recording = {
      id: genId(),
      scriptId: data.scriptId ?? null,
      scriptTitle: data.scriptTitle ?? "Untitled",
      uri: data.uri ?? "",
      thumbnailUri: data.thumbnailUri ?? null,
      durationMs: data.durationMs ?? 0,
      resolution: data.resolution ?? "1080p",
      orientation: data.orientation ?? "9:16",
      mirrored: data.mirrored ?? false,
      isFavorite: false,
      createdAt: Date.now(),
    };
    setRecordings((prev) => {
      const next = [rec, ...prev];
      storage.setItem(RECORDINGS_KEY, next);
      return next;
    });
    return rec;
  }, []);

  const updateRecording = useCallback((id: string, patch: Partial<Recording>) => {
    setRecordings((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      storage.setItem(RECORDINGS_KEY, next);
      return next;
    });
  }, []);

  const deleteRecording = useCallback((id: string) => {
    setRecordings((prev) => {
      const next = prev.filter((r) => r.id !== id);
      storage.setItem(RECORDINGS_KEY, next);
      return next;
    });
  }, []);

  const toggleFavoriteRecording = useCallback((id: string) => {
    setRecordings((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, isFavorite: !r.isFavorite } : r));
      storage.setItem(RECORDINGS_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      scripts,
      folders,
      recordings,
      createScript,
      updateScript,
      deleteScript,
      duplicateScript,
      toggleFavoriteScript,
      getScript,
      createFolder,
      renameFolder,
      deleteFolder,
      moveScript,
      addRecording,
      updateRecording,
      deleteRecording,
      toggleFavoriteRecording,
    }),
    [ready, scripts, folders, recordings, createScript, updateScript, deleteScript, duplicateScript, toggleFavoriteScript, getScript, createFolder, renameFolder, deleteFolder, moveScript, addRecording, updateRecording, deleteRecording, toggleFavoriteRecording],
  );

  return <LibraryCtx.Provider value={value}>{children}</LibraryCtx.Provider>;
}

export function useLibrary() {
  const c = useContext(LibraryCtx);
  if (!c) throw new Error("LibraryProvider missing");
  return c;
}
