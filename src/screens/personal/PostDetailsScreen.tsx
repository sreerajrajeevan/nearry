import { LoadingState } from "../../components/LoadingState";
import { SafetyActions } from "../../components/SafetyActions";
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { postState } from "../../utils/flowState";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { Avatar } from "../../components/Avatar";
import { PostPhotoGallery } from "../../components/PostPhotoGallery";
import { colors, typography, spacing } from "../../theme";
import { getOrCreateConversation } from "../../services/chat";
import { PostDetailsProps } from "../../navigation/types";
import { useAuth } from "../../store/AuthContext";
import {
  getPost,
  cancelPost,
  deletePost,
  subscribeToPosts,
} from "../../services/posts";
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

  const [busy, setBusy] = useState<string | null>(null);
  const {
    data,
    state,
    error: errorMsg,
    refresh: load,
  } = useLiveQuery(
    `post:${postId}:${myId}`,
    async () => {
      const p = await getPost(postId);
      if (!p) throw new Error("Post not found.");
      const [reqs, mine] = await Promise.all([
        listRequestsForPost(postId),
        myId ? myRequestForPost(postId, myId) : Promise.resolve(null),
      ]);
      return { post: p, requests: reqs, myRequest: mine };
    },
    subscribeToPosts,
  );
  const post = data?.post;
  const requests = data?.requests ?? [];
  const myRequest = data?.myRequest;

  const isHost = !!myId && post?.authorId === myId;
  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");

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
        <LoadingState label="Loading this plan…" layout="detail" />
      </Screen>
    );
  }
  if (state === "error" || !post) {
    return (
      <Screen padded>
        <EmptyState title="Couldn't load this post" hint={errorMsg} />
        <Button title="Retry" onPress={() => void load()} />
        <View style={styles.gap} />
        <Button
          title="Go back"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const flow = postState(post);
  const spotsBadge = flow.accepting
    ? `${post.spotsLeft} spot${post.spotsLeft === 1 ? "" : "s"} left`
    : flow.label;

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
        <SafetyActions
          target={{
            kind: "post",
            id: postId,
            userId: post.authorId,
            name: post.authorName,
          }}
          onReport={() =>
            navigation.navigate("Report", {
              target: { kind: "post", id: postId, name: post.title },
            })
          }
          onBlocked={() => navigation.goBack()}
        />
        <PostPhotoGallery
          postId={postId}
          onReportPhoto={
            isHost
              ? undefined
              : (id) =>
                  navigation.navigate("Report", {
                    target: { kind: "photo", id, name: post.title },
                  })
          }
        />
        <Text style={styles.desc}>{post.description}</Text>
        {post.tags.length > 0 && (
          <View style={styles.tags}>
            {post.tags.map((t) => (
              <Badge key={t} label={`#${t}`} />
            ))}
          </View>
        )}

        {post.genderPreference && post.genderPreference !== "any" && (
          <Text style={styles.pref}>
            {post.genderPreference === "male" ? "Men only" : "Women only"}
          </Text>
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
              <View key={r.id}>
                <View style={styles.reqRow2}>
                  <Avatar name={r.requesterName} size={32} />
                  <Text style={styles.reqName}>{r.requesterName}</Text>
                  <View style={styles.flex} />
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={busy !== null}
                    onPress={() => run(`d${r.id}`, () => declineRequest(r.id))}
                  >
                    <Text style={styles.declineLink}>
                      {busy === `d${r.id}` ? "…" : "Decline"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={busy !== null || !flow.accepting}
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
                <SafetyActions
                  target={{
                    kind: "user",
                    id: r.requesterId,
                    userId: r.requesterId,
                    name: r.requesterName,
                  }}
                  onReport={() =>
                    navigation.navigate("Report", {
                      target: {
                        kind: "user",
                        id: r.requesterId,
                        name: r.requesterName,
                      },
                    })
                  }
                  onBlocked={() => void load()}
                />
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
            {flow.canCancel && (
              <View style={styles.hostActions}>
                {flow.canEdit && (
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
                <Button
                  title="Delete post"
                  variant="ghost"
                  disabled={busy !== null || requests.length > 0}
                  onPress={() =>
                    Alert.alert(
                      "Delete this post?",
                      "Posts without requests can be permanently deleted. Cancel plans with requests to retain their history.",
                      [
                        { text: "Keep it", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () =>
                            void run("delete", async () => {
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
            {post.status === "cancelled" ? (
              <EmptyState
                title="This plan was cancelled"
                hint="The host cancelled this plan. Find another hello nearby."
              />
            ) : myRequest?.declineCount !== undefined &&
              myRequest.declineCount >= 2 ? (
              <EmptyState
                title="No more requests"
                hint="The host passed on your requests for this plan."
              />
            ) : (!myRequest ||
                myRequest.status === "declined" ||
                myRequest.status === "withdrawn") &&
              !flow.accepting ? (
              <EmptyState
                title={
                  flow.label === "Past"
                    ? "This plan has passed"
                    : "Requests are closed"
                }
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
            ) : myRequest.status === "full" ? (
              <Badge label="Slot full" tone="neutral" />
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
            ) : (
              <>
                <Badge
                  label={flow.label === "Past" ? "Past plan" : "You're in"}
                  tone="green"
                />
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
                {flow.canLeave && (
                  <Button
                    title="Leave activity"
                    variant="danger"
                    loading={busy === "lv"}
                    onPress={() =>
                      run("lv", () => cancelParticipation(myRequest.id))
                    }
                  />
                )}
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
  pref: {
    ...typography.label,
    color: colors.clayDeep,
    marginTop: spacing.sm,
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
  gap: { height: spacing.md },
});
