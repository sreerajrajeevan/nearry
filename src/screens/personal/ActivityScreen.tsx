import { formatWhen } from "../../utils/format";
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { bookingState, postState } from "../../utils/flowState";
import { Screen } from "../../components/Screen";
import { PersonalHeader } from "../../components/PersonalHeader";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Avatar } from "../../components/Avatar";
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
import { NeedPost, JoinRequest, Booking } from "../../services/mappers";
import {
  listMyBookings,
  cancelBooking,
  subscribeToBookings,
} from "../../services/bookings";
import { getOrCreateConversation } from "../../services/chat";

type IncomingItem = { post: NeedPost; requests: JoinRequest[] };

/**
 * Activity: my join requests (status) + incoming requests on my posts
 * (host approve/decline). Realtime-synced across devices.
 */
export function ActivityScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<PersonalTabNav>();
  const myId = profile?.id;

  const [busy, setBusy] = useState<string | null>(null);
  const {
    data,
    state,
    refresh: load,
  } = useLiveQuery(
    `activity:${myId}`,
    async () => {
      if (!myId) return { mine: [], incoming: [], bookings: [] };
      const [myReqs, myPosts, myBookings] = await Promise.all([
        listMyRequests(myId),
        listPosts({ authorId: myId, status: "all" }),
        listMyBookings(myId),
      ]);
      const incoming = await Promise.all(
        myPosts
          .filter((p) => postState(p).canCancel)
          .map(async (post) => ({
            post,
            requests: (await listRequestsForPost(post.id)).filter(
              (r) => r.status === "pending",
            ),
          })),
      );
      return {
        mine: myReqs,
        incoming: incoming.filter((item) => item.requests.length),
        bookings: myBookings,
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
    incoming = data?.incoming ?? [],
    bookings = data?.bookings ?? [];

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert(
        "Hmm",
        e instanceof Error ? e.message : "Something went wrong.",
      );
    } finally {
      setBusy(null);
    }
  };

  const openBookingChat = async (b: Booking) => {
    if (!myId || !b.businessId) return;
    setBusy(`m${b.id}`);
    try {
      const conversationId = await getOrCreateConversation(b.businessId, {
        bookingId: b.id,
      });
      navigation.navigate("Conversation", {
        conversationId,
        title: b.offerTitle,
      });
    } catch (e) {
      Alert.alert(
        "Could not open chat",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const bookingTone = (s: Booking["status"]): "neutral" | "green" | "red" =>
    s === "confirmed" ? "green" : s === "pending" ? "neutral" : "red";

  const statusTone = (s: JoinRequest["status"]) =>
    s === "approved" ? "green" : s === "pending" ? "neutral" : "red";

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <PersonalHeader />
        <Text style={styles.header}>Activity</Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.myPosts}
          onPress={() => navigation.navigate("MyPosts")}
        >
          <Text style={styles.myPostsTitle}>My posts</Text>
          <Text style={styles.myPostsLink}>View and manage →</Text>
        </TouchableOpacity>

        {state === "loading" ? (
          <Text style={styles.status}>Loading…</Text>
        ) : state === "error" ? (
          <View>
            <EmptyState
              title="Couldn't load activity"
              hint="Check your connection and retry."
            />
            <Button title="Retry" onPress={() => load()} />
          </View>
        ) : (
          <>
            {incoming.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Incoming requests</Text>
                {incoming.map(({ post, requests }) => (
                  <View key={post.id} style={styles.group}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() =>
                        navigation.navigate("PostDetails", { postId: post.id })
                      }
                    >
                      <Text style={styles.groupTitle}>{post.title}</Text>
                    </TouchableOpacity>
                    {requests
                      .filter((r) => r.status === "pending")
                      .map((r) => (
                        <Card key={r.id} style={styles.reqCard}>
                          <View style={styles.reqRow}>
                            <Avatar name={r.requesterName} size={28} />
                            <Text style={styles.reqName}>
                              {r.requesterName}
                            </Text>
                          </View>
                          <View style={styles.reqActions}>
                            <Button
                              title="Decline"
                              variant="ghost"
                              loading={busy === `d${r.id}`}
                              onPress={() =>
                                run(`d${r.id}`, () => declineRequest(r.id))
                              }
                            />
                            <View style={styles.reqGap} />
                            <Button
                              title="Approve"
                              disabled={
                                busy !== null || !postState(post).accepting
                              }
                              loading={busy === `a${r.id}`}
                              onPress={() =>
                                run(`a${r.id}`, () =>
                                  approveRequest(r.id).then(() => {}),
                                )
                              }
                            />
                          </View>
                        </Card>
                      ))}
                  </View>
                ))}
              </>
            )}

            {bookings.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>My bookings</Text>
                {bookings.map((b) => (
                  <Card key={b.id} style={styles.row}>
                    <View style={styles.rowTop}>
                      <Text style={styles.postTitle}>{b.offerTitle}</Text>
                      <Badge
                        label={bookingState(b).label}
                        tone={bookingTone(b.status)}
                      />
                    </View>
                    <Text style={styles.bookMeta}>
                      {formatWhen(b.slot)} · {b.partySize}{" "}
                      {b.partySize === 1 ? "person" : "people"}
                    </Text>
                    <View style={styles.bookActions}>
                      {b.businessId && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => openBookingChat(b)}
                        >
                          <Text style={styles.messageLink}>
                            {busy === `m${b.id}` ? "…" : "MESSAGE"}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {bookingState(b).canCancel && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          style={styles.cancelWrap}
                          onPress={() =>
                            run(`bk${b.id}`, () => cancelBooking(b.id))
                          }
                        >
                          <Text style={styles.withdraw}>
                            {busy === `bk${b.id}` ? "…" : "CANCEL BOOKING"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                ))}
              </>
            )}

            <Text style={styles.sectionLabel}>My requests</Text>
            {mine.length === 0 ? (
              <EmptyState
                title="No requests yet"
                hint="Find a post and request to join."
              />
            ) : (
              mine.map((r) => (
                <Card key={r.id} style={styles.row}>
                  <View style={styles.rowTop}>
                    <Text style={styles.postTitle}>{r.postTitle}</Text>
                    <Badge
                      label={
                        r.postStatus === "cancelled"
                          ? "Plan cancelled"
                          : r.status.toUpperCase()
                      }
                      tone={statusTone(r.status)}
                    />
                  </View>
                  <View style={styles.rowActions}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() =>
                        navigation.navigate("PostDetails", { postId: r.postId })
                      }
                    >
                      <Text style={styles.viewPost}>View post →</Text>
                    </TouchableOpacity>
                    {r.status === "pending" && r.postStatus !== "cancelled" && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() =>
                          run(`w${r.id}`, () => withdrawRequest(r.id))
                        }
                      >
                        <Text style={styles.withdraw}>
                          {busy === `w${r.id}` ? "…" : "WITHDRAW"}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {r.status === "approved" &&
                      r.postStatus !== "cancelled" &&
                      !!r.postStartsAt &&
                      new Date(r.postStartsAt).getTime() > Date.now() && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() =>
                            run(`l${r.id}`, () => cancelParticipation(r.id))
                          }
                        >
                          <Text style={styles.withdraw}>
                            {busy === `l${r.id}` ? "…" : "LEAVE"}
                          </Text>
                        </TouchableOpacity>
                      )}
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  myPosts: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    minHeight: 52,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  myPostsTitle: { ...typography.body, color: colors.text },
  myPostsLink: { ...typography.bodySmall, color: colors.accent },
  scroll: { paddingBottom: spacing.xl },
  header: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  sectionLabel: {
    ...typography.label,
    color: colors.textDim,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  group: { marginBottom: spacing.md },
  groupTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  reqCard: { marginBottom: spacing.sm },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  reqName: { ...typography.body, color: colors.text, marginLeft: spacing.sm },
  reqActions: { flexDirection: "row" },
  reqGap: { width: spacing.sm },
  row: { marginBottom: spacing.sm },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  postTitle: { ...typography.body, color: colors.text, flex: 1 },
  rowActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  bookMeta: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  bookActions: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.sm,
    alignItems: "center",
  },
  messageLink: { ...typography.label, color: colors.red },
  cancelWrap: { marginTop: spacing.sm, alignSelf: "flex-start" },
  viewPost: { ...typography.label, color: colors.textDim },
  withdraw: { ...typography.label, color: colors.red },
});
