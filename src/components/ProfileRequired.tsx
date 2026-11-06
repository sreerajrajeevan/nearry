import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./Button";
import { colors, typography } from "../theme";
export function ProfileRequired({
  visible,
  onComplete,
  onBrowse,
}: {
  visible: boolean;
  onComplete: () => void;
  onBrowse: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onBrowse}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>
            A little about you first
          </Text>
          <Text style={styles.copy}>
            Add your name, gender and age before creating or joining a plan. You
            can keep exploring without completing your profile.
          </Text>
          <Button title="Complete my profile" onPress={onComplete} />
          <Button title="Keep browsing" variant="ghost" onPress={onBrowse} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(12,59,46,0.5)",
  },
  card: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: colors.card,
    gap: 16,
  },
  title: { ...typography.title, color: colors.text },
  copy: { ...typography.body, color: colors.textDim },
});
