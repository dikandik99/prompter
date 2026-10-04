import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export type SheetAction = {
  label: string;
  icon: string;
  destructive?: boolean;
  onPress: () => void;
};

export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="sheet-backdrop">
        <Animated.View entering={FadeInDown} style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {actions.map((a, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => {
                onClose();
                setTimeout(a.onPress, 60);
              }}
              testID={`sheet-action-${a.icon}`}
            >
              <Ionicons name={a.icon as any} size={22} color={a.destructive ? colors.error : colors.onSurface} />
              <Text style={[styles.rowText, a.destructive && { color: colors.error }]}>{a.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  title: { color: colors.muted, fontSize: 13, fontWeight: "700", paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md },
  pressed: { backgroundColor: colors.surfaceTertiary },
  rowText: { color: colors.onSurface, fontSize: 16, fontWeight: "600" },
}));
