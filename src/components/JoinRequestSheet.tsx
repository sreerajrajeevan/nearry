import { SheetGrabber, useSheetDrag } from "./SheetDrag";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { JOIN_NOTE_MAX } from "../services/joinRequests";
import { colors, radius, typography, weight } from "../theme";

/** Confirms a join request with an optional note that only the host sees. */
export function JoinRequestSheet({
  visible,
  planTitle,
  hostName,
  placeholder = "Anything the host should know? e.g. I’ll bring the football",
  sending = false,
  error = "",
  initialNote = "",
  onSend,
  onClose,
}: {
  visible: boolean;
  planTitle: string;
  hostName: string;
  placeholder?: string;
  sending?: boolean;
  error?: string;
  initialNote?: string;
  onSend: (note: string) => void;
  onClose: () => void;
}) {
  const drag = useSheetDrag(onClose);
  const [note, setNote] = useState(initialNote);
  // A failed send reopens with what they wrote.
  useEffect(() => {
    if (visible) setNote(initialNote);
  }, [visible, initialNote]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={sending ? undefined : onClose}
        />
        <Animated.View style={drag.style}>
          <SafeAreaView
            edges={["bottom", "left", "right"]}
            style={styles.sheet}
            accessibilityViewIsModal
          >
            <SheetGrabber handlers={drag.handlers} />
            <Text style={styles.title}>Ask to join</Text>
            <Text style={styles.plan} numberOfLines={2}>
              {planTitle}
            </Text>
            <Text style={styles.label}>Message to {hostName} (optional)</Text>
            <TextInput
              accessibilityLabel={`Message to ${hostName}, optional`}
              value={note}
              onChangeText={setNote}
              placeholder={placeholder}
              placeholderTextColor={colors.textFaint}
              maxLength={JOIN_NOTE_MAX}
              multiline
              editable={!sending}
              style={styles.input}
              textAlignVertical="top"
            />
            <View style={styles.metaRow}>
              <Icon name="lock" size={13} color={colors.textDim} />
              <Text style={styles.meta}>
                Only the host sees this, with your request.
              </Text>
              <Text style={styles.count}>
                {note.length}/{JOIN_NOTE_MAX}
              </Text>
            </View>
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Button
              title="Send request"
              loading={sending}
              onPress={() => onSend(note)}
            />
            <Button
              title="Cancel"
              variant="ghost"
              disabled={sending}
              onPress={onClose}
            />
          </SafeAreaView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(3,7,18,0.55)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  title: { fontSize: 20, ...weight("800"), color: colors.text },
  plan: { ...typography.body, color: colors.textDim, marginBottom: 10 },
  label: { fontSize: 13, ...weight("600"), color: colors.text },
  input: {
    minHeight: 96,
    maxHeight: 160,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: colors.text,
    ...weight("400"),
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  meta: { ...typography.caption, color: colors.textDim, flex: 1 },
  count: { ...typography.caption, color: colors.textDim },
  error: { ...typography.bodySmall, color: colors.red, marginBottom: 4 },
});
