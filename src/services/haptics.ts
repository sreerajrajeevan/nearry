import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * A short vibration, only when something actually happened: a request sent,
 * someone approved, a plan posted, a booking confirmed, or an action failed.
 * Never on ordinary taps or scrolling.
 */
export function haptic(kind: "success" | "warning" | "error") {
  if (Platform.OS === "web") return;
  const type =
    kind === "success"
      ? Haptics.NotificationFeedbackType.Success
      : kind === "warning"
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Error;
  void Haptics.notificationAsync(type).catch(() => {});
}
