import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { colors, typography, spacing } from "../theme";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notifications";
import { AppNotification } from "../services/mappers";

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
export function NotificationCenterScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      setItems(await listNotifications());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onOpen = async (n: AppNotification) => {
    if (!n.read) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
        );
      } catch {
        /* keep unread */
      }
    }
  };

  const onMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    } catch {
      /* ignore */
    }
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.headerRow}>
          <Text style={styles.header}>Notifications</Text>
          {unread > 0 && (
            <TouchableOpacity onPress={onMarkAll} activeOpacity={0.7}>
              <Text style={styles.markAll}>Mark all read</Text>
            </TouchableOpacity>
          )}
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
            <TouchableOpacity
              key={n.id}
              activeOpacity={0.9}
              onPress={() => onOpen(n)}
            >
              <Card style={[styles.card, !n.read && styles.unreadCard]}>
                <View style={styles.topRow}>
                  <Badge label={kindLabel(n.kind)} tone={kindTone(n.kind)} />
                  {!n.read && <View style={styles.dot} />}
                </View>
                <Text style={styles.title}>{n.title}</Text>
                <Text style={styles.body}>{n.body}</Text>
                <Text style={styles.time}>
                  {new Date(n.createdAt).toLocaleString()}
                </Text>
              </Card>
            </TouchableOpacity>
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
  markAll: { ...typography.label, color: colors.red },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  card: { marginBottom: spacing.sm },
  unreadCard: { borderColor: colors.borderStrong },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  title: { ...typography.heading, color: colors.text, marginTop: spacing.sm },
  body: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  time: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: spacing.sm,
  },
});
