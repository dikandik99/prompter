import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

import { storage } from "@/src/utils/storage";

export type TeleprompterSettings = {
  fontSize: number; // px
  lineSpacing: number; // multiplier
  speed: number; // px per second baseline
  textColor: "white" | "orange";
  bgOpacity: number; // 0..1 overlay darkness
  mirror: boolean;
  position: "top" | "center" | "bottom";
  margin: number; // horizontal padding
  countdown: 3 | 5 | 10;
  wpm: number; // words per minute (also used for duration estimates)
};

export type CameraSettings = {
  facing: "front" | "back";
  mirrorPreview: boolean;
  saveMirrored: boolean;
  ratio: "9:16" | "16:9" | "1:1";
  flash: boolean;
  resolution: "720p" | "1080p" | "4k";
};

const DEFAULT_TELE: TeleprompterSettings = {
  fontSize: 28,
  lineSpacing: 1.4,
  speed: 40,
  textColor: "white",
  bgOpacity: 0.55,
  mirror: false,
  position: "center",
  margin: 20,
  countdown: 3,
  wpm: 130,
};

const DEFAULT_CAM: CameraSettings = {
  facing: "front",
  mirrorPreview: true,
  saveMirrored: false,
  ratio: "9:16",
  flash: false,
  resolution: "1080p",
};

const TELE_KEY = "promptera.teleprompter";
const CAM_KEY = "promptera.camera";

// Keeps "Kecepatan scroll" (px/s) and "Kata per menit" (wpm) coherent: the
// scroll engine only ever reads `speed`, but adjusting either control must
// visibly change the actual auto-scroll pace. Ratio is calibrated to the
// default (130 wpm <-> 40 px/s) so existing saved settings don't jump.
const WPM_SPEED_RATIO = 40 / 130; // px/s per word-per-minute
const SPEED_MIN = 10;
const SPEED_MAX = 160;
const WPM_MIN = 80;
const WPM_MAX = 220;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const speedFromWpm = (wpm: number) => clamp(Math.round((wpm * WPM_SPEED_RATIO) / 5) * 5, SPEED_MIN, SPEED_MAX);
export const wpmFromSpeed = (speed: number) => clamp(Math.round((speed / WPM_SPEED_RATIO) / 5) * 5, WPM_MIN, WPM_MAX);

type Ctx = {
  tele: TeleprompterSettings;
  cam: CameraSettings;
  setTele: (patch: Partial<TeleprompterSettings>) => void;
  setCam: (patch: Partial<CameraSettings>) => void;
};

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [tele, setTeleState] = useState<TeleprompterSettings>(DEFAULT_TELE);
  const [cam, setCamState] = useState<CameraSettings>(DEFAULT_CAM);

  useEffect(() => {
    (async () => {
      const t = await storage.getItem<TeleprompterSettings>(TELE_KEY, DEFAULT_TELE);
      const c = await storage.getItem<CameraSettings>(CAM_KEY, DEFAULT_CAM);
      if (t) setTeleState({ ...DEFAULT_TELE, ...t });
      if (c) setCamState({ ...DEFAULT_CAM, ...c });
    })();
  }, []);

  const setTele = useCallback((patch: Partial<TeleprompterSettings>) => {
    setTeleState((prev) => {
      let next = { ...prev, ...patch };
      // Only derive the counterpart when exactly one of the paired controls
      // changed — avoids fighting an explicit combined update.
      if (patch.wpm !== undefined && patch.speed === undefined) {
        next = { ...next, speed: speedFromWpm(next.wpm) };
      } else if (patch.speed !== undefined && patch.wpm === undefined) {
        next = { ...next, wpm: wpmFromSpeed(next.speed) };
      }
      storage.setItem(TELE_KEY, next);
      return next;
    });
  }, []);

  const setCam = useCallback((patch: Partial<CameraSettings>) => {
    setCamState((prev) => {
      const next = { ...prev, ...patch };
      storage.setItem(CAM_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ tele, cam, setTele, setCam }), [tele, cam, setTele, setCam]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error("SettingsProvider missing");
  return c;
}
