import React, { useCallback, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Alert } from "../services/appAlert";
import { Screen } from "../components/Screen";
import { BackButton } from "../components/BackButton";
import { Button } from "../components/Button";
import { FilterTabs } from "../components/FilterTabs";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/EmptyState";
import { RowListSkeleton } from "../components/Skeletons";
import { colors, typography, spacing, weight } from "../theme";
import { useAuth } from "../store/AuthContext";
import type { AppNotification } from "../services/mappers";
import type { Cursor } from "../utils/pagination";
import { notificationTarget } from "../utils/notificationTarget";
import { timeAgo } from "../utils/format";
import {
  filterNotifications,
  filtersFor,
  groupNotificationsByDay,
  notificationLook,
  rowTime,
  type NotificationFilter,
} from "../utils/notificationGroups";
import {
  subscribeToNotifications,
  listNotificationPage,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
} from "../services/notifications";
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
    [filter, setFilter] = useState<NotificationFilter>("all"),
    [moreError, setMoreError] = useState("");
  // Plans and Bookings only need non-message notices, which the server can
  // page on its own; the chips then narrow the loaded notices further.
  const updates = filter === "plans" || filter === "bookings";
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
  const filters = filtersFor(
    profile?.accountType === "business" ? "business" : "personal",
  );
  const visible = filterNotifications(items, filter);
  const sections = groupNotificationsByDay(visible, new Date());
  const unread = items.some((n) => !n.read);
  const toggleRead = (n: AppNotification) =>
    void run(async () => {
      await (n.read
        ? markNotificationUnread(n.id)
        : markNotificationRead(n.id));
      setItems((old) =>
        old.map((x) =>
          x.id === n.id ? { ...x, read: !n.read, unreadCount: 0 } : x,
        ),
      );
    });
  const remove = (n: AppNotification) =>
    void run(async () => {
      await deleteNotification(n.id);
      setItems((old) => old.filter((x) => x.id !== n.id));
    });
  const rowMenu = (n: AppNotification) =>
    Alert.alert(n.title, undefined, [
      {
        text: n.read ? "Mark as unread" : "Mark as read",
        onPress: () => toggleRead(n),
      },
      { text: "Remove", style: "destructive", onPress: () => remove(n) },
      { text: "Cancel", style: "cancel" },
    ]);
  const clearAll = () =>
    Alert.alert(
      "Clear all notifications?",
      "This removes your notification history.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: () =>
            void run(async () => {
              await clearAllNotifications();
              setItems([]);
              setCursor(null);
            }),
        },
      ],
    );
  const emptyHint: Record<NotificationFilter, string> = {
    all: "Your plans, bookings and conversations will show up here.",
    plans: "Requests, approvals and plan changes will show up here.",
    bookings: "Booking requests and confirmations will show up here.",
    messages: "New chat messages will show up here.",
  };
  return (
    <Screen>
      <SectionList
        sections={state === "ready" ? sections : []}
        keyExtractor={keyOf}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <>
            <View style={styles.topBar}>
              <BackButton onPress={() => navigation.goBack()} />
              <View style={styles.topActions}>
                {unread && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() =>
                      void run(async () => {
                        await markAllNotificationsRead();
                        setItems((old) =>
                          old.map((n) => ({
                            ...n,
                            read: true,
                            unreadCount: 0,
                          })),
                        );
                      })
                    }
                    style={styles.textAction}
                  >
                    <Text style={styles.textActionLabel}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                {items.length > 0 && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="More options"
                    onPress={clearAll}
                    style={styles.iconAction}
                  >
                    <Icon name="more-vertical" size={20} color={colors.text} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <Text accessibilityRole="header" style={styles.heading}>
              Notifications
            </Text>
            <FilterTabs
              label="Show notifications"
              options={filters}
              selected={filter}
              onSelect={setFilter}
            />
          </>
        }
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={styles.section}>
            {section.title.toUpperCase()}
          </Text>
        )}
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
            <EmptyState title="You're all caught up" hint={emptyHint[filter]} />
          )
        }
        renderItem={({ item: n }) => {
          const look = notificationLook(n.kind);
          const count = n.unreadCount ?? 0;
          return (
            <TouchableOpacity
              style={[styles.row, !n.read && styles.rowUnread]}
              onPress={() => void open(n)}
              onLongPress={() => rowMenu(n)}
              delayLongPress={350}
              accessibilityRole="button"
              accessibilityLabel={`${n.read ? "" : "Unread. "}${n.title}. ${n.body}. ${timeAgo(n.createdAt)}`}
              accessibilityHint="Opens it. Hold for more options."
              accessibilityActions={[
                { name: "longpress", label: "More options" },
              ]}
              onAccessibilityAction={() => rowMenu(n)}
            >
              <View style={[styles.iconCircle, { backgroundColor: look.bg }]}>
                <Icon name={look.icon} size={19} color={look.fg} />
              </View>
              <View style={styles.rowMain}>
                <Text
                  style={[styles.title, !n.read && styles.titleUnread]}
                  numberOfLines={1}
                >
                  {n.title}
                </Text>
                {!!n.body && (
                  <Text style={styles.body} numberOfLines={2}>
                    {n.body}
                  </Text>
                )}
                {count > 1 && (
                  <Text style={styles.count}>{count} new messages</Text>
                )}
              </View>
              <View style={styles.rowSide}>
                <Text style={styles.time}>
                  {rowTime(n.createdAt, new Date())}
                </Text>
                {!n.read && <View style={styles.dot} />}
              </View>
            </TouchableOpacity>
          );
        }}
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topActions: { flexDirection: "row", alignItems: "center" },
  textAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  textActionLabel: { ...typography.label, color: colors.amberDeep },
  iconAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    ...typography.title,
    color: colors.text,
    marginTop: 4,
    marginBottom: 12,
  },
  section: {
    ...typography.caption,
    letterSpacing: 0.8,
    color: colors.textDim,
    marginTop: 14,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 4,
    borderRadius: 14,
  },
  rowUnread: { backgroundColor: "#FFFBEB" },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: { flex: 1, minWidth: 0 },
  title: { ...typography.body, color: colors.text, ...weight("500") },
  titleUnread: { ...weight("700") },
  body: { ...typography.bodySmall, color: colors.textDim, marginTop: 2 },
  count: {
    ...typography.caption,
    color: colors.amberDeep,
    marginTop: 4,
    ...weight("700"),
  },
  rowSide: { alignItems: "flex-end", gap: 8, minWidth: 44 },
  time: { ...typography.caption, color: colors.textDim },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.amberBright,
  },
});
