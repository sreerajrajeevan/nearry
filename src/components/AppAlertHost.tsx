import React, { useEffect, useRef, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { appAlerts } from "../services/appAlert";
import { useReducedMotion } from "../store/MotionContext";
import { colors, typography } from "../theme";
import { Icon } from "./Icon";
import { MotionPressable } from "./Motion";

/** Mounted once outside navigation so account changes cannot hide their own notice. */
export function AppAlertHost() {
  const current = useSyncExternalStore(
    appAlerts.subscribe,
    appAlerts.getSnapshot,
    appAlerts.getSnapshot,
  );
  const reducedMotion = useReducedMotion();
  const titleRef = useRef<View>(null);
  useEffect(() => {
    if (!current) return;
    Keyboard.dismiss();
    // Also refocus when the next queued dialog replaces an already open one.
    const timer = setTimeout(
      () => {
        if (Platform.OS === "web") titleRef.current?.focus();
        else {
          const node = findNodeHandle(titleRef.current);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        }
      },
      reducedMotion ? 50 : 300,
    );
    return () => clearTimeout(timer);
  }, [current?.id, reducedMotion]);

  if (!current) return null;
  const destructive = current.buttons.some(
    (button) => button.style === "destructive",
  );
  const actions = current.buttons.map((button, index) => ({ button, index }));
  // Keep the affirmative action above Cancel, without changing which callback is selected.
  actions.sort(
    (a, b) =>
      Number(a.button.style === "cancel") - Number(b.button.style === "cancel"),
  );
  const dismiss = () => appAlerts.dismiss(current.id);
  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={dismiss}
    >
      <View style={styles.overlay}>
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
        />
        <SafeAreaView style={styles.position} pointerEvents="box-none">
          <View style={styles.card} accessibilityViewIsModal>
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
            >
              <View style={styles.topRow}>
                <View
                  style={[styles.symbol, destructive && styles.dangerSymbol]}
                >
                  <Icon
                    name={destructive ? "alert-circle" : "info"}
                    size={25}
                    color={destructive ? colors.red : colors.forest}
                  />
                </View>
                <Text style={styles.eyebrow}>NEARRY</Text>
              </View>
              <View
                ref={titleRef}
                accessible
                accessibilityRole="header"
                tabIndex={-1}
              >
                <Text style={styles.title}>{current.title}</Text>
              </View>
              {!!current.message && (
                <Text style={styles.message}>{current.message}</Text>
              )}
              <View style={styles.actions}>
                {actions.map(({ button, index }) => (
                  <MotionPressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={button.text || "Got it"}
                    onPress={() => appAlerts.choose(current.id, index)}
                    style={[
                      styles.button,
                      button.style === "cancel"
                        ? styles.cancel
                        : button.style === "destructive"
                          ? styles.destructive
                          : styles.primary,
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        button.style === "cancel" && styles.cancelText,
                        button.style !== "cancel" &&
                          button.style !== "destructive" && {
                            color: colors.onAction,
                          },
                      ]}
                    >
                      {button.text || "Got it"}
                    </Text>
                  </MotionPressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.modalScrim },
  position: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "100%",
    backgroundColor: colors.background,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  content: { padding: 24 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  symbol: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.sageSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerSymbol: { backgroundColor: colors.dangerSoft },
  eyebrow: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.textDim,
  },
  title: { ...typography.title, color: colors.forest, marginBottom: 10 },
  message: { ...typography.body, color: colors.textDim, lineHeight: 24 },
  actions: { gap: 8, marginTop: 24 },
  button: {
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  primary: { backgroundColor: colors.action },
  destructive: { backgroundColor: colors.red },
  cancel: { backgroundColor: colors.sageSoft },
  buttonText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.onAccent,
    textAlign: "center",
    flexShrink: 1,
  },
  cancelText: { color: colors.forest },
});
