import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { postState } from "../../utils/flowState";
import { requestPresentation, bookingPresentation } from "../../utils/activity";
import { formatWhen } from "../../utils/format";
import { Screen } from "../../components/Screen";
import { PersonalHeader } from "../../components/PersonalHeader";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Avatar } from "../../components/Avatar";
import { Icon, IconName } from "../../components/Icon";
import { MotionPressable, ScreenReveal } from "../../components/Motion";
import { LoadingState } from "../../components/LoadingState";
import { colors, typography, spacing } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { PersonalTabNav } from "../../navigation/types";
import { listPosts, subscribeToPosts } from "../../services/posts";
import {
  approveRequest,
  cancelParticipation,
  declineRequest,
  listMyRequests,
  listRequestsForPost,
  withdrawRequest,
} from "../../services/joinRequests";
import { Booking } from "../../services/mappers";
import {
  listMyBookings,
  cancelBooking,
  subscribeToBookings,
} from "../../services/bookings";
import { getOrCreateConversation } from "../../services/chat";

type Section = "plans" | "requests" | "bookings";
const sections: { key: Section; label: string; icon: IconName }[] = [
  { key: "plans", label: "My plans", icon: "calendar" },
  { key: "requests", label: "Requests", icon: "user-plus" },
  { key: "bookings", label: "Bookings", icon: "bookmark" },
];

