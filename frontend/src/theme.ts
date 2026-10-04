// PROMPTERA design tokens — premium dark creator aesthetic with orange accent.
// Owned by PT Samudera Kreatif Indonesia.
//
// The app ships dark-only (a creator recording tool), so the single theme below
// holds the dark palette. Build sheets with makeStyles() and read colors via
// useTheme().colors for color props. Never write color literals in components.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  // Surfaces
  surface: "#111111", // app background
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1C1C1E", // cards, sheets, rows
  onSurfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#252525", // inputs, chips, elevated
  onSurfaceTertiary: "#FFFFFF",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#111111",
  muted: "#A0A0A0", // secondary text, captions, placeholders

  // Brand (orange)
  brand: "#FF9500",
  onBrand: "#0A0A0A",
  brandPrimary: "#FF9500",
  onBrandPrimary: "#0A0A0A",
  brandSecondary: "#FFB52E",
  onBrandSecondary: "#0A0A0A",
  brandTertiary: "#2A1F10", // subtle orange-tinted chip bg
  onBrandTertiary: "#FF9500",

  // Status
  success: "#34C759",
  onSuccess: "#0A0A0A",
  warning: "#FFB52E",
  onWarning: "#0A0A0A",
  error: "#FF3B30",
  onError: "#FFFFFF",
  info: "#0A84FF",
  onInfo: "#FFFFFF",

  // Lines
  border: "#2C2C2E",
  borderStrong: "#3A3A3C",
  divider: "#242426",

  // Extras (dark-only literals, safe)
  overlay: "rgba(0,0,0,0.55)",
  overlayStrong: "rgba(0,0,0,0.78)",
  recordRed: "#FF3B30",
  scrim: "rgba(17,17,17,0.72)",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark, light: dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Force dark regardless of device setting.
setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  useColorScheme();
  return { scheme: "dark", colors: themes.dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Spacing & radius tokens.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const typography = {
  display: { fontSize: 32, fontWeight: "800" as const },
  h1: { fontSize: 26, fontWeight: "800" as const },
  h2: { fontSize: 20, fontWeight: "700" as const },
  h3: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "500" as const },
  small: { fontSize: 13, fontWeight: "500" as const },
  tiny: { fontSize: 11, fontWeight: "600" as const },
};
