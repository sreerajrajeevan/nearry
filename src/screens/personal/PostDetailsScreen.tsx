import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { Avatar } from "../../components/Avatar";
import { colors, typography, spacing } from "../../theme";
import { getOrCreateConversation } from "../../services/chat";
import { PostDetailsProps } from "../../navigation/types";
import { useAuth } from "../../store/AuthContext";
import { getPost, cancelPost, deletePost, subscribeToPosts } from "../../services/posts";
import {
  approveRequest,
  cancelParticipation,
  declineRequest,
  listRequestsForPost,
  myRequestForPost,
  requestToJoin,
  withdrawRequest,
} from "../../services/joinRequests";
import { NeedPost } from "../../services/mappers";
import { JoinRequest } from "../../services/mappers";
import { timeLeft, formatWhen } from "../../utils/format";

/**
 * Post details: host manages requests, participants request/withdraw.
 * Realtime subscription keeps every device in sync.
 */
export function PostDetailsScreen({ route, navigation }: PostDetailsProps) {
  const { postId } = route.params;
  const { profile } = useAuth();
  const myId = profile?.id;

  const [post, setPost] = useState<NeedPost | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [myRequest, setMyRequest] = useState<JoinRequest | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setState("loading");
      setErrorMsg("");
    }
    try {
      const p = await getPost(postId);
      if (!p) throw new Error("Post not found.");
      setPost(p);
      const [reqs, mine] = await Promise.all([
        listRequestsForPost(postId),
        myId ? myRequestForPost(postId, myId) : Promise.resolve(null),
      ]);
      setRequests(reqs);
      setMyRequest(mine);
      setState("ready");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not load this post.");
      setState("error");
    }
  }, [postId, myId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when returning to the screen, and live via realtime.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => subscribeToPosts(() => void load(true)), [load]);

  const isHost = !!myId && post?.authorId === myId;
  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");

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

  const openChat = async (otherUserId: string, otherName: string) => {
    if (!myId) return;
    setBusy("msg");
    try {
      const conversationId = await getOrCreateConversation(otherUserId, {
        postId,
      });
      navigation.navigate("Conversation", { conversationId, title: otherName });
    } catch (e) {
      Alert.alert(
        "Could not open chat",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const onCancelPost = () => {
    Alert.alert(
      "Cancel this post?",
      "Approved participants will see it as cancelled. This cannot be undone.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel post",
          style: "destructive",
          onPress: () => run("cancel", () => cancelPost(postId)),
        },
      ],
    );
  };

  if (state === "loading") {
    return (
      <Screen padded>
        <Text style={styles.status}>Loading…</Text>
      </Screen>
    );
  }
  if (state === "error" || !post) {
    return (
      <Screen padded>
        <EmptyState title="Couldn't load this post" hint={errorMsg} />
        <Button title="Retry" onPress={load} />
        <View style={styles.gap} />
        <Button
          title="Go back"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const spotsBadge =
    post.status === "open"
      ? post.spotsLeft > 0
        ? `${post.spotsLeft} spot${post.spotsLeft === 1 ? "" : "s"} left`
        : "Full"
      : post.status;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.back}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{post.title}</Text>
          <Badge
            label={spotsBadge}
            tone={
              post.status === "open" && post.spotsLeft > 0 ? "green" : "red"
            }
          />
        </View>
        <View style={styles.authorRow}>
          <Avatar name={post.authorName} size={28} />
          <Text style={styles.authorName}>{post.authorName}</Text>
          {post.venueName && (
            <Text style={styles.meta}> · {post.venueName}</Text>
          )}
        </View>
        <Text style={styles.meta}>{formatWhen(post.startsAt)}</Text>
        {post.expiresAt && (
          <Text style={styles.meta}>
            Requests close {timeLeft(post.expiresAt)}
          </Text>
        )}
        <Text style={styles.desc}>{post.description}</Text>
        {post.tags.length > 0 && (
          <View style={styles.tags}>
            {post.tags.map((t) => (
              <Badge key={t} label={`#${t}`} />
            ))}
          </View>
        )}

        {isHost ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Requests · {pending.length} pending · {approved.length} in
            </Text>
            {pending.length === 0 && approved.length === 0 && (
              <EmptyState
                title="No requests yet"
                hint="Share this post to fill the spots."
              />
            )}
            {pending.map((r) => (
              <View key={r.id} style={styles.reqRow2}>
                <Avatar name={r.requesterName} size={32} />
                <Text style={styles.reqName}>{r.requesterName}</Text>
                <View style={styles.flex} />
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={busy === `d${r.id}`}
                  onPress={() => run(`d${r.id}`, () => declineRequest(r.id))}
                >
                  <Text style={styles.declineLink}>
                    {busy === `d${r.id}` ? "…" : "Decline"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={busy === `a${r.id}`}
                  onPress={() =>
                    run(`a${r.id}`, () => approveRequest(r.id).then(() => {}))
                  }
                  style={styles.approvePill}
                >
                  <Text style={styles.approveText}>
                    {busy === `a${r.id}` ? "…" : "Approve"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            {approved.map((r) => (
              <View key={r.id} style={styles.approvedRow}>
                <Avatar name={r.requesterName} size={24} />
                <Text style={styles.approvedName}>{r.requesterName}</Text>
                <Badge label="In" tone="green" />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => openChat(r.requesterId, r.requesterName)}
                >
                  <Text style={styles.messageLink}>Message</Text>
                </TouchableOpacity>
              </View>
            ))}
            {post.status !== "cancelled" &&
              new Date(post.startsAt).getTime() > Date.now() && (
                <View style={styles.hostActions}>
                  {post.status === "open" && (
                    <>
                      <Button
                        title="Edit post"
                        variant="secondary"
                        onPress={() =>
                          navigation.navigate("EditPost", { postId: post.id })
                        }
                      />
                      <View style={styles.gap} />
                    </>
                  )}
                  <Button
                    title="Cancel post"
                    variant="danger"
                    loading={busy === "cancel"}
                    onPress={onCancelPost}
                  />
                  <View style={styles.gap} />
                  <Button
                    title="Delete post"
                    variant="ghost"
                    loading={busy === "delete"}
                    onPress={() =>
                      Alert.alert(
                        "Delete this post?",
                        "It will be permanently removed for everyone. This cannot be undone.",
                        [
                          { text: "Keep it", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () =>
                              run("delete", async () => {
                                await deletePost(postId);
                                navigation.goBack();
                              }),
                          },
                        ],
                      )
                    }
                  />
                </View>
              )}
          </View>
        ) : (
          <View style={styles.section}>
            {(!myRequest ||
              myRequest.status === "declined" ||
              myRequest.status === "withdrawn") &&
            post.status !== "open" ? (
              <EmptyState
                title={`This post is ${post.status}`}
                hint="Keep an eye out for the next one."
              />
            ) : !myRequest ||
              myRequest.status === "declined" ||
              myRequest.status === "withdrawn" ? (
              <Button
                title="Request to join"
                loading={busy === "join"}
                onPress={() =>
                  myId &&
                  run("join", () => requestToJoin(postId, myId).then(() => {}))
                }
              />
            ) : myRequest.status === "pending" ? (
              <>
                <Badge label="Request pending" tone="neutral" />
                <View style={styles.gap} />
                <Button
                  title="Withdraw request"
                  variant="ghost"
                  loading={busy === "wd"}
                  onPress={() => run("wd", () => withdrawRequest(myRequest.id))}
                />
              </>
            ) : post.status === "cancelled" ? (
              <>
                <Badge label="Post cancelled" tone="red" />
                <Text style={styles.cancelledNote}>
                  The host cancelled this activity.
                </Text>
              </>
            ) : (
              <>
                <Badge label="You're in" tone="green" />
                <View style={styles.gap} />
                <Button
                  title="Message host"
                  variant="secondary"
                  loading={busy === "msg"}
                  onPress={() =>
                    post && myId && openChat(post.authorId, post.authorName)
                  }
                />
                <View style={styles.gap} />
                <Button
                  title="Leave activity"
                  variant="danger"
                  loading={busy === "lv"}
                  onPress={() =>
                    run("lv", () => cancelParticipation(myRequest.id))
                  }
                />
              </>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing.sm, paddingBottom: spacing.xl * 2 },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  back: { marginBottom: spacing.md, alignSelf: "flex-start" },
  backText: { ...typography.label, color: colors.textDim },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.text, flex: 1 },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: spacing.md,
  },
  authorName: {
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  meta: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  desc: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.lg,
    lineHeight: 22,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  section: { marginTop: spacing.xl },
  sectionTitle: {
    ...typography.label,
    color: colors.textDim,
    marginBottom: spacing.md,
  },
  reqName: { ...typography.body, color: colors.text, marginLeft: spacing.sm },
  approvedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  approvedName: { ...typography.body, color: colors.text, flex: 1 },
  messageLink: { ...typography.body, color: colors.clay, fontWeight: "600" },
  flex: { flex: 1 },
  reqRow2: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  declineLink: { ...typography.body, color: colors.textDim },
  approvePill: {
    backgroundColor: colors.clay,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  approveText: {
    ...typography.body,
    color: colors.onAccent,
    fontWeight: "600",
  },
  hostActions: { marginTop: spacing.lg },
  cancelledNote: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
  gap: { height: spacing.md },
});
