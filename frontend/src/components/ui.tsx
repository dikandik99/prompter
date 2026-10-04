import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
  size?: "md" | "lg";
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  testID,
  style,
  size = "lg",
}: ButtonProps) {
  const styles = useButtonStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const bg =
    variant === "primary"
      ? styles.primary
      : variant === "secondary"
      ? styles.secondary
      : variant === "danger"
      ? styles.danger
      : styles.ghost;
  const fg =
    variant === "primary"
      ? colors.onBrandPrimary
      : variant === "danger"
      ? colors.onError
      : variant === "secondary"
      ? colors.onSurfaceTertiary
      : colors.brand;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === "md" && styles.md,
        bg,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon as any} size={18} color={fg} /> : null}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const useButtonStyles = makeStyles((colors) => ({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 54,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
  },
  md: { height: 44, borderRadius: radius.md, paddingHorizontal: spacing.lg },
  primary: { backgroundColor: colors.brandPrimary },
  secondary: { backgroundColor: colors.surfaceTertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  danger: { backgroundColor: colors.error },
  ghost: { backgroundColor: "transparent" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  label: { fontSize: 16, fontWeight: "700" },
}));

export function IconButton({
  icon,
  onPress,
  size = 22,
  color,
  bg = true,
  testID,
  active,
}: {
  icon: string;
  onPress?: () => void;
  size?: number;
  color?: string;
  bg?: boolean;
  testID?: string;
  active?: boolean;
}) {
  const styles = useIconBtnStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        bg && styles.bg,
        active && styles.active,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon as any} size={size} color={color ?? (active ? colors.brand : colors.onSurface)} />
    </Pressable>
  );
}

const useIconBtnStyles = makeStyles((colors) => ({
  btn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  bg: { backgroundColor: colors.surfaceTertiary },
  active: { backgroundColor: colors.brandTertiary },
  pressed: { opacity: 0.7 },
}));

export function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const styles = useChipStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useChipStyles = makeStyles((colors) => ({
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  text: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  textActive: { color: colors.onBrandPrimary },
}));

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const styles = useMiscStyles();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
  testID,
}: {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  testID?: string;
}) {
  const styles = useMiscStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty} testID={testID}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as any} size={34} color={colors.brand} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{description}</Text>
      {ctaLabel ? (
        <Pressable style={styles.emptyCta} onPress={onCta} testID={testID ? `${testID}-cta` : undefined}>
          <Text style={styles.emptyCtaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({ children, style, onPress, testID }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; testID?: string }) {
  const styles = useMiscStyles();
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Badge({ label, tone = "brand" }: { label: string; tone?: "brand" | "success" | "muted" }) {
  const styles = useMiscStyles();
  return (
    <View style={[styles.badge, tone === "success" && styles.badgeSuccess, tone === "muted" && styles.badgeMuted]}>
      <Text style={[styles.badgeText, tone === "muted" && styles.badgeTextMuted]}>{label}</Text>
    </View>
  );
}

const useMiscStyles = makeStyles((colors) => ({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  sectionAction: { color: colors.brand, fontSize: 14, fontWeight: "600" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700", marginBottom: spacing.xs },
  emptyDesc: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: spacing.lg },
  emptyCta: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    height: 48,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCtaText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 15 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  badge: {
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeSuccess: { backgroundColor: colors.success },
  badgeMuted: { backgroundColor: colors.surfaceTertiary },
  badgeText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  badgeTextMuted: { color: colors.muted },
}));
