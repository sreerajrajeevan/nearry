import React, { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./Button";
import { Icon, IconName } from "./Icon";
import { colors, spacing, typography } from "../theme";
import { deleteConversation } from "../services/chat";
import { blockUser } from "../services/safety";

type Props = {
  conversationId: string;
  otherUserId?: string;
  name: string;
  onClose: () => void;
  onReport: () => void;
  onChanged: (action: "delete" | "block") => void;
};

/** Shared by both inboxes and the conversation toolbar; no nested touch targets. */
export function ConversationActions({
  conversationId,
  otherUserId,
  name,
  onClose,
  onReport,
  onChanged,
}: Props) {
  const [confirm, setConfirm] = useState<"delete" | "block" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const close = () => {
    if (!lock.current) onClose();
  };
  const perform = async () => {
    if (!confirm || lock.current) return;
    const action = confirm;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (action === "delete") await deleteConversation(conversationId);
      else if (otherUserId) await blockUser(otherUserId, true, name);
      else
        throw new Error(
          "Person unavailable. Reopen this conversation and try again.",
        );
      onChanged(action);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not complete this action. Please retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const option = (
    label: string,
    hint: string,
    icon: IconName,
    onPress: () => void,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
    >
      <Icon name={icon} color={colors.text} size={21} />
      <View style={styles.optionText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Icon name="chevron-right" size={18} />
    </Pressable>
  );
  return (
    <Modal transparent visible animationType="slide" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close conversation options"
          onPress={close}
        />
        <SafeAreaView
          edges={["bottom", "left", "right"]}
          style={styles.sheet}
          accessibilityViewIsModal
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={styles.handle} />
            <Text accessibilityRole="header" style={styles.title}>
              {confirm === "delete"
                ? "Delete conversation?"
                : confirm === "block"
                  ? `Block ${name}?`
                  : name}
            </Text>
            {confirm ? (
              <>
                <Text style={styles.copy}>
                  {confirm === "delete"
                    ? "This removes the conversation and its current messages only for you. The other person keeps their history. New messages will bring the chat back."
                    : "Their plans and chats will be hidden. New messages, requests and bookings between you will stop. Existing commitments remain in Activity or Bookings. You can unblock them in Safety & privacy."}
                </Text>
                {!!error && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                )}
                <Button
                  title={
                    confirm === "delete" ? "Delete for me" : "Confirm block"
                  }
                  variant="danger"
                  loading={busy}
                  onPress={() => void perform()}
                />
                <Button
                  title="Cancel"
                  variant="ghost"
                  disabled={busy}
                  onPress={close}
                />
              </>
            ) : (
              <>
                {option(
                  "Report conversation",
                  "Tell us about a concern in this chat",
                  "flag",
                  onReport,
                )}
                {!!otherUserId &&
                  option(
                    "Block person",
                    "Stop new contact from this person",
                    "slash",
                    () => setConfirm("block"),
                  )}
                {option(
                  "Delete conversation",
                  "Clear this chat only for you",
                  "trash-2",
                  () => setConfirm("delete"),
                )}
                <Button title="Cancel" variant="ghost" onPress={close} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.modalScrim,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "90%",
  },
  content: { padding: spacing.lg, gap: spacing.sm },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.borderStrong,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: { flex: 1, minWidth: 0 },
  label: { ...typography.heading, color: colors.text },
  hint: { ...typography.bodySmall, color: colors.textDim, marginTop: 2 },
  copy: { ...typography.body, color: colors.textDim, marginBottom: spacing.md },
  error: { ...typography.bodySmall, color: colors.red },
  pressed: { backgroundColor: colors.sageSoft },
});
