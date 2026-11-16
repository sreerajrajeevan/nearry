import { Alert } from "../../services/appAlert";
import { PlanDetailsSkeleton } from "../../components/Skeletons";
import { useToast } from "../../store/ToastContext";
import { useMyRequests } from "../../store/MyRequestsContext";
import {
  joinNoteHint,
  planAgeLabel,
  planBookingLabel,
} from "../../utils/planComposer";
import { JoinRequestSheet } from "../../components/JoinRequestSheet";
import { RequestNote } from "../../components/RequestNote";
import { PersonLink } from "../../components/PersonLink";
import { haptic } from "../../services/haptics";
import { planShareMessage } from "../../utils/shareLink";
import { AudienceBadge, audienceLabel } from "../../components/AudienceBadge";
import { ProfileRequired } from "../../components/ProfileRequired";
import {
  personalProfileReady,
  matchesPostAudience,
  isProfileCompletionError,
} from "../../utils/profileReadiness";
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
import { colors, typography, spacing, weight } from "../../theme";
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

import { GoogleMapsCredit } from "../../components/PlaceSuggestions";
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
  // A request just sent shows as pending at once, before the server replies.
  const [sentNote, setSentNote] = useState<string | null>(null);
  const loadedRequest = data?.myRequest;
  const myRequest =
    sentNote !== null &&
    (!loadedRequest ||
      loadedRequest.status === "declined" ||
      loadedRequest.status === "withdrawn")
      ? {
          ...(loadedRequest ?? {}),
          id: "",
          status: "pending" as const,
          note: sentNote || undefined,
          declineCount: loadedRequest?.declineCount ?? 0,
        }
      : loadedRequest;

  const isHost = !!myId && post?.authorId === myId;
  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");

  const myRequests = useMyRequests();
  const toast = useToast();
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [retryNote, setRetryNote] = useState("");
  const sendJoin = async (note: string) => {
    if (!myId || busy) return;
    setBusy("join");
    setJoinError("");
    // Instant: close the sheet and show "Requested" now; undo if it fails.
    setJoinOpen(false);
    setSentNote(note.trim());
    myRequests?.markPlan(postId, "pending");
    toast(
      `Request sent to ${post?.authorName.split(" ")[0] || "the host"}`,
      "send",
    );
    try {
      await requestToJoin(postId, myId, note);
      haptic("success");
      void myRequests?.refresh();
      await load();
    } catch (e) {
      myRequests?.markPlan(postId, null);
      if (isProfileCompletionError(e)) {
        setProfilePrompt(true);
        void refreshProfile().catch(() => {});
        return;
      }
      setRetryNote(note);
      setJoinError(e instanceof Error ? e.message : "Something went wrong.");
      setJoinOpen(true);
    } finally {
      setSentNote(null);
      setBusy(null);
    }
  };
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      // Withdraw / leave change what plan cards show elsewhere.
      void myRequests?.refresh();
      if (key === "wd") toast("Request withdrawn", "rotate-ccw");
      else if (key === "lv") toast("You left this plan", "log-out");
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
      <Screen padded={false}>
        <PlanDetailsSkeleton />
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
  const details = post.planDetails;
  const detailChips = [
    details?.durationMinutes
      ? details.durationMinutes >= 60 && details.durationMinutes % 60 === 0
        ? `${details.durationMinutes / 60} hr`
        : `${details.durationMinutes} min`
      : "",
    details?.level && details.level !== "any" ? `${details.level} level` : "",
    details ? (planAgeLabel(details) ?? "") : "",
    details?.venueBooked
      ? `${planBookingLabel(details.activity) ?? "Venue booked"}`
      : "",
  ].filter(Boolean);
  const spotsBadge = flow.accepting
    ? `${post.spotsLeft} spot${post.spotsLeft === 1 ? "" : "s"} left`
    : flow.label;

  const locationName = post.venueName || data?.venue?.name;
  const goToRequests = () =>
    scroll.current?.scrollTo({ y: requestsTop.current, animated: !reduced });
  const share = () =>
    void Share.share({
      message: planShareMessage({
        id: post.id,
        title: post.title,
        when: formatWhen(post.startsAt),
        where: locationName,
      }),
    }).catch(() => Alert.alert("Could not share", "Please try again."));

  return (
    <Screen padded={false}>
      <ScrollView
        ref={scroll}
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.hero}>
          <PostPhotoGallery
            postId={postId}
            bleed
            fallback={
              <PlanCover post={post} aspectRatio={1.3} artworkSize={150} />
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
          <View style={styles.toolbar} pointerEvents="box-none">
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              style={styles.iconButton}
            >
              <Icon name="arrow-left" size={21} color={colors.ink} />
            </MotionPressable>
            <View style={styles.flex} pointerEvents="none" />
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Share plan"
              onPress={share}
              style={styles.iconButton}
            >
              <Icon name="share-2" size={19} color={colors.ink} />
            </MotionPressable>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Plan options"
              onPress={() => setOptionsOpen(true)}
              style={styles.iconButton}
            >
              <Icon name="more-horizontal" size={21} color={colors.ink} />
            </MotionPressable>
          </View>
        </View>
        <View style={styles.sheetTop}>
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
          <View style={styles.audience}>
            <AudienceBadge preference={post.genderPreference} />
          </View>
        </View>
        <View style={styles.grid}>
          <View style={styles.tile}>
            <Icon name="calendar" size={18} color={colors.amberDeep} />
            <Text style={styles.tileLabel}>When</Text>
            <Text style={styles.tileValue} numberOfLines={2}>
              {new Date(post.startsAt).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </Text>
            <Text style={styles.tileMeta}>{formatTime(post.startsAt)}</Text>
          </View>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={
              locationName
                ? `Where: ${locationName}. Get directions`
                : "Location to be confirmed"
            }
            disabled={!locationName}
            onPress={() =>
              void Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location ? `${post.location.latitude},${post.location.longitude}` : [locationName, data?.venue?.area].filter(Boolean).join(" "))}`,
              ).catch(() =>
                Alert.alert("Couldn’t open maps", "Please try again."),
              )
            }
            style={styles.tile}
          >
            <Icon name="map-pin" size={18} color={colors.amberDeep} />
            <Text style={styles.tileLabel}>Where</Text>
            <Text style={styles.tileValue} numberOfLines={2}>
              {locationName || "To be confirmed"}
            </Text>
            {!!locationName && (
              <Text style={styles.tileLink}>Directions ›</Text>
            )}
          </MotionPressable>
          <View style={styles.tile}>
            <Icon name="users" size={18} color={colors.amberDeep} />
            <Text style={styles.tileLabel}>Group</Text>
            <Text style={styles.tileValue}>
              {post.joinedCount} of {post.vacancies} joined
            </Text>
            <Text style={styles.tileMeta}>
              {flow.accepting ? "Host approves requests" : flow.label}
            </Text>
          </View>
          <View style={styles.tile}>
            <Icon name="tag" size={18} color={colors.amberDeep} />
            <Text style={styles.tileLabel}>Cost</Text>
            <Text style={styles.tileValue}>
              {post.costCents === 0
                ? "Free"
                : post.costCents == null
                  ? "Not set"
                  : planCost(post)}
            </Text>
            {post.planDetails?.costMode === "split" && (
              <Text style={styles.tileMeta}>
                Split · ₹
                {((post.planDetails.totalCostCents ?? 0) / 100).toLocaleString(
                  "en-IN",
                )}{" "}
                total
              </Text>
            )}
          </View>
        </View>
        {post.location?.source === "google" && <GoogleMapsCredit />}
        {!!detailChips.length && (
          <View style={styles.chips}>
            {detailChips.map((chip) => (
              <Text key={chip} style={styles.chip}>
                {chip}
              </Text>
            ))}
          </View>
        )}
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={`Hosted by ${post.authorName}. View profile`}
          disabled={isHost}
          onPress={() =>
            navigation.navigate("HostProfile", {
              userId: post.authorId,
              name: post.authorName,
            })
          }
          style={styles.hostCard}
        >
          <Avatar name={post.authorName} uri={data?.authorAvatar} size={46} />
          <View style={styles.flex}>
            <Text style={styles.hostLabel}>
              {isHost ? "You’re hosting" : "Hosted by"}
            </Text>
            <Text style={styles.authorName}>{post.authorName}</Text>
          </View>
          {data?.selfieChecked && <Badge label="Selfie checked" tone="green" />}
          {!isHost && (
            <Icon name="chevron-right" size={18} color={colors.textDim} />
          )}
        </MotionPressable>
        <Text accessibilityRole="header" style={styles.sectionHeading}>
          About the plan
        </Text>
        <Text style={styles.desc}>{post.description}</Text>
        {post.planDetails?.costMode === "split" && (
          <Text style={styles.meta}>
            The per-person share assumes a full group; final shares may vary.
          </Text>
        )}
        {((isHost && post.joinedCount > 0) ||
          myRequest?.status === "approved") && (
          <View style={{ marginBottom: 16 }}>
            <Button
              title="Open plan group"
              variant="secondary"
              onPress={() => navigation.navigate("PlanGroup", { postId })}
            />
            <Text style={styles.meta}>
              You and the approved members. New approvals join automatically.
            </Text>
          </View>
        )}
        {isHost && post.joinedCount === 0 && (
          <Text style={[styles.meta, { marginBottom: 16 }]}>
            Your group chat opens when your first member is approved to join.
          </Text>
        )}
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
                  <PersonLink
                    name={r.requesterName}
                    avatarUrl={r.requesterAvatar}
                    size={36}
                    onPress={() =>
                      navigation.navigate("HostProfile", {
                        userId: r.requesterId,
                        name: r.requesterName,
                        requestNote: r.note,
                      })
                    }
                  />
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
                      run(`a${r.id}`, () =>
                        approveRequest(r.id).then(() => haptic("success")),
                      )
                    }
                    style={styles.approvePill}
                  >
                    <Text style={styles.approveText}>
                      {busy === `a${r.id}` ? "…" : "Approve"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <RequestNote note={r.note} />
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
                <PersonLink
                  name={r.requesterName}
                  avatarUrl={r.requesterAvatar}
                  size={32}
                  subtitle="Going"
                  onPress={() =>
                    navigation.navigate("HostProfile", {
                      userId: r.requesterId,
                      name: r.requesterName,
                    })
                  }
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate("PlanGroup", { postId })}
                >
                  <Text style={styles.messageLink}>Group chat</Text>
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
                  if (myId && matchesPostAudience(post, profile?.gender)) {
                    setJoinError("");
                    setJoinOpen(true);
                  }
                }}
              />
            ) : myRequest.status === "full" ? (
              <Badge label="Slot full" tone="neutral" />
            ) : myRequest.status === "pending" ? (
              <>
                <Badge label="Request pending" tone="neutral" />
                <RequestNote note={myRequest.note} mine />
                <View style={styles.gap} />
                <Button
                  title={myRequest.id ? "Withdraw request" : "Sending…"}
                  variant="ghost"
                  loading={busy === "wd"}
                  disabled={!myRequest.id}
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
                  title="Open plan chat"
                  variant="secondary"
                  onPress={() => navigation.navigate("PlanGroup", { postId })}
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
      <JoinRequestSheet
        visible={joinOpen}
        planTitle={post.title}
        hostName={post.authorName.split(" ")[0] || "the host"}
        placeholder={joinNoteHint(post.planDetails?.activity)}
        sending={busy === "join"}
        error={joinError}
        initialNote={retryNote}
        onSend={(note) => void sendJoin(note)}
        onClose={() => setJoinOpen(false)}
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
  hero: { marginHorizontal: -20, position: "relative" },
  toolbar: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sheetTop: {
    marginHorizontal: -20,
    marginTop: -22,
    paddingHorizontal: 20,
    paddingTop: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.background,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 104,
    padding: 14,
    gap: 3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileLabel: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 6,
  },
  tileValue: { ...typography.body, color: colors.ink, ...weight("800") },
  tileMeta: { ...typography.caption, color: colors.textDim },
  tileLink: {
    ...typography.caption,
    color: colors.amberDeep,
    ...weight("800"),
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  chip: {
    ...typography.caption,
    color: colors.ink,
    ...weight("700"),
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: colors.amberSoft,
    overflow: "hidden",
    textTransform: "capitalize",
  },
  hostCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
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
    ...weight("700"),
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
  authorName: { ...typography.body, color: colors.text, ...weight("600") },
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
  factTitle: { ...typography.body, ...weight("600"), color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textDim, marginTop: 3 },
  directions: { minHeight: 44, justifyContent: "center", paddingLeft: 4 },
  directionsText: {
    ...typography.bodySmall,
    color: colors.forest,
    ...weight("600"),
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
  cost: { ...typography.bodySmall, color: colors.text, ...weight("600") },
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
    ...weight("600"),
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
    ...weight("600"),
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
