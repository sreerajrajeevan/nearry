import { ConversationActions } from "../../components/ConversationActions";
import { LoadingState } from "../../components/LoadingState";
import React, { useCallback, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing, radius } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { Alert } from "../../services/appAlert";
import { subscribeToNotifications } from "../../services/notifications";
import { onUnreadChanged } from "../../services/unreadEvents";
import { listConversations } from "../../services/chat";
import {
  approveRequest,
  declineRequest,
  listPendingRequestsForHost,
  HostJoinRequest,
} from "../../services/joinRequests";
import { Conversation } from "../../services/mappers";

type Props = {
  navigation: {
    goBack?: () => void;
    canGoBack?: () => boolean;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
};

type TabKey = "all" | "plans" | "bookings" | "requests";

/** Mockup-style time: "4 min", then the clock time today, then the date. */
function chatTime(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (!Number.isFinite(then.getTime())) return "";
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min`;
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86400000);
  if (days === 0)
    return then.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  return then.toLocaleDateString([], { day: "numeric", month: "short" });
}

function dayLabel(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (!Number.isFinite(then.getTime())) return "";
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(then) - startOfDay(new Date())) / 86400000);
  const time = then.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  return (
    then.toLocaleDateString([], {
      weekday: "short",
      day: "numeric",
      month: "short",
    }) + ` · ${time}`
  );
}

function requestedAgo(iso?: string): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Shared chat list for personal + business lanes. */
export function ChatListScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const focused = useRef(false),
    version = useRef(0);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<HostJoinRequest[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [tab, setTab] = useState<TabKey>("all");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const isPersonal = profile?.account_type !== "business";

  const load = useCallback(
    async (silent = false) => {
      const ticket = ++version.current;
      if (!silent) setState("loading");
      try {
        const result = await listConversations();
        if (!focused.current || ticket !== version.current) return;
        setConversations(result);
        setState("ready");
      } catch {
        if (focused.current && ticket === version.current && !silent)
          setState("error");
      }
      // Pending join requests are best-effort: a failure there must never
      // hide the chats, so it is loaded separately and quietly.
      if (profile?.id && profile.account_type === "personal") {
        try {
          const pending = await listPendingRequestsForHost(profile.id);
          if (focused.current && ticket === version.current)
            setRequests(pending);
        } catch {
          // Keep whatever requests were already shown.
        }
      }
    },
    [profile?.id, profile?.account_type],
  );

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setSelected(null);
      void load();
      const refresh = () => void load(true);
      const stop = profile
        ? subscribeToNotifications(profile.id, refresh)
        : () => {};
      const stopLocal = onUnreadChanged(refresh);
      const appState = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      const timer = setInterval(refresh, 30000);
      return () => {
        focused.current = false;
        ++version.current;
        stop();
        stopLocal();
        appState.remove();
        clearInterval(timer);
      };
    }, [load, profile?.id]),
  );

  const actOnRequest = async (key: string, fn: () => Promise<unknown>) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await fn();
      await load(true);
    } catch (e) {
      Alert.alert(
        "Could not update this request",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const q = query.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  const visibleRequests = requests.filter(
    (r) => matches(r.requesterName) || matches(r.postTitle),
  );
  const visibleChats = conversations.filter((c) => {
    if (!matches(c.otherName) && !matches(c.contextTitle)) return false;
    if (tab === "plans") return !!c.postId;
    if (tab === "bookings") return !!c.bookingId;
    if (tab === "requests") return false;
    return true;
  });
  const showRequests =
    (tab === "all" && visibleRequests.length > 0) || tab === "requests";
  const showChats = tab !== "requests";

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "all", label: "All" },
    ...(isPersonal ? [{ key: "plans" as TabKey, label: "Plans" }] : []),
    { key: "bookings", label: "Bookings" },
    ...(isPersonal
      ? [
          {
            key: "requests" as TabKey,
            label: "Requests",
            badge: requests.length,
          },
        ]
      : []),
  ];

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {navigation.canGoBack?.() && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
            onPress={() => navigation.goBack?.()}
          >
            <Icon name="arrow-left" size={16} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerRow}>
          <Text accessibilityRole="header" style={styles.title}>
            Messages
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={searching ? "Close search" : "Search messages"}
            style={styles.iconBtn}
            onPress={() => {
              if (searching) setQuery("");
              setSearching(!searching);
            }}
          >
            <Icon
              name={searching ? "x" : "search"}
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
        {searching && (
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search names and plans"
            placeholderTextColor={colors.textFaint}
            autoFocus
            returnKeyType="search"
          />
        )}
        <View style={styles.tabRow}>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.tabPill, active && styles.tabPillActive]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
                {!!t.badge && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {t.badge > 99 ? "99+" : t.badge}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {state === "loading" ? (
          <LoadingState label="Loading conversations…" layout="list" />
        ) : state === "error" ? (
          <View>
            <EmptyState
              title="Couldn't load chats"
              hint="Check your connection and retry."
            />
            <Button title="Retry" onPress={() => void load()} />
          </View>
        ) : (
          <>
            {showRequests && (
              <>
                <Text style={styles.sectionLabel}>Requests</Text>
                {visibleRequests.length === 0 ? (
                  <EmptyState
                    title="No pending requests"
                    hint="New join requests for your plans will appear here."
                  />
                ) : (
                  visibleRequests.map((r) => (
                    <View key={r.id} style={styles.reqCard}>
                      <View style={styles.reqTop}>
                        <Avatar name={r.requesterName} size={44} tone="clay" />
                        <View style={styles.text}>
                          <Text style={styles.reqTitle} numberOfLines={2}>
                            <Text style={styles.reqName}>
                              {r.requesterName}
                            </Text>{" "}
                            wants to join
                          </Text>
                          <Text style={styles.reqPlan} numberOfLines={1}>
                            {r.postTitle}
                            {r.postStartsAt
                              ? ` · ${dayLabel(r.postStartsAt)}`
                              : ""}
                          </Text>
                          <Text style={styles.reqMeta} numberOfLines={1}>
                            {[r.postVenueName, `Requested ${requestedAgo(r.createdAt)}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.reqActions}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Decline ${r.requesterName}`}
                          style={styles.declineBtn}
                          disabled={busyKey !== null}
                          onPress={() =>
                            void actOnRequest(`d${r.id}`, () =>
                              declineRequest(r.id),
                            )
                          }
                        >
                          <Text style={styles.declineText}>
                            {busyKey === `d${r.id}` ? "…" : "Decline"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Accept ${r.requesterName}`}
                          style={styles.acceptBtn}
                          disabled={busyKey !== null}
                          onPress={() =>
                            void actOnRequest(`a${r.id}`, () =>
                              approveRequest(r.id),
                            )
                          }
                        >
                          <Text style={styles.acceptText}>
                            {busyKey === `a${r.id}` ? "…" : "Accept"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
            {showChats && (
              <>
                {(showRequests || tab !== "all") && (
                  <Text style={styles.sectionLabel}>Chats</Text>
                )}
                {visibleChats.length === 0 ? (
                  <EmptyState
                    title={
                      q
                        ? "No matches"
                        : tab === "plans"
                          ? "No plan chats yet"
                          : tab === "bookings"
                            ? "No booking chats yet"
                            : "No conversations"
                    }
                    hint={
                      q
                        ? "Try a different name or plan."
                        : "Approve a join request or confirm a booking to start chatting."
                    }
                  />
                ) : (
                  visibleChats.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.chatCard}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.otherName}. ${c.contextTitle}${c.unreadCount > 0 ? `. ${c.unreadCount} unread message${c.unreadCount === 1 ? "" : "s"}` : ""}`}
                      accessibilityHint="Double tap to open. Long press for conversation options."
                      accessibilityActions={[
                        { name: "longpress", label: "Conversation options" },
                      ]}
                      onAccessibilityAction={(event) => {
                        if (event.nativeEvent.actionName === "longpress")
                          setSelected(c);
                      }}
                      onLongPress={() => setSelected(c)}
                      activeOpacity={0.85}
                      onPress={() =>
                        navigation.navigate("Conversation", {
                          conversationId: c.id,
                          title: c.otherName,
                        })
                      }
                    >
                      <Avatar name={c.otherName} size={48} tone="clay" />
                      <View style={styles.text}>
                        <View style={styles.topRow}>
                          <Text style={styles.name} numberOfLines={1}>
                            {c.otherName}
                          </Text>
                          <Text style={styles.time}>{chatTime(c.lastAt)}</Text>
                        </View>
                        <Text style={styles.context} numberOfLines={1}>
                          {c.contextTitle}
                        </Text>
                        <View style={styles.bottomRow}>
                          <Text style={styles.preview} numberOfLines={1}>
                            {c.lastBody ?? "Say hello…"}
                          </Text>
                          {c.unreadCount > 0 && (
                            <View style={styles.unreadBadge}>
                              <Text style={styles.unreadText}>
                                {c.unreadCount > 99 ? "99+" : c.unreadCount}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
      {selected && (
        <ConversationActions
          key={selected.id}
          conversationId={selected.id}
          otherUserId={selected.otherUserId}
          name={selected.otherName}
          onClose={() => setSelected(null)}
          onReport={() => {
            setSelected(null);
            navigation.navigate("Report", {
              target: {
                kind: "conversation",
                id: selected.id,
                name: selected.otherName,
              },
            });
          }}
          onChanged={() => {
            setSelected(null);
            void load(true);
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  back: {
    flexDirection: "row",
    gap: 5,
    minHeight: 44,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  backText: { ...typography.bodySmall, color: colors.textDim },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: colors.text,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    marginBottom: spacing.md,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  tabPillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  tabText: { ...typography.bodySmall, fontWeight: "600", color: colors.textDim },
  tabTextActive: { color: colors.onAccent },
  tabBadge: {
    minWidth: 20,
    minHeight: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.coral,
  },
  tabBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "700",
  },
  sectionLabel: {
    ...typography.label,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textFaint,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  reqCard: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reqTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  text: { flex: 1, minWidth: 0 },
  reqTitle: { ...typography.body, color: colors.text },
  reqName: { fontWeight: "700" },
  reqPlan: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.text,
    marginTop: 2,
  },
  reqMeta: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  reqActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    gap: spacing.md,
  },
  declineBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  declineText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textDim,
  },
  acceptBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  acceptText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.onAccent,
  },
  chatCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: { ...typography.heading, color: colors.text, flex: 1 },
  time: { ...typography.caption, color: colors.textFaint },
  context: { ...typography.caption, color: colors.accent, marginTop: 2 },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 4,
  },
  preview: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
  unreadBadge: {
    minWidth: 22,
    minHeight: 22,
    paddingHorizontal: 5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.coral,
  },
  unreadText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "700",
  },
});
