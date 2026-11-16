import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../store/AuthContext";
import { useToast } from "../store/ToastContext";
import { useReducedMotion } from "../store/MotionContext";
import { enablePushNotifications } from "../services/notifications";
import {
  pushPromptCopy,
  pushPromptKey,
  shouldOfferPush,
} from "../utils/pushPrompt";
import { colors, typography, weight } from "../theme";
import { Button } from "./Button";
import { Icon } from "./Icon";

/**
 * A friendly "turn on notifications?" sheet, shown once per account after
 * sign-up and onboarding. "Allow" opens the phone's own permission dialog.
 */
export function NotificationPrompt() {
  const { profile, demoMode, onboardingCelebration } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const accountId = profile?.id;
  const readyAccount =
    !demoMode &&
    !!profile &&
    profile.onboardingCompleted &&
    !profile.suspendedAt &&
    !profile.deletionRequestedAt &&
    !onboardingCelebration;

  useEffect(() => {
    if (!readyAccount || !accountId || Platform.OS === "web") return;
    let active = true;
    // Let the first screen settle before asking.
    const timer = setTimeout(async () => {
      try {
        const [asked, permission] = await Promise.all([
          AsyncStorage.getItem(pushPromptKey(accountId)),
          Notifications.getPermissionsAsync(),
        ]);
        if (
          active &&
          shouldOfferPush({
            realDevice: Device.isDevice,
            readyAccount,
            alreadyAsked: asked !== null,
            permission,
          })
        )
          setVisible(true);
      } catch {
        /* Settings → Notifications stays available. */
      }
    }, 1200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [readyAccount, accountId]);

  if (!visible || !profile) return null;
  const copy = pushPromptCopy(profile.accountType);
  const finish = () => {
    setVisible(false);
    void AsyncStorage.setItem(
      pushPromptKey(profile.id),
      new Date().toISOString(),
    ).catch(() => {});
  };
  const allow = async () => {
    setBusy(true);
    try {
      await enablePushNotifications(profile.id);
      toast("Notifications are on", "bell");
    } catch {
      // Allowed on the phone but not connected (for example, a build without
      // push set up) is different from saying no.
      const { status } = await Notifications.getPermissionsAsync().catch(
        () => ({ status: "denied" as const }),
      );
      toast(
        status === "granted"
          ? "Couldn’t connect notifications. Try again in Settings."
          : "Notifications are off. Turn them on anytime in Settings.",
        "bell-off",
      );
    } finally {
      setBusy(false);
      finish();
    }
  };

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType={reduced ? "none" : "slide"}
      onRequestClose={finish}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          onPress={finish}
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.bell}>
            <Icon name="bell" size={30} color={colors.night} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>
          <Text style={styles.body}>{copy.body}</Text>
          <Button
            title="Allow notifications"
            variant="solid"
            loading={busy}
            onPress={() => void allow()}
            style={styles.allow}
          />
          <Button title="Not now" variant="ghost" onPress={finish} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(3,7,18,0.42)",
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.card,
  },
  bell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberBright,
    marginBottom: 16,
  },
  title: {
    ...typography.title,
    color: colors.ink,
    textAlign: "center",
    ...weight("800"),
  },
  body: {
    ...typography.body,
    color: colors.textDim,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  allow: { alignSelf: "stretch", marginBottom: 4 },
});
