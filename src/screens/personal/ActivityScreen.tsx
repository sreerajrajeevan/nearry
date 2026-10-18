import { formatWhen } from "../../utils/format";
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
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
import { NeedPost, JoinRequest, Booking, isHoldExpired } from "../../services/mappers";
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

  const [mine, setMine] = useState<(JoinRequest & { postTitle: string })[]>([]);
  const [incoming, setIncoming] = useState<IncomingItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!myId) {
        setState("ready");
        return;
      }
      if (!silent) setState("loading");
      try {
        const [myReqs, myPosts, myBookings] = await Promise.all([
          listMyRequests(myId),
          listPosts({ authorId: myId, status: "all" }),
          listMyBookings(myId),
        ]);
        setMine(myReqs);
        setBookings(myBookings);
        const allReqs = await Promise.all(
          myPosts.map((post) => listRequestsForPost(post.id)),
        );
        const items: IncomingItem[] = [];
        myPosts.forEach((post, i) => {
          const pending = allReqs[i].filter((r) => r.status === "pending");
          if (pending.length > 0) items.push({ post, requests: pending });
        });
        setIncoming(items);
        setState("ready");
      } catch {
        if (!silent) setState("error");
      }
    },
    [myId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => subscribeToPosts(() => void load(true)), [load]);
  useEffect(() => subscribeToBookings(() => void load(true)), [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
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
                              loading={busy === `a${r.id}`}
                              onPress={() =>
                                run(`a${r.id}`, async () => {
                                  const res = await approveRequest(r.id);
                                  if (res.postClosed) {
                                    Alert.alert(
                                      "Post is now full",
                                      "All spots are taken.",
                                    );
                                  }
                                })
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
                        label={
                          isHoldExpired(b) ? "EXPIRED" : b.status.toUpperCase()
                        }
                        tone={isHoldExpired(b) ? "neutral" : bookingTone(b.status)}
                      />
                    </View>
                    <Text style={styles.bookMeta}>
                      {formatWhen(b.slot)} · {b.partySize}{" "}
                      {b.partySize === 1 ? "person" : "people"}
                    </Text>
                    {isHoldExpired(b) && (
                      <Text style={styles.expiredNote}>
                        The confirmation window passed — the hold was released.
                      </Text>
                    )}
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
                      {(b.status === "pending" || b.status === "confirmed") &&
                        !isHoldExpired(b) && (
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
                      label={r.status.toUpperCase()}
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
                    {r.status === "pending" && (
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
                    {r.status === "approved" && (
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
  expiredNote: {
    ...typography.caption,
    color: colors.textFaint,
    fontStyle: "italic",
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
