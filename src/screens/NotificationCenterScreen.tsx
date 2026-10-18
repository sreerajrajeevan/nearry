import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  AppState,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { colors, typography, spacing } from "../theme";
import {
  subscribeToNotifications,
  listNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
} from "../services/notifications";
import { useAuth } from "../store/AuthContext";
import { AppNotification } from "../services/mappers";
import { notificationTarget } from "../utils/notificationTarget";

function kindTone(kind: string): "neutral" | "green" | "red" {
  if (kind === "request_approved" || kind === "booking_confirmed")
    return "green";
  if (kind === "request_declined" || kind === "booking_cancelled") return "red";
  return "neutral";
}

function kindLabel(kind: string): string {
  return kind.replace(/_/g, " ").toUpperCase();
}

/** In-app notification center with read/unread states. Shared by both lanes. */
export function NotificationCenterScreen({
  navigation,
}: {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}) {
  const { profile } = useAuth();
  const focused = useRef(false),
    version = useRef(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async (silent = false) => {
    const ticket = ++version.current;
    if (!silent) setState("loading");
    try {
      const result = await listNotifications();
      if (!focused.current || ticket !== version.current) return;
      setItems(result);
      setState("ready");
    } catch {
      if (focused.current && ticket === version.current && !silent)
        setState("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void load();
      const refresh = () => void load(true);
      const stop = profile
        ? subscribeToNotifications(profile.id, refresh)
        : () => {};
      const appState = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      const timer = setInterval(refresh, 30000);
      return () => {
        focused.current = false;
        ++version.current;
        stop();
        appState.remove();
        clearInterval(timer);
      };
    }, [load, profile?.id]),
  );

  const onOpen = async (n: AppNotification) => {
    if (!n.read) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
        );
      } catch {
        Alert.alert(
          "Could not mark as read",
          "Check your connection and try again.",
        );
      }
    }
    if (profile) {
      const target = notificationTarget(n, profile.accountType);
      navigation.navigate(target.screen, target.params);
    }
  };

  const onMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      await load(true);
    } catch {
      Alert.alert(
        "Could not mark all as read",
        "Check your connection and try again.",
      );
    }
  };

  const onToggleRead = async (n: AppNotification) => {
    try {
      if (n.read) {
        await markNotificationUnread(n.id);
      } else {
        await markNotificationRead(n.id);
      }
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: !x.read } : x)),
      );
    } catch {
      Alert.alert("Could not update", "Check your connection and try again.");
    }
  };

  const onDelete = async (n: AppNotification) => {
    try {
      await deleteNotification(n.id);
      setItems((prev) => prev.filter((x) => x.id !== n.id));
    } catch {
      Alert.alert("Could not delete", "Check your connection and try again.");
    }
  };

  const onClearAll = () => {
    Alert.alert(
      "Clear all notifications?",
      "This deletes every notification. You can't undo it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllNotifications();
              setItems([]);
            } catch {
              Alert.alert(
                "Could not clear",
                "Check your connection and try again.",
              );
            }
          },
        },
      ],
    );
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={{ marginBottom: spacing.md }}
        >
          <Text style={{ ...typography.label, color: colors.textDim }}>
            ← Back
          </Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Notifications</Text>
          <View style={styles.headerActions}>
            {unread > 0 && (
              <TouchableOpacity onPress={onMarkAll} activeOpacity={0.7}>
                <Text style={styles.markAll}>Mark all read</Text>
              </TouchableOpacity>
            )}
            {items.length > 0 && (
              <TouchableOpacity onPress={onClearAll} activeOpacity={0.7}>
                <Text style={styles.clearAll}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {state === "loading" ? (
          <Text style={styles.status}>Loading…</Text>
        ) : state === "error" ? (
          <View>
            <EmptyState
              title="Couldn't load notifications"
              hint="Check your connection and retry."
            />
            <Button title="Retry" onPress={() => void load()} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            title="All quiet"
            hint="Join requests, bookings and messages will show up here."
          />
        ) : (
          items.map((n) => (
            <View key={n.id} style={styles.row}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onOpen(n)}
                style={styles.rowMain}
              >
                <View style={styles.topRow}>
                  <Text style={styles.title}>{n.title}</Text>
                  <TouchableOpacity
                    onPress={() => onToggleRead(n)}
                    activeOpacity={0.7}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      n.read ? "Mark as unread" : "Mark as read"
                    }
                  >
                    <View style={[styles.dot, n.read && styles.dotRead]} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.body}>{n.body}</Text>
                <View style={styles.metaRow}>
                  <Badge label={kindLabel(n.kind)} tone={kindTone(n.kind)} />
                  <Text style={styles.time}>
                    {new Date(n.createdAt).toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete(n)}
                activeOpacity={0.7}
                hitSlop={8}
                style={styles.deleteBtn}
                accessibilityRole="button"
                accessibilityLabel="Delete notification"
              >
                <Text style={styles.deleteText}>×</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  header: { ...typography.title, color: colors.text },
  markAll: { ...typography.label, color: colors.accent },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  row: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  dotRead: { backgroundColor: colors.border },
  headerActions: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  clearAll: { ...typography.label, color: colors.textDim },
  rowMain: { flex: 1 },
  deleteBtn: {
    justifyContent: "center",
    paddingLeft: spacing.sm,
  },
  deleteText: {
    ...typography.title,
    color: colors.textFaint,
    lineHeight: 20,
  },
  title: { ...typography.body, color: colors.text, flex: 1 },
  body: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  time: {
    ...typography.caption,
    color: colors.textFaint,
  },
});