export function ActivityScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<PersonalTabNav>();
  const myId = profile?.id;
  const [section, setSection] = useState<Section>("plans");
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [now, setNow] = useState(Date.now);
  const lock = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setConfirmation(null);
    setNotice(null);
    setSection("plans");
    setHistory(false);
  }, [myId]);
  const {
    data,
    state,
    refreshing,
    refresh: load,
  } = useLiveQuery(
    `activity:${myId}`,
    async () => {
      if (!myId) return { mine: [], incoming: [], bookings: [] };
      const [mine, posts, bookings] = await Promise.all([
        listMyRequests(myId),
        listPosts({ authorId: myId, status: "all" }),
        listMyBookings(myId),
      ]);
      const incoming = await Promise.all(
        posts
          .filter((p) => postState(p).canCancel)
          .map(async (post) => ({
            post,
            requests: (await listRequestsForPost(post.id)).filter(
              (r) => r.status === "pending",
            ),
          })),
      );
      return {
        mine,
        incoming: incoming.filter((item) => item.requests.length),
        bookings,
      };
    },
    (refresh) => {
      const stopPosts = subscribeToPosts(refresh),
        stopBookings = subscribeToBookings(refresh);
      return () => {
        stopPosts();
        stopBookings();
      };
    },
  );
  const mine = data?.mine ?? [],
    incoming = (data?.incoming ?? []).filter(
      ({ post }) => postState(post, now).canCancel,
    ),
    bookings = data?.bookings ?? [];
  const requestCount = incoming.reduce(
    (total, item) => total + item.requests.length,
    0,
  );
  const plans = mine
    .filter((r) => requestPresentation(r, now).history === history)
    .sort((a, b) =>
      history
        ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
        : (Date.parse(a.postStartsAt ?? "") || Infinity) -
          (Date.parse(b.postStartsAt ?? "") || Infinity),
    );
  const visibleBookings = bookings
    .filter((b) => bookingPresentation(b, now).history === history)
    .sort((a, b) =>
      history
        ? Date.parse(b.slot) - Date.parse(a.slot)
        : Date.parse(a.slot) - Date.parse(b.slot),
    );
  const run = async (
    key: string,
    action: () => Promise<void>,
    success?: string,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(key);
    setNotice(null);
    try {
      await action();
      setConfirmation(null);
      if (success) setNotice({ text: success });
      setNow(Date.now());
      await load();
    } catch (e) {
      setNotice({
        text: e instanceof Error ? e.message : "Please try again.",
        error: true,
      });
      Alert.alert(
        "Couldn’t complete that",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };
  const openBookingChat = (booking: Booking) => {
    if (!myId || !booking.businessId) return;
    void run(`message:${booking.id}`, async () => {
      const conversationId = await getOrCreateConversation(
        booking.businessId!,
        { bookingId: booking.id },
      );
      navigation.navigate("Conversation", {
        conversationId,
        title: booking.offerTitle,
      });
    });
  };
  const confirmAction = (
    key: string,
    title: string,
    hint: string,
    action: () => Promise<void>,
    success: string,
  ) =>
    confirmation === key ? (
      <View style={styles.confirmation}>
        <Text style={styles.cardTitle}>{title}?</Text>
        <Text style={styles.copy}>{hint}</Text>
        <View style={styles.actions}>
          <Button
            title="Keep it"
            variant="secondary"
            disabled={busy !== null}
            onPress={() => setConfirmation(null)}
            style={styles.actionButton}
          />
          <Button
            title={title}
            variant="danger"
            loading={busy === key}
            disabled={busy !== null}
            onPress={() => void run(key, action, success)}
            style={styles.actionButton}
          />
        </View>
      </View>
    ) : (
      <Button
        title={title}
        variant="ghost"
        disabled={busy !== null}
        onPress={() => setConfirmation(key)}
      />
    );
  const empty = (
    icon: IconName,
    title: string,
    hint: string,
    action?: { title: string; onPress: () => void },
  ) => (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={28} color={colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
      {action && (
        <Button
          title={action.title}
          variant="secondary"
          onPress={action.onPress}
          style={styles.emptyAction}
        />
      )}
    </View>
  );
  return (
    <Screen>
      <ScrollView
        testID="activity-screen"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing && state !== "loading"}
            onRefresh={() => void load(true)}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <PersonalHeader />
        <Text style={styles.title} accessibilityRole="header">
          Activity
        </Text>
        <Text style={styles.intro}>Keep track of what’s happening next.</Text>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="My posts"
          accessibilityHint="Manage the plans you posted"
          onPress={() => navigation.navigate("MyPosts")}
          style={styles.postsLink}
        >
          <View style={styles.shortcutIcon}>
            <Icon name="file-text" size={20} color={colors.accent} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>My posts</Text>
            <Text style={styles.copy}>Manage the plans you’re hosting</Text>
          </View>
          <Icon name="chevron-right" size={20} />
        </MotionPressable>
        {state !== "loading" && requestCount > 0 && section !== "requests" && (
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`Review ${requestCount} join ${requestCount === 1 ? "request" : "requests"}`}
            onPress={() => {
              setSection("requests");
              setConfirmation(null);
            }}
            style={styles.attention}
          >
            <Icon name="user-plus" size={18} color={colors.clayDeep} />
            <Text style={styles.attentionText}>
              {requestCount}{" "}
              {requestCount === 1 ? "person wants" : "people want"} to join your
              plans
            </Text>
            <Icon name="arrow-right" size={18} color={colors.clayDeep} />
          </MotionPressable>
        )}
        <View
          style={styles.tabs}
          accessibilityRole="tablist"
          accessibilityLabel="Activity sections"
        >
          {sections.map((tab) => (
            <MotionPressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: section === tab.key }}
              onPress={() => {
                setSection(tab.key);
                setHistory(false);
                setConfirmation(null);
              }}
              style={[styles.tab, section === tab.key && styles.activeTab]}
            >
              <Icon
                name={tab.icon}
                size={17}
                color={section === tab.key ? colors.onAccent : colors.textDim}
              />
              <Text
                style={[
                  styles.tabText,
                  section === tab.key && styles.activeTabText,
                ]}
              >
                {tab.label}
                {tab.key === "requests" && requestCount > 0
                  ? ` (${requestCount})`
                  : ""}
              </Text>
            </MotionPressable>
          ))}
        </View>
        {notice && (
          <View style={styles.notice}>
            <Icon
              name={notice.error ? "alert-circle" : "check-circle"}
              size={18}
              color={colors.accent}
            />
            <Text
              accessibilityRole={notice.error ? "alert" : undefined}
              accessibilityLiveRegion="polite"
              style={styles.noticeText}
            >
              {notice.text}
            </Text>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss update"
              style={styles.dismiss}
              onPress={() => setNotice(null)}
            >
              <Icon name="x" size={18} />
            </MotionPressable>
          </View>
        )}
        <ScreenReveal key={section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section === "plans"
              ? "Plans you asked to join"
              : section === "requests"
                ? "Requests to your posts"
                : "Your bookings"}
          </Text>
          <Text style={styles.explainer}>
            {section === "plans"
              ? "See whether you’re going or waiting for the host."
              : section === "requests"
                ? "You’re the host here. Choose who joins your plans."
                : "Track your reservations with nearby businesses."}
          </Text>
          {section !== "requests" && (
            <View
              style={styles.filters}
              accessibilityRole="tablist"
              accessibilityLabel="Activity period"
            >
              {[false, true].map((past) => (
                <MotionPressable
                  key={String(past)}
                  accessibilityRole="tab"
                  accessibilityLabel={past ? "History" : "Upcoming"}
                  accessibilityState={{ selected: history === past }}
                  onPress={() => {
                    setHistory(past);
                    setConfirmation(null);
                  }}
                  style={[
                    styles.filter,
                    history === past && styles.activeFilter,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      history === past && styles.activeFilterText,
                    ]}
                  >
                    {past ? "History" : "Upcoming"}
                  </Text>
                </MotionPressable>
              ))}
            </View>
          )}
          {state === "loading" ? (
            <LoadingState label="Loading your activity…" />
          ) : state === "error" ? (
            <View style={styles.error}>
              <Text style={styles.cardTitle}>
                Couldn’t refresh your activity
              </Text>
              <Text style={styles.copy}>
                Check your connection and try again.
              </Text>
              <Button
                title="Try again"
                variant="secondary"
                onPress={() => void load()}
              />
            </View>
          ) : section === "requests" ? (
            incoming.length === 0 ? (
              empty(
                "user-check",
                "You’re all caught up",
                "When someone asks to join one of your posts, you can review their request here.",
                {
                  title: "View my posts",
                  onPress: () => navigation.navigate("MyPosts"),
                },
              )
            ) : (
              incoming.map(({ post, requests }) => (
                <View key={post.id} style={styles.requestGroup}>
                  <MotionPressable
                    accessibilityRole="button"
                    accessibilityLabel={`View post: ${post.title}`}
                    onPress={() =>
                      navigation.navigate("PostDetails", { postId: post.id })
                    }
                    style={styles.groupHeader}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.eyebrow}>You’re hosting</Text>
                      <Text style={styles.cardTitle}>{post.title}</Text>
                      <Text style={styles.copy}>
                        {formatWhen(post.startsAt)}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={18} />
                  </MotionPressable>
                  {!postState(post, now).accepting && (
                    <Text style={styles.closed}>
                      This plan is full or no longer accepting requests.
                    </Text>
                  )}
                  {requests.map((request) => (
                    <View key={request.id} style={styles.personRequest}>
                      <View style={styles.personRow}>
                        <Avatar
                          name={request.requesterName}
                          size={40}
                          tone="clay"
                        />
                        <View style={styles.flex}>
                          <Text style={styles.cardTitle}>
                            {request.requesterName}
                          </Text>
                          <Text style={styles.copy}>
                            Wants to join your plan
                          </Text>
                        </View>
                      </View>
                      <View style={styles.actions}>
                        <Button
                          title="Decline"
                          variant="secondary"
                          disabled={busy !== null}
                          loading={busy === `decline:${request.id}`}
                          onPress={() =>
                            void run(
                              `decline:${request.id}`,
                              () => declineRequest(request.id),
                              "Request declined.",
                            )
                          }
                          style={styles.actionButton}
                        />
                        <Button
                          title="Approve"
                          disabled={
                            busy !== null || !postState(post, now).accepting
                          }
                          loading={busy === `approve:${request.id}`}
                          onPress={() =>
                            void run(
                              `approve:${request.id}`,
                              async () => {
                                await approveRequest(request.id);
                              },
                              "Request approved. They’re now on your guest list.",
                            )
                          }
                          style={styles.actionButton}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )
          ) : section === "plans" ? (
            plans.length === 0 ? (
              empty(
                history ? "clock" : "calendar",
                history ? "No plan history yet" : "No upcoming plans yet",
                history
                  ? "Past plans and requests you’ve withdrawn or that weren’t accepted will appear here."
                  : "Find a plan you like in Nearby and ask the host to join.",
                !history
                  ? {
                      title: "Explore nearby plans",
                      onPress: () => navigation.navigate("Nearby"),
                    }
                  : undefined,
              )
            ) : (
              plans.map((request) => {
                const view = requestPresentation(request, now);
                return (
                  <View key={request.id} style={styles.card}>
                    <View style={styles.statusRow}>
                      <Text style={styles.eyebrow}>Your join request</Text>
                      <Badge
                        label={view.label}
                        tone={
                          request.status === "approved" && !view.history
                            ? "green"
                            : "neutral"
                        }
                      />
                    </View>
                    <Text style={styles.planTitle}>{request.postTitle}</Text>
                    {!!request.postStartsAt && (
                      <View style={styles.meta}>
                        <Icon name="calendar" size={15} />
                        <Text style={styles.metaText}>
                          {formatWhen(request.postStartsAt)}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.description}>{view.hint}</Text>
                    <Button
                      title="View plan"
                      variant="secondary"
                      onPress={() =>
                        navigation.navigate("PostDetails", {
                          postId: request.postId,
                        })
                      }
                    />
                    {view.canWithdraw &&
                      confirmAction(
                        `withdraw:${request.id}`,
                        "Withdraw request",
                        "The host will no longer see your request to join.",
                        () => withdrawRequest(request.id),
                        "Request withdrawn.",
                      )}
                    {view.canLeave &&
                      confirmAction(
                        `leave:${request.id}`,
                        "Leave plan",
                        "Your spot will be released for someone else.",
                        () => cancelParticipation(request.id),
                        "You left the plan. Your spot has been released.",
                      )}
                  </View>
                );
              })
            )
          ) : visibleBookings.length === 0 ? (
            empty(
              history ? "clock" : "bookmark",
              history ? "No booking history yet" : "No upcoming bookings",
              history
                ? "Past, cancelled and expired bookings will appear here."
                : "Bookings you make through a business offer will appear here.",
              !history
                ? {
                    title: "Find nearby offers",
                    onPress: () => navigation.navigate("Search"),
                  }
                : undefined,
            )
          ) : (
            visibleBookings.map((booking) => {
              const view = bookingPresentation(booking, now);
              return (
                <View key={booking.id} style={styles.card}>
                  <View style={styles.statusRow}>
                    <Text style={styles.eyebrow}>Business booking</Text>
                    <Badge
                      label={view.label}
                      tone={
                        booking.status === "confirmed" && !view.history
                          ? "green"
                          : "neutral"
                      }
                    />
                  </View>
                  <Text style={styles.planTitle}>{booking.offerTitle}</Text>
                  <View style={styles.meta}>
                    <Icon name="calendar" size={15} />
                    <Text style={styles.metaText}>
                      {formatWhen(booking.slot)}
                    </Text>
                  </View>
                  <View style={styles.meta}>
                    <Icon name="users" size={15} />
                    <Text style={styles.metaText}>
                      {booking.partySize}{" "}
                      {booking.partySize === 1 ? "person" : "people"}
                    </Text>
                  </View>
                  <Text style={styles.description}>{view.hint}</Text>
                  {booking.businessId && (
                    <Button
                      title="Message business"
                      variant="secondary"
                      disabled={busy !== null}
                      loading={busy === `message:${booking.id}`}
                      onPress={() => openBookingChat(booking)}
                    />
                  )}
                  {view.canCancel &&
                    confirmAction(
                      `cancel:${booking.id}`,
                      "Cancel booking",
                      "Your reservation will be cancelled and the spot released.",
                      () => cancelBooking(booking.id),
                      "Booking cancelled.",
                    )}
                </View>
              );
            })
          )}
        </ScreenReveal>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  flex: { flex: 1, minWidth: 0 },
  title: {
    ...typography.title,
    fontSize: 28,
    lineHeight: 35,
    color: colors.text,
    marginTop: spacing.md,
  },
  intro: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: 5,
    marginBottom: spacing.lg,
  },
  postsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  shortcutIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.claySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: "600" },
  copy: { ...typography.bodySmall, color: colors.textDim, marginTop: 3 },
  attention: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.claySoft,
    padding: 14,
    borderRadius: 16,
    marginBottom: spacing.md,
    minHeight: 52,
  },
  attentionText: { ...typography.bodySmall, color: colors.clayDeep, flex: 1 },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 5,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 18,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    minWidth: 86,
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  activeTab: { backgroundColor: colors.ink },
  tabText: {
    ...typography.label,
    fontSize: 12,
    color: colors.textDim,
    textAlign: "center",
  },
  activeTabText: { color: colors.onAccent },
  sectionTitle: { ...typography.heading, color: colors.text },
  explainer: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: 5,
    marginBottom: spacing.md,
  },
  filters: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  filter: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeFilter: { borderColor: colors.clay, backgroundColor: colors.claySoft },
  filterText: { ...typography.label, color: colors.textDim },
  activeFilterText: { color: colors.clayDeep },
  card: {
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  eyebrow: { ...typography.caption, color: colors.textDim },
  planTitle: {
    ...typography.heading,
    fontSize: 19,
    lineHeight: 25,
    color: colors.text,
    marginBottom: 10,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4 },
  metaText: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
  description: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: 12,
    marginBottom: 16,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  actionButton: { flex: 1, minWidth: 130 },
  confirmation: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 16,
    paddingTop: 16,
  },
  requestGroup: {
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    backgroundColor: colors.surfaceRaised,
  },
  personRequest: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  personRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  closed: {
    ...typography.bodySmall,
    color: colors.clayDeep,
    padding: spacing.md,
  },
  empty: {
    alignItems: "center",
    padding: 24,
    paddingVertical: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginTop: 2,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.claySoft,
    marginBottom: 16,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: "center",
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.textDim,
    textAlign: "center",
    marginTop: 8,
  },
  emptyAction: { marginTop: 20, alignSelf: "stretch" },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: 16,
  },
  noticeText: { ...typography.bodySmall, color: colors.text, flex: 1 },
  dismiss: {
    minHeight: 44,
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    gap: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
