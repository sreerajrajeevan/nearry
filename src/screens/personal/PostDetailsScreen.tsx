import { Alert } from "../../services/appAlert";
import { AudienceBadge, audienceLabel } from "../../components/AudienceBadge";
import { ProfileRequired } from "../../components/ProfileRequired";
import {
  personalProfileReady,
  matchesPostAudience,
  isProfileCompletionError,
} from "../../utils/profileReadiness";
import { LoadingState } from "../../components/LoadingState";
import { SafetyActions } from "../../components/SafetyActions";
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  Linking,
  Modal,
  Pressable,
} from "react-native";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { postState } from "../../utils/flowState";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { isPersonalSelfieChecked } from "../../services/selfieVerification";
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
import { formatWhen, formatTime } from "../../utils/format";

import { Icon } from "../../components/Icon";
import { MotionPressable } from "../../components/Motion";
import { PlanCover } from "../../components/PlanCover";
import { postCategory } from "../../utils/discovery";
import { planCost } from "../../utils/planDiscovery";
import { getVenue } from "../../services/venues";
import { publicAvatars } from "../../services/profile";
import { useReducedMotion } from "../../store/MotionContext";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Post details: host manages requests, participants request/withdraw.
 * Realtime subscription keeps every device in sync.
 */
export function PostDetailsScreen({ route, navigation }: PostDetailsProps) {
  const { postId } = route.params;
  const { profile, refreshProfile } = useAuth();
  const myId = profile?.id;

  const [profilePrompt, setProfilePrompt] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const requestsTop = useRef(0);
  const reduced = useReducedMotion();
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
      const [reqs, mine, selfieChecked, venue, avatars] = await Promise.all([
        listRequestsForPost(postId),
        myId ? myRequestForPost(postId, myId) : Promise.resolve(null),
        isPersonalSelfieChecked(p.authorId).catch(() => false),
        p.venueId
          ? getVenue(p.venueId).catch(() => null)
          : Promise.resolve(null),
        publicAvatars([p.authorId]).catch(() => new Map<string, string>()),
      ]);
      return {
        post: p,
        requests: reqs,
        myRequest: mine,
        selfieChecked,
        venue,
        authorAvatar: avatars.get(p.authorId),
      };
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
      if (key === "join" && isProfileCompletionError(e)) {
        setProfilePrompt(true);
        // Refresh stale account details without hiding the recovery action if
        // the network fails. The user can still open the completion form.
        void refreshProfile().catch(() => {});
        return;
      }
      Alert.alert(
        key === "join" ? "Request not sent" : "Could not update this plan",
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

  const locationName = post.venueName || data?.venue?.name;
  const goToRequests = () =>
    scroll.current?.scrollTo({ y: requestsTop.current, animated: !reduced });
  const share = () =>
    void Share.share({
      message: [
        post.title,
        formatWhen(post.startsAt),
        locationName,
        "Join me on Nearry.",
      ]
        .filter(Boolean)
        .join("\n"),
    }).catch(() => Alert.alert("Could not share", "Please try again."));

  return (
    <Screen padded={false}>
      <View style={styles.toolbar}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
        >
          <Icon name="arrow-left" size={23} color={colors.text} />
        </MotionPressable>
        <Text accessibilityRole="header" style={styles.toolbarTitle}>
          Plan details
        </Text>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Share plan"
          onPress={share}
          style={styles.iconButton}
        >
          <Icon name="share-2" size={21} color={colors.text} />
        </MotionPressable>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Plan options"
          onPress={() => setOptionsOpen(true)}
          style={styles.iconButton}
        >
          <Icon name="more-horizontal" size={23} color={colors.text} />
        </MotionPressable>
      </View>
      <ScrollView
        ref={scroll}
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <PostPhotoGallery
          postId={postId}
          fallback={
            <View style={styles.cover}>
              <PlanCover post={post} />
            </View>
          }
          onReportPhoto={
            isHost
              ? undefined
              : (id) =>
                  navigation.navigate("Report", {
                    target: { kind: "photo", id, name: post.title },
                  })
          }
        />
        <View style={styles.categoryRow}>
          <Text style={styles.category}>{postCategory(post)}</Text>
          <Badge
            label={spotsBadge}
            tone={flow.accepting ? "green" : "neutral"}
          />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {post.title}
        </Text>
        <View style={styles.authorRow}>
          <Avatar name={post.authorName} uri={data?.authorAvatar} size={40} />
          <View style={styles.flex}>
            <Text style={styles.hostLabel}>Hosted by</Text>
            <Text style={styles.authorName}>{post.authorName}</Text>
          </View>
          {data?.selfieChecked && <Badge label="Selfie checked" tone="green" />}
        </View>
        <View style={styles.facts}>
          <View style={styles.factRow}>
            <Icon name="calendar" size={22} color={colors.text} />
            <View style={styles.flex}>
              <Text style={styles.factTitle}>
                {new Date(post.startsAt).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
              <Text style={styles.meta}>{formatTime(post.startsAt)}</Text>
            </View>
          </View>
          <View style={styles.factRow}>
            <Icon name="map-pin" size={22} color={colors.text} />
            <View style={styles.flex}>
              <Text style={styles.factTitle}>
                {locationName || "Location to be confirmed"}
              </Text>
              {!!data?.venue?.area && (
                <Text style={styles.meta}>{data.venue.area}</Text>
              )}
            </View>
            {!!locationName && (
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel={`Directions to ${locationName}`}
                onPress={() =>
                  void Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([locationName, data?.venue?.area].filter(Boolean).join(" "))}`,
                  ).catch(() =>
                    Alert.alert("Couldn’t open maps", "Please try again."),
                  )
                }
                style={styles.directions}
              >
                <Text style={styles.directionsText}>Directions</Text>
              </MotionPressable>
            )}
          </View>
          <View style={[styles.factRow, styles.lastFact]}>
            <Icon name="users" size={22} color={colors.text} />
            <View style={styles.flex}>
              <Text style={styles.factTitle}>
                {flow.accepting
                  ? `${post.spotsLeft} spot${post.spotsLeft === 1 ? "" : "s"} available`
                  : flow.label}
              </Text>
              <Text style={styles.meta}>The host approves join requests.</Text>
            </View>
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.sectionHeading}>
          About the plan
        </Text>
        <Text style={styles.desc}>{post.description}</Text>
        <View style={styles.audience}>
          <AudienceBadge preference={post.genderPreference} />
        </View>
        {post.tags.length > 0 && (
          <View style={styles.tags}>
            {post.tags.map((tag) => (
              <Text key={tag} style={styles.tag}>
                #{tag}
              </Text>
            ))}
          </View>
        )}
        {post.expiresAt && (
          <Text style={styles.expiry}>
            Requests close {formatWhen(post.expiresAt)}
          </Text>
        )}
        {post.joinedCount > 0 && (
          <Text style={styles.meta}>
            {post.joinedCount}{" "}
            {post.joinedCount === 1 ? "person has" : "people have"} been
            approved.
          </Text>
        )}
        {isHost && (
          <View
            style={styles.section}
            onLayout={(event) => {
              requestsTop.current = event.nativeEvent.layout.y;
            }}
          >
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
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    disabled={busy !== null}
                    onPress={() => run(`d${r.id}`, () => declineRequest(r.id))}
                  >
                    <Text style={styles.declineLink}>
                      {busy === `d${r.id}` ? "…" : "Decline"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
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
                  accessibilityRole="button"
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
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.cost}>{planCost(post)}</Text>
        {isHost ? (
          <View style={styles.participantActions}>
            <Button
              title={requests.length ? "Manage requests" : "Manage plan"}
              variant="solid"
              onPress={goToRequests}
            />
          </View>
        ) : (
          <View style={styles.participantActions}>
            {post.status === "cancelled" ? (
              <Text style={styles.footerStatus}>
                This plan was cancelled by the host.
              </Text>
            ) : myRequest?.declineCount !== undefined &&
              myRequest.declineCount >= 2 ? (
              <Text style={styles.footerStatus}>
                No more requests for this plan.
              </Text>
            ) : (!myRequest ||
                myRequest.status === "declined" ||
                myRequest.status === "withdrawn") &&
              !flow.accepting ? (
              <Text style={styles.footerStatus}>
                {flow.label === "Past"
                  ? "This plan has passed."
                  : "Requests are closed."}
              </Text>
            ) : !myRequest ||
              myRequest.status === "declined" ||
              myRequest.status === "withdrawn" ? (
              <Button
                variant="solid"
                title={
                  !personalProfileReady(profile)
                    ? "Complete profile to join"
                    : matchesPostAudience(post, profile?.gender)
                      ? "Request to join"
                      : audienceLabel(post.genderPreference)
                }
                disabled={
                  personalProfileReady(profile) &&
                  !matchesPostAudience(post, profile?.gender)
                }
                loading={busy === "join"}
                onPress={() => {
                  if (!personalProfileReady(profile)) {
                    setProfilePrompt(true);
                    return;
                  }
                  if (myId && matchesPostAudience(post, profile?.gender))
                    void run("join", () =>
                      requestToJoin(postId, myId).then(() => {}),
                    );
                }}
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
      </View>
      <ProfileRequired
        intent="join"
        visible={profilePrompt}
        onComplete={() => {
          setProfilePrompt(false);
          navigation.navigate("CompleteProfile");
        }}
        onBrowse={() => setProfilePrompt(false)}
      />
      <Modal
        visible={optionsOpen}
        transparent
        animationType={reduced ? "none" : "fade"}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOptionsOpen(false)}
      >
        <View style={styles.scrim}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessible={false}
            onPress={() => setOptionsOpen(false)}
          />
          <SafeAreaView
            edges={["bottom", "left", "right"]}
            style={styles.sheet}
            accessibilityViewIsModal
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetContent}
            >
              <View style={styles.sheetHeader}>
                <Text accessibilityRole="header" style={styles.sectionHeading}>
                  Plan options
                </Text>
                <MotionPressable
                  accessibilityRole="button"
                  accessibilityLabel="Close plan options"
                  style={styles.iconButton}
                  onPress={() => setOptionsOpen(false)}
                >
                  <Icon name="x" size={22} />
                </MotionPressable>
              </View>
              <Button
                title="Share plan"
                variant="secondary"
                onPress={() => {
                  setOptionsOpen(false);
                  share();
                }}
              />
              {isHost ? (
                <Button
                  title="Manage my plan"
                  variant="ghost"
                  onPress={() => {
                    setOptionsOpen(false);
                    goToRequests();
                  }}
                />
              ) : (
                <SafetyActions
                  target={{
                    kind: "post",
                    id: postId,
                    userId: post.authorId,
                    name: post.authorName,
                  }}
                  onReport={() => {
                    setOptionsOpen(false);
                    navigation.navigate("Report", {
                      target: { kind: "post", id: postId, name: post.title },
                    });
                  }}
                  onBlocked={() => {
                    setOptionsOpen(false);
                    navigation.goBack();
                  }}
                />
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 28 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  toolbarTitle: {
    ...typography.heading,
    color: colors.forest,
    flex: 1,
    paddingLeft: 6,
  },
  iconButton: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cover: { borderRadius: 20, overflow: "hidden" },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  category: {
    ...typography.caption,
    color: colors.sageDeep,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    ...typography.title,
    fontSize: 28,
    lineHeight: 35,
    color: colors.forest,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 20,
  },
  hostLabel: { ...typography.caption, color: colors.textDim },
  authorName: { ...typography.body, color: colors.text, fontWeight: "600" },
  facts: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  factRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  lastFact: { borderBottomWidth: 0 },
  factTitle: { ...typography.body, fontWeight: "600", color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textDim, marginTop: 3 },
  directions: { minHeight: 44, justifyContent: "center", paddingLeft: 4 },
  directionsText: {
    ...typography.bodySmall,
    color: colors.forest,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  sectionHeading: {
    ...typography.heading,
    fontSize: 21,
    lineHeight: 28,
    color: colors.forest,
    marginTop: 24,
    marginBottom: 10,
  },
  desc: { ...typography.body, color: colors.text, lineHeight: 25 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  tag: { ...typography.bodySmall, color: colors.textDim },
  audience: { marginTop: 14 },
  expiry: { ...typography.caption, color: colors.textDim, marginVertical: 16 },
  footer: {
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  cost: { ...typography.bodySmall, color: colors.text, fontWeight: "600" },
  participantActions: { gap: 4 },
  footerStatus: { ...typography.body, color: colors.textDim },
  section: { marginTop: 26 },
  sectionTitle: { ...typography.heading, color: colors.text, marginBottom: 12 },
  reqName: { ...typography.body, color: colors.text, flex: 1 },
  reqRow2: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  declineLink: { ...typography.bodySmall, color: colors.textDim },
  approvePill: {
    backgroundColor: colors.forest,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  approveText: {
    ...typography.bodySmall,
    color: colors.onAccent,
    fontWeight: "600",
  },
  approvedRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  approvedName: { ...typography.bodySmall, color: colors.text, flex: 1 },
  messageLink: {
    ...typography.bodySmall,
    color: colors.forest,
    fontWeight: "600",
  },
  hostActions: { marginTop: 20, gap: 8 },
  gap: { height: spacing.sm },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(8,37,27,0.38)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
  },
  sheetContent: { padding: 24 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
});
