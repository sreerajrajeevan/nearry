import React, { useCallback, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Alert } from "../services/appAlert";
import { Screen } from "../components/Screen";
import { BackButton } from "../components/BackButton";
import { PageHeading } from "../components/PageHeading";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/EmptyState";
import { RowListSkeleton } from "../components/Skeletons";
import { colors, typography, spacing, surfaces } from "../theme";
import { useAuth } from "../store/AuthContext";
import type { AppNotification } from "../services/mappers";
import type { Cursor } from "../utils/pagination";
import { notificationTarget } from "../utils/notificationTarget";
import { timeAgo } from "../utils/format";
import {
  subscribeToNotifications,
  listNotificationPage,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
} from "../services/notifications";
function kindTone(kind: string): "neutral" | "green" | "red" {
  return ["request_approved", "booking_confirmed"].includes(kind)
    ? "green"
    : ["request_declined", "booking_cancelled"].includes(kind)
      ? "red"
      : "neutral";
}
const keyOf = (n: AppNotification) =>
  n.threadKey ? n.kind + ":" + n.threadKey : n.id;
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
    version = useRef(0),
    moreLock = useRef(false);
  const [items, setItems] = useState<AppNotification[]>([]),
    [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [cursor, setCursor] = useState<Cursor | null>(null),
    [more, setMore] = useState(false),
    [updates, setUpdates] = useState(false),
    [moreError, setMoreError] = useState("");
  const load = useCallback(
    async (silent = false) => {
      const ticket = ++version.current;
      if (!silent) setState("loading");
      try {
        const page = await listNotificationPage(null, updates);
        if (!focused.current || ticket !== version.current) return;
        setItems(page.items);
        setCursor(page.cursor);
        setMoreError("");
        setState("ready");
      } catch {
        if (focused.current && ticket === version.current && !silent)
          setState("error");
      }
    },
    [updates],
  );
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setItems([]);
      setCursor(null);
      void load();
      const stop = profile
        ? subscribeToNotifications(profile.id, () => void load(true))
        : () => {};
      const app = AppState.addEventListener("change", (s) => {
        if (s === "active") void load(true);
      });
      return () => {
        focused.current = false;
        ++version.current;
        stop();
        app.remove();
      };
    }, [load, profile?.id]),
  );
  const loadMore = async () => {
    if (!cursor || moreLock.current) return;
    moreLock.current = true;
    setMore(true);
    setMoreError("");
    const ticket = version.current;
    try {
      const page = await listNotificationPage(cursor, updates);
      if (!focused.current || ticket !== version.current) return;
      setItems((old) => {
        const map = new Map(old.map((n) => [keyOf(n), n]));
        for (const n of page.items) map.set(keyOf(n), n);
        return [...map.values()];
      });
      setCursor(page.cursor);
    } catch {
      if (focused.current && ticket === version.current)
        setMoreError("Could not load older updates. Please retry.");
    } finally {
      moreLock.current = false;
      if (focused.current) setMore(false);
    }
  };
  const run = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch {
      Alert.alert(
        "Could not update notifications",
        "Check your connection and try again.",
      );
    }
  };
  const open = async (n: AppNotification) => {
    if (!n.read)
      await run(async () => {
        await markNotificationRead(n.id);
        setItems((old) =>
          old.map((x) =>
            x.id === n.id ? { ...x, read: true, unreadCount: 0 } : x,
          ),
        );
      });
    if (profile) {
      const target = notificationTarget(n, profile.accountType);
      navigation.navigate(target.screen, target.params);
    }
  };
  return (
    <Screen>
      <FlatList
        data={state === "ready" ? items : []}
        keyExtractor={keyOf}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <>
            <BackButton onPress={() => navigation.goBack()} />
            <PageHeading
              compact
              title="Notifications"
              subtitle="The latest from your plans and people."
            />
            <View style={styles.headerActions}>
              <Button
                title="All"
                variant={updates ? "ghost" : "secondary"}
                onPress={() => setUpdates(false)}
              />
              <Button
                title="Plans & bookings"
                variant={updates ? "secondary" : "ghost"}
                onPress={() => setUpdates(true)}
              />
            </View>
            <View style={styles.headerActions}>
              <Button
                title="Mark all read"
                variant="ghost"
                onPress={() =>
                  void run(async () => {
                    await markAllNotificationsRead();
                    setItems((old) =>
                      old.map((n) => ({ ...n, read: true, unreadCount: 0 })),
                    );
                  })
                }
              />
              {items.length > 0 && (
                <Button
                  title="Clear"
                  variant="ghost"
                  onPress={() =>
                    Alert.alert(
                      "Clear notifications?",
                      "This removes your notification history.",
                      [
                        { text: "Keep", style: "cancel" },
                        {
                          text: "Clear",
                          style: "destructive",
                          onPress: () =>
                            void run(async () => {
                              await clearAllNotifications();
                              setItems([]);
                              setCursor(null);
                            }),
                        },
                      ],
                    )
                  }
                />
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          state === "loading" ? (
            <RowListSkeleton label="Loading notifications" />
          ) : state === "error" ? (
            <>
              <EmptyState
                title="Could not load notifications"
                hint="Check your connection and retry."
              />
              <Button title="Try again" onPress={() => void load()} />
            </>
          ) : (
            <EmptyState
              title="All quiet"
              hint="Your plans, bookings and conversations will show up here."
            />
          )
        }
        renderItem={({ item: n }) => (
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.rowMain}
              onPress={() => void open(n)}
              accessibilityRole="button"
              accessibilityLabel={n.title + ". " + n.body}
            >
              <Text style={styles.title}>{n.title}</Text>
              <Text style={styles.body}>{n.body}</Text>
              {(n.unreadCount ?? 0) > 1 && (
                <Text style={styles.time}>{n.unreadCount} unread messages</Text>
              )}
              <View style={styles.metaRow}>
                <Badge
                  label={n.kind.replace(/_/g, " ")}
                  tone={kindTone(n.kind)}
                />
                <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
              </View>
            </TouchableOpacity>
            <View>
              <TouchableOpacity
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel={n.read ? "Mark as unread" : "Mark as read"}
                onPress={() =>
                  void run(async () => {
                    await (n.read
                      ? markNotificationUnread(n.id)
                      : markNotificationRead(n.id));
                    setItems((old) =>
                      old.map((x) =>
                        x.id === n.id ? { ...x, read: !n.read } : x,
                      ),
                    );
                  })
                }
              >
                <Icon
                  name={n.read ? "circle" : "check-circle"}
                  size={19}
                  color={n.read ? colors.textDim : colors.accent}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel="Delete notification"
                onPress={() =>
                  void run(async () => {
                    await deleteNotification(n.id);
                    setItems((old) => old.filter((x) => x.id !== n.id));
                  })
                }
              >
                <Icon name="x" size={20} color={colors.textDim} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <>
            {moreError ? (
              <Text accessibilityRole="alert" style={styles.body}>
                {moreError}
              </Text>
            ) : null}
            {cursor && (
              <Button
                title={moreError ? "Retry older updates" : "Older updates"}
                loading={more}
                onPress={() => void loadMore()}
                variant="secondary"
              />
            )}
          </>
        }
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  row: {
    ...surfaces.card,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    marginBottom: 12,
  },
  rowMain: { flex: 1, paddingVertical: 6, minHeight: 52 },
  action: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.label, color: colors.text },
  body: { ...typography.bodySmall, color: colors.textDim, marginTop: 6 },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 12,
  },
  time: { ...typography.caption, color: colors.textDim, marginTop: 4 },
});
