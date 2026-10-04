import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useToast } from "@/src/components/Toast";
import { useI18n } from "@/src/i18n";
import { useLibrary, type Folder } from "@/src/store/library";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

function SheetShell({ visible, onClose, title, subtitle, children, testID }: { visible: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID={testID ? `${testID}-backdrop` : undefined} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID={testID}>
          <View style={styles.handle} />
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} testID={testID ? `${testID}-close` : undefined}>
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function NewFolderInput({ onCreate, testID }: { onCreate: (name: string) => void; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [name, setName] = useState("");
  function submit() {
    const n = name.trim();
    if (!n) return;
    onCreate(n);
    setName("");
  }
  return (
    <View style={styles.inputRow}>
      <Ionicons name="folder-open-outline" size={20} color={colors.muted} />
      <TextInput
        style={styles.input}
        placeholder={t("folders.placeholder")}
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
        returnKeyType="done"
        maxLength={40}
        testID={`${testID}-input`}
      />
      <Pressable onPress={submit} disabled={!name.trim()} style={[styles.addBtn, !name.trim() && { opacity: 0.4 }]} testID={`${testID}-add`}>
        <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

/** Create / rename / delete folders. */
export function FolderManager({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const { folders, scripts, createFolder, renameFolder, deleteFolder } = useLibrary();
  const [editing, setEditing] = useState<Folder | null>(null);
  const [editName, setEditName] = useState("");

  function commitRename() {
    if (editing && editName.trim()) renameFolder(editing.id, editName.trim());
    setEditing(null);
  }

  const count = (id: string) => scripts.filter((s) => s.folderId === id).length;

  return (
    <SheetShell visible={visible} onClose={onClose} title={t("folders.manage")} subtitle={t("folders.deleteHint")} testID="folder-manager">
      <NewFolderInput
        testID="folder-new"
        onCreate={(n) => {
          createFolder(n);
          toast.show(t("folders.created"), "success");
        }}
      />
      <FlatList
        data={folders}
        keyExtractor={(f) => f.id}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => {
          const isEditing = editing?.id === item.id;
          return (
            <View style={styles.row} testID={`folder-row-${item.id}`}>
              <Ionicons name="folder" size={20} color={colors.brand} />
              {isEditing ? (
                <TextInput
                  style={styles.rowInput}
                  value={editName}
                  onChangeText={setEditName}
                  autoFocus
                  onSubmitEditing={commitRename}
                  onBlur={commitRename}
                  returnKeyType="done"
                  maxLength={40}
                  testID={`folder-rename-input-${item.id}`}
                />
              ) : (
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowMeta}>{count(item.id)} {t("folders.scripts")}</Text>
                </View>
              )}
              {isEditing ? (
                <Pressable onPress={commitRename} hitSlop={8} style={styles.rowBtn} testID={`folder-rename-save-${item.id}`}>
                  <Ionicons name="checkmark" size={22} color={colors.success} />
                </Pressable>
              ) : (
                <>
                  <Pressable onPress={() => { setEditing(item); setEditName(item.name); }} hitSlop={8} style={styles.rowBtn} testID={`folder-rename-${item.id}`}>
                    <Ionicons name="pencil" size={18} color={colors.muted} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      deleteFolder(item.id);
                      toast.show(t("folders.deleted"), "success");
                    }}
                    hitSlop={8}
                    style={styles.rowBtn}
                    testID={`folder-delete-${item.id}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{t("folders.empty")}</Text>}
      />
    </SheetShell>
  );
}

/** Pick a destination folder for a script (or create one on the spot). */
export function FolderPicker({
  visible,
  onClose,
  currentFolderId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { folders, createFolder } = useLibrary();

  const options: { id: string | null; name: string }[] = [{ id: null, name: t("folders.none") }, ...folders];

  return (
    <SheetShell visible={visible} onClose={onClose} title={t("folders.move")} testID="folder-picker">
      <NewFolderInput
        testID="folder-picker-new"
        onCreate={(n) => {
          const f = createFolder(n);
          onSelect(f.id);
          onClose();
        }}
      />
      <FlatList
        data={options}
        keyExtractor={(o) => o.id ?? "none"}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => {
          const active = item.id === currentFolderId;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => {
                onSelect(item.id);
                onClose();
              }}
              testID={`folder-option-${item.id ?? "none"}`}
            >
              <Ionicons name={item.id ? "folder" : "folder-outline"} size={20} color={active ? colors.brand : colors.muted} />
              <Text style={[styles.rowText, { flex: 1 }, active && { color: colors.brand }]} numberOfLines={1}>{item.name}</Text>
              {active ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : null}
            </Pressable>
          );
        }}
      />
    </SheetShell>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    maxHeight: "80%",
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  headRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingLeft: spacing.md, paddingRight: 6, height: 50 },
  input: { flex: 1, color: colors.onSurface, fontSize: 15 },
  addBtn: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  list: { marginTop: spacing.md, flexGrow: 0 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, minHeight: 56 },
  pressed: { opacity: 0.7 },
  rowText: { color: colors.onSurface, fontSize: 16, fontWeight: "600" },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowInput: { flex: 1, color: colors.onSurface, fontSize: 16, fontWeight: "600", borderBottomWidth: 1, borderBottomColor: colors.brand, paddingVertical: 4 },
  rowBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: spacing.xl },
}));
