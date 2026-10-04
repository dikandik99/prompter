import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, spacing, useTheme } from "@/src/theme";

export function Screen({
  title,
  subtitle,
  children,
  onBack,
  showBack,
  headerRight,
  scroll = true,
  contentStyle,
  testID,
  bottomInset = true,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  headerRight?: React.ReactNode;
  scroll?: boolean;
  contentStyle?: any;
  testID?: string;
  bottomInset?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const Header = title ? (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerRow}>
        {showBack ? (
          <Pressable
            testID="screen-back"
            hitSlop={10}
            onPress={() => (onBack ? onBack() : router.back())}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
        ) : null}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
      </View>
    </View>
  ) : null;

  const pad = { paddingBottom: bottomInset ? insets.bottom + spacing.xl : spacing.xl };

  return (
    <View style={[styles.container, { paddingTop: title ? 0 : insets.top }]} testID={testID}>
      {Header}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, pad, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backBtn: { marginLeft: -6 },
  titleWrap: { flex: 1 },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
}));
