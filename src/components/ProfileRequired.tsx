import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useReducedMotion } from "../store/MotionContext";
import { colors, typography } from "../theme";

export function ProfileRequired({
  visible,
  intent = "create",
  onComplete,
  onBrowse,
}: {
  visible: boolean;
  intent?: "join" | "create";
  onComplete: () => void;
  onBrowse: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={onBrowse}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss profile prompt"
          style={StyleSheet.absoluteFill}
          onPress={onBrowse}
        />
        <SafeAreaView style={styles.position} edges={["top", "left", "right"]}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={styles.handle} accessible={false} />
              <View style={styles.topRow}>
                <View style={styles.symbol}>
                  <Icon name="user" size={27} color={colors.forest} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close profile prompt"
                  hitSlop={4}
                  onPress={onBrowse}
                  style={styles.close}
                >
                  <Icon name="x" size={22} color={colors.textDim} />
                </Pressable>
              </View>
              <Text style={styles.eyebrow}>YOUR NEARRY PROFILE</Text>
              <Text accessibilityRole="header" style={styles.title}>
                A quick hello first.
              </Text>
              <Text style={styles.copy}>
                {intent === "join"
                  ? "Let people know who’s joining. Add your name, gender and age before sending a request."
                  : "Let people know who’s hosting. Add your name, gender and age before sharing a plan."}
              </Text>
              <View style={styles.privacy}>
                <Icon name="lock" size={16} color={colors.textDim} />
                <Text style={styles.privacyText}>Your age stays private.</Text>
              </View>
              <Button title="Complete my profile" onPress={onComplete} />
              <Button
                title="Keep browsing"
                variant="ghost"
                onPress={onBrowse}
              />
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(8,37,27,0.38)" },
  position: { flex: 1, justifyContent: "flex-end", paddingTop: 24 },
  sheet: {
    maxHeight: "100%",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  content: { paddingHorizontal: 24, paddingTop: 10, gap: 12 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  symbol: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.sageSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  close: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    ...typography.caption,
    color: colors.goldDeep,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginTop: 6,
  },
  title: {
    ...typography.title,
    color: colors.forest,
    fontSize: 29,
    lineHeight: 35,
    letterSpacing: -0.8,
  },
  copy: { ...typography.body, color: colors.textDim, lineHeight: 25 },
  privacy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
  },
  privacyText: {
    ...typography.bodySmall,
    color: colors.textDim,
    flexShrink: 1,
  },
});
