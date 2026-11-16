import { RequestNote } from "../../components/RequestNote";
import { ActivityArt } from "../../components/ActivityArt";
import { activityArtwork } from "../../utils/activityArtwork";
import { PersonLink } from "../../components/PersonLink";
import { BackButton } from "../../components/BackButton";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { LoadingState } from "../../components/LoadingState";
import { ConversationActions } from "../../components/ConversationActions";
import { colors, typography, spacing, radius, weight } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { Alert } from "../../services/appAlert";
import { subscribeToNotifications } from "../../services/notifications";
import { onUnreadChanged } from "../../services/unreadEvents";
import { listConversations } from "../../services/chat";
import { listPlanGroups, PlanGroup } from "../../services/planGroups";
import {
  approveRequest,
  declineRequest,
  listPendingRequestsForHost,
  HostJoinRequest,
} from "../../services/joinRequests";
import { Conversation } from "../../services/mappers";
import {
  planChatReminder,
  planChatSection,
  planChatTime,
  sortPlanChats,
  PlanChatSection,
} from "../../utils/planChatSchedule";

type Props = {
  navigation: {
    goBack?: () => void;
    canGoBack?: () => boolean;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
};
type TabKey = "all" | "plans" | "bookings" | "requests";
const sectionNames: Record<PlanChatSection, string> = {
  today: "Today · pinned",
  upcoming: "Upcoming plans",
  past: "Past plans",
  cancelled: "Cancelled plans",
};
function chatTime(iso: string | undefined, now: number) {
  if (!iso || !Number.isFinite(new Date(iso).getTime())) return "";
  const date = new Date(iso),
    mins = Math.max(0, Math.floor((now - date.getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min`;
  return date.toLocaleDateString() === new Date(now).toLocaleDateString()
    ? date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** One card per plan group. Booking messages and private older history stay separate. */
export function ChatListScreen({ navigation }: Props) {
  const { profile } = useAuth(),
    personal = profile?.accountType === "personal";
  const tabsRef = useRef<ScrollView>(null);
  const focused = useRef(false),
    version = useRef(0),
    actionLock = useRef(false);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [groups, setGroups] = useState<PlanGroup[]>([]),
    [requests, setRequests] = useState<HostJoinRequest[]>([]);
  const [loading, setLoading] = useState(true),
    [groupError, setGroupError] = useState(false),
    [chatError, setChatError] = useState(false),
    [requestError, setRequestError] = useState(false);
  const [tab, setTab] = useState<TabKey>("all"),
    [searching, setSearching] = useState(false),
    [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null),
    [history, setHistory] = useState(false),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (tab === "requests") tabsRef.current?.scrollToEnd({ animated: false });
    else tabsRef.current?.scrollTo({ x: 0, animated: false });
  }, [tab]);
  const load = useCallback(
    async (silent = false) => {
      const ticket = ++version.current;
      if (!silent) setLoading(true);
      const [chats, plans, pending] = await Promise.allSettled([
        listConversations(),
        personal && profile?.id
          ? listPlanGroups(profile.id)
          : Promise.resolve([]),
        personal && profile?.id
          ? listPendingRequestsForHost(profile.id)
          : Promise.resolve([]),
      ]);
      if (!focused.current || ticket !== version.current) return;
      setChatError(chats.status === "rejected");
      setGroupError(plans.status === "rejected");
      setRequestError(pending.status === "rejected");
      if (chats.status === "fulfilled") setConversations(chats.value);
      if (plans.status === "fulfilled") setGroups(plans.value);
      if (pending.status === "fulfilled") setRequests(pending.value);
      setLoading(false);
    },
    [personal, profile?.id],
  );
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setSelected(null);
      setConversations([]);
      setGroups([]);
      setRequests([]);
      setHistory(false);
      setQuery("");
      setTab("all");
      setNow(Date.now());
      void load();
      const refresh = () => {
        setNow(Date.now());
        void load(true);
      };
      const stop = profile?.id
        ? subscribeToNotifications(profile.id, refresh)
        : () => {};
      const stopLocal = onUnreadChanged(refresh);
      const app = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      const timer = setInterval(() => {
        if (AppState.currentState === "active") refresh();
      }, 30000);
      return () => {
        focused.current = false;
        ++version.current;
        stop();
        stopLocal();
        app.remove();
        clearInterval(timer);
      };
    }, [load, profile?.id]),
  );
  const actOnRequest = async (r: HostJoinRequest, accept: boolean) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusyKey(r.id);
    try {
      await (accept ? approveRequest(r.id) : declineRequest(r.id));
      // The database's approved roster is the group roster; no separate chat write.
      await load(true);
    } catch (e) {
      Alert.alert(
        "Could not update this request",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      actionLock.current = false;
      if (focused.current) setBusyKey(null);
    }
  };
  const q = query.trim().toLowerCase(),
    matches = (...texts: (string | undefined)[]) =>
      !q || texts.some((t) => t?.toLowerCase().includes(q));
  const visibleGroups = sortPlanChats(
    groups.filter((g) => matches(g.name, g.planTitle, g.venueName)),
    now,
  );
  const bookings = conversations.filter(
    (c) => !!c.bookingId && matches(c.otherName, c.contextTitle),
  );
  const olderChats = conversations.filter(
    (c) => !c.bookingId && matches(c.otherName, c.contextTitle),
  );
  const visibleRequests = requests.filter((r) =>
    matches(r.requesterName, r.postTitle, r.postVenueName),
  );
  const oldUnread = olderChats.reduce((sum, c) => sum + c.unreadCount, 0);
  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    ...(personal ? [{ key: "plans" as const, label: "Plans" }] : []),
    { key: "bookings", label: "Bookings" },
    ...(personal ? [{ key: "requests" as const, label: "Requests" }] : []),
  ];
  const renderConversation = (c: Conversation) => (
    <View key={c.id} style={styles.chatCard}>
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.chatOpen}
        accessibilityLabel={`${c.otherName}. ${c.contextTitle}${c.unreadCount ? `. ${c.unreadCount} unread` : ""}`}
        accessibilityHint="Open conversation. Hold for options."
        onLongPress={() => setSelected(c)}
        onPress={() =>
          navigation.navigate("Conversation", {
            conversationId: c.id,
            title: c.otherName,
          })
        }
      >
        <Avatar name={c.otherName} size={44} tone="clay" />
        <View style={styles.copy}>
          <View style={styles.topRow}>
            <Text style={styles.name} numberOfLines={1}>
              {c.otherName}
            </Text>
            <Text style={styles.time}>{chatTime(c.lastAt, now)}</Text>
          </View>
          <Text style={styles.meta} numberOfLines={2}>
            {c.contextTitle}
          </Text>
          <View style={styles.topRow}>
            <Text style={styles.preview} numberOfLines={1}>
              {c.lastBody ?? "Say hello…"}
            </Text>
            {c.unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {c.unreadCount > 99 ? "99+" : c.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Options for ${c.otherName}`}
        style={styles.more}
        onPress={() => setSelected(c)}
      >
        <Icon name="more-vertical" size={19} />
      </TouchableOpacity>
    </View>
  );
  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {navigation.canGoBack?.() && (
          <BackButton onPress={() => navigation.goBack?.()} />
        )}
        <View style={styles.headerRow}>
          <Text accessibilityRole="header" style={styles.title}>
            Messages
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              searching ? "Close message search" : "Search messages"
            }
            style={styles.iconBtn}
            onPress={() => {
              if (searching) setQuery("");
              setSearching(!searching);
            }}
          >
            <Icon name={searching ? "x" : "search"} size={20} />
          </TouchableOpacity>
        </View>
        {searching && (
          <View style={styles.searchRow}>
            <TextInput
              accessibilityLabel="Search messages"
              placeholder="Search plans, places and names"
              placeholderTextColor={colors.textDim}
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
            />
            {!!query && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Clear message search"
                style={styles.iconBtn}
                onPress={() => setQuery("")}
              >
                <Icon name="x" size={18} />
              </TouchableOpacity>
            )}
          </View>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          ref={tabsRef}
          contentContainerStyle={styles.tabs}
        >
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === t.key }}
              style={[styles.tabPill, tab === t.key && styles.activeTab]}
              onPress={() => setTab(t.key)}
            >
              <Text
                style={[styles.tabText, tab === t.key && styles.activeText]}
              >
                {t.label}
              </Text>
              {t.key === "requests" && requests.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {requests.length >= 100 ? "99+" : requests.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
        {loading ? (
          <LoadingState label="Loading your plan chats…" layout="list" />
        ) : (
          <>
            {personal &&
              tab === "all" &&
              (visibleRequests.length > 0 || requestError) && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.requestSummary}
                  onPress={() => setTab("requests")}
                >
                  <Icon name="user-plus" size={19} color={colors.amberDeep} />
                  <Text style={[styles.name, { fontSize: 14 }]}>
                    {requestError
                      ? "Couldn’t refresh join requests"
                      : `${visibleRequests.length >= 100 ? "99+" : visibleRequests.length} join ${visibleRequests.length === 1 ? "request" : "requests"}`}
                  </Text>
                  <Text style={styles.link}>Review</Text>
                  <Icon name="chevron-right" size={16} />
                </TouchableOpacity>
              )}
            {personal && tab === "requests" && (
              <>
                {requestError && (
                  <View style={styles.errorBox}>
                    <Text style={styles.meta}>
                      Couldn’t refresh requests. Previously loaded requests may
                      have changed.
                    </Text>
                    <Button
                      title="Retry requests"
                      variant="ghost"
                      onPress={() => void load(true)}
                    />
                  </View>
                )}
                {!requestError && visibleRequests.length === 0 && (
                  <EmptyState
                    title={q ? "No matching requests" : "No pending requests"}
                    hint="New requests to join your plans appear here."
                  />
                )}
                {visibleRequests.map((r) => (
                  <View key={r.id} style={styles.requestCard}>
                    <View style={styles.requestTop}>
                      <PersonLink
                        name={r.requesterName}
                        avatarUrl={r.requesterAvatar}
                        subtitle="Wants to join"
                        onPress={() =>
                          navigation.navigate("HostProfile", {
                            userId: r.requesterId,
                            name: r.requesterName,
                            requestNote: r.note,
                          })
                        }
                      />
                    </View>
                    <Text style={styles.requestPlan}>{r.postTitle}</Text>
                    <RequestNote note={r.note} />
                    <Text style={styles.requestDate}>
                      {planChatTime(
                        { id: r.postId, startsAt: r.postStartsAt },
                        now,
                      )}
                    </Text>
                    {!!r.postVenueName && (
                      <Text style={styles.meta}>{r.postVenueName}</Text>
                    )}
                    <View style={styles.requestActions}>
                      <Text style={[styles.time, { flex: 1 }]}>
                        Requested {chatTime(r.createdAt, now)}
                      </Text>
                      <Button
                        title="Decline"
                        variant="ghost"
                        disabled={!!busyKey}
                        onPress={() => void actOnRequest(r, false)}
                      />
                      <Button
                        variant="solid"
                        title={busyKey === r.id ? "Updating…" : "Accept"}
                        disabled={!!busyKey}
                        onPress={() => void actOnRequest(r, true)}
                      />
                    </View>
                  </View>
                ))}
              </>
            )}
            {personal && (tab === "all" || tab === "plans") && (
              <>
                {groupError && (
                  <View style={styles.errorBox}>
                    <Text accessibilityRole="alert" style={styles.meta}>
                      Couldn’t refresh plan groups. Check your connection and
                      retry.
                    </Text>
                    <Button
                      title="Retry plan groups"
                      variant="ghost"
                      onPress={() => void load(true)}
                    />
                  </View>
                )}
                {!groupError &&
                  visibleGroups.length === 0 &&
                  (tab === "plans" ||
                    (!bookings.length &&
                      !olderChats.length &&
                      !visibleRequests.length)) && (
                    <EmptyState
                      title={q ? "No matching plans" : "No plan chats yet"}
                      hint={
                        q
                          ? "Try another plan or place."
                          : "A plan chat opens after the first member is approved to join."
                      }
                    />
                  )}
                {(["today", "upcoming", "past", "cancelled"] as const).map(
                  (section) => {
                    const items = visibleGroups.filter(
                      (g) => planChatSection(g, now) === section,
                    );
                    return items.length ? (
                      <View key={section}>
                        <View style={styles.sectionRow}>
                          {section === "today" && (
                            <Icon
                              name="bookmark"
                              size={13}
                              color={colors.amberDeep}
                            />
                          )}
                          <Text
                            accessibilityRole="header"
                            style={styles.sectionLabel}
                          >
                            {sectionNames[section]}
                          </Text>
                        </View>
                        {items.map((g) => {
                          const reminder = planChatReminder(
                            g,
                            g.planTitle,
                            now,
                          );
                          return (
                            <TouchableOpacity
                              key={g.id}
                              accessibilityRole="button"
                              accessibilityLabel={`${g.name}. ${planChatTime(g, now)}. ${g.memberCount} ${g.memberCount === 1 ? "member" : "members"}. ${g.unreadCount ?? 0} unread messages.${reminder ? ` ${reminder.text}` : ""}`}
                              accessibilityHint="Open the shared plan chat"
                              style={[
                                styles.planCard,
                                section === "today" && styles.todayCard,
                              ]}
                              onPress={() =>
                                navigation.navigate("PlanGroup", {
                                  groupId: g.id,
                                })
                              }
                            >
                              <View style={styles.planTop}>
                                <View style={styles.planAvatar}>
                                  <ActivityArt
                                    artwork={activityArtwork({
                                      title: g.planTitle,
                                      tags: g.activity ? [g.activity] : [],
                                    })}
                                    size={40}
                                  />
                                </View>
                                <View style={styles.copy}>
                                  <Text style={styles.name} numberOfLines={2}>
                                    {g.name}
                                  </Text>
                                  <Text style={styles.planDate}>
                                    {planChatTime(g, now)}
                                  </Text>
                                </View>
                                {!!g.unreadCount && (
                                  <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                      {g.unreadCount > 99
                                        ? "99+"
                                        : g.unreadCount}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.meta} numberOfLines={2}>
                                {[
                                  g.venueName,
                                  `${g.memberCount} ${g.memberCount === 1 ? "member" : "members"}`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </Text>
                              {g.name !== g.planTitle && (
                                <Text style={styles.meta} numberOfLines={2}>
                                  Plan: {g.planTitle}
                                </Text>
                              )}
                              <Text style={styles.preview} numberOfLines={1}>
                                {g.lastBody
                                  ? `${g.lastSenderName ? g.lastSenderName + ": " : ""}${g.lastBody}`
                                  : "Say hello to your group…"}
                              </Text>
                              {reminder && (
                                <View style={styles.reminderRow}>
                                  <Icon
                                    name="clock"
                                    size={13}
                                    color={colors.red}
                                  />
                                  <Text style={styles.reminder}>
                                    {reminder.short}
                                  </Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null;
                  },
                )}
              </>
            )}
            {(tab === "all" || tab === "bookings") && (
              <>
                {(bookings.length > 0 || tab === "bookings" || !personal) && (
                  <Text accessibilityRole="header" style={styles.sectionLabel}>
                    Booking messages
                  </Text>
                )}
                {chatError && (
                  <View style={styles.errorBox}>
                    <Text style={styles.meta}>
                      Couldn’t refresh booking messages.
                    </Text>
                    <Button
                      title="Retry messages"
                      variant="ghost"
                      onPress={() => void load(true)}
                    />
                  </View>
                )}
                {!chatError &&
                  !bookings.length &&
                  (tab === "bookings" || !personal) && (
                    <EmptyState
                      title={
                        q ? "No matching bookings" : "No booking messages yet"
                      }
                      hint="Confirmed bookings can start a conversation with the business."
                    />
                  )}
                {bookings.map(renderConversation)}
              </>
            )}
            {personal && tab === "all" && olderChats.length > 0 && (
              <View style={styles.history}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ expanded: history }}
                  style={styles.historyToggle}
                  onPress={() => setHistory(!history)}
                >
                  <Text style={[styles.meta, { flex: 1 }]}>
                    Earlier private chats
                    {oldUnread ? ` · ${oldUnread} unread` : ""}
                  </Text>
                  <Icon
                    name={history ? "chevron-up" : "chevron-down"}
                    size={18}
                  />
                </TouchableOpacity>
                {history && (
                  <>
                    <Text style={styles.historyHint}>
                      Previous private messages stay private. Use the plan’s
                      group for new conversations.
                    </Text>
                    {olderChats.map(renderConversation)}
                  </>
                )}
              </View>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 16,
  },
  title: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: colors.text,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    marginBottom: 12,
  },
  searchInput: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    minWidth: 0,
    padding: 12,
  },
  tabs: { gap: 8, paddingBottom: 18 },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  activeTab: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: {
    ...typography.bodySmall,
    ...weight("600"),
    color: colors.textDim,
  },
  activeText: { color: colors.onAccent },
  badge: {
    minWidth: 21,
    minHeight: 21,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amber,
  },
  badgeText: { ...typography.caption, ...weight("800"), color: colors.night },
  requestSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.amberSoft,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    minHeight: 48,
  },
  link: { ...typography.bodySmall, ...weight("700"), color: colors.amberDeep },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 10,
  },
  sectionLabel: {
    ...typography.label,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 11,
    color: colors.textDim,
    marginVertical: 10,
  },
  planCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  todayCard: { borderColor: colors.amber, borderWidth: 1.5 },
  planTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  planAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0 },
  name: { ...typography.heading, color: colors.text, flexShrink: 1 },
  planDate: {
    ...typography.bodySmall,
    ...weight("600"),
    color: colors.text,
    marginTop: 3,
  },
  meta: { ...typography.bodySmall, color: colors.textDim },
  preview: { ...typography.bodySmall, color: colors.text, flexShrink: 1 },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  reminder: { ...typography.bodySmall, ...weight("700"), color: colors.red },
  requestCard: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  requestTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  requestPlan: {
    ...typography.body,
    ...weight("600"),
    color: colors.text,
    marginTop: 4,
  },
  requestDate: {
    ...typography.bodySmall,
    ...weight("600"),
    color: colors.text,
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 18,
    marginBottom: 10,
    paddingLeft: 14,
  },
  chatOpen: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  time: { ...typography.caption, color: colors.textDim },
  more: {
    minHeight: 56,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  history: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  historyToggle: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: 8,
  },
  historyHint: {
    ...typography.caption,
    color: colors.textDim,
    marginBottom: 12,
  },
});
