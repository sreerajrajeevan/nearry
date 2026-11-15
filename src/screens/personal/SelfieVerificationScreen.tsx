import { Alert } from "../../services/appAlert";
import { BackButton } from "../../components/BackButton";
import React, { useCallback, useState, useRef, useEffect } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { LoadingState } from "../../components/LoadingState";
import { colors, typography, spacing, weight } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { PersonalStackParamList } from "../../navigation/types";
import {
  getMySelfieReview,
  hasSelfieComparisonAvatar,
  startSelfieChallenge,
  withdrawPersonalSelfie,
  SelfieChallenge,
  SelfieReview,
} from "../../services/selfieVerification";
import { poseEmoji, poseTimeLeft } from "../../utils/selfiePoses";

import { submitPersonalSelfie } from "../../services/selfiePhoto";
import { personalProfileReady } from "../../utils/profileReadiness";
import { PageHeading } from "../../components/PageHeading";
import * as FileSystem from "expo-file-system/legacy";

type Props = NativeStackScreenProps<
  PersonalStackParamList,
  "SelfieVerification"
>;
const EMPTY: SelfieReview = { status: "unverified" };

export function SelfieVerificationScreen({ navigation }: Props) {
  const { profile, demoMode } = useAuth();
  const [review, setReview] = useState<SelfieReview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const captureLock = useRef(false);
  const active = useRef(0);
  const [statusFailed, setStatusFailed] = useState(false);
  const [challenge, setChallenge] = useState<SelfieChallenge | null>(null);
  const [posing, setPosing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // Tick once a second while a pose is active, for the countdown.
  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [challenge]);
  const timeLeft = challenge ? poseTimeLeft(challenge.expiresAt, now) : null;
  const getPose = async () => {
    if (posing || busy) return;
    const run = active.current;
    setPosing(true);
    setError("");
    try {
      const next = await startSelfieChallenge();
      if (run !== active.current) return;
      setChallenge(next);
      setNow(new Date());
      setPhoto(null);
      setAgreed(false);
    } catch (e) {
      if (run === active.current)
        setError(e instanceof Error ? e.message : "Could not get a pose.");
    } finally {
      if (run === active.current) setPosing(false);
    }
  };
  useEffect(
    () => () => {
      if (photo && Platform.OS !== "web")
        void FileSystem.deleteAsync(photo, { idempotent: true }).catch(
          () => {},
        );
    },
    [photo],
  );
  const refresh = useCallback(async () => {
    const run = active.current;
    if (!profile || demoMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await getMySelfieReview(profile.id);
      if (run !== active.current) return;
      setReview(result);
      setStatusFailed(false);
    } catch (e) {
      if (run !== active.current) return;
      setStatusFailed(true);
      setError(
        e instanceof Error ? e.message : "Could not load review status.",
      );
    } finally {
      if (run === active.current) setLoading(false);
    }
  }, [profile?.id, demoMode]);
  useFocusEffect(
    useCallback(() => {
      active.current++;
      setReview(EMPTY);
      setPhoto(null);
      setAgreed(false);
      setChallenge(null);
      void refresh();
      return () => {
        active.current++;
      };
    }, [refresh]),
  );

  const capture = async () => {
    if (captureLock.current || submitLock.current) return;
    const run = active.current;
    if (Platform.OS === "web") {
      Alert.alert(
        "Use your phone",
        "Selfie review requires the Nearry mobile camera.",
      );
      return;
    }
    captureLock.current = true;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (run !== active.current) return;
      if (!permission.granted) {
        Alert.alert(
          "Camera permission needed",
          "Enable camera access in your phone settings to take a selfie.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: false,
        quality: 0.65,
      });
      if (run === active.current && !result.canceled && result.assets[0]?.uri) {
        setPhoto(result.assets[0].uri);
        setAgreed(false);
      }
    } catch (e) {
      if (run !== active.current) return;
      Alert.alert(
        "Could not open camera",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      captureLock.current = false;
    }
  };
  const submit = async () => {
    if (!profile || !photo || !agreed || !challenge || submitLock.current)
      return;
    const run = active.current;
    submitLock.current = true;
    setBusy(true);
    setError("");
    try {
      await submitPersonalSelfie(profile.id, photo, challenge.challengeId);
      if (run !== active.current) return;
      setPhoto(null);
      setAgreed(false);
      setChallenge(null);
      await refresh();
    } catch (e) {
      if (run !== active.current) return;
      // A lost response can follow a committed submission. Refresh before retrying.
      await refresh();
      if (run === active.current) {
        const message =
          e instanceof Error ? e.message : "Could not submit selfie.";
        // An expired or used pose cannot be retried; ask for a new one.
        if (/pose/i.test(message)) {
          setChallenge(null);
          setPhoto(null);
        }
        setError(message);
      }
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  };

  const canApply =
    review.status === "unverified" || review.status === "rejected";
  const title =
    review.status === "verified"
      ? "Selfie checked"
      : review.status === "pending"
        ? "Awaiting review"
        : review.status === "rejected"
          ? "Another photo, please"
          : "Check your profile photo";
  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton onPress={() => navigation.goBack()} />
        <PageHeading
          title="A face to your hello."
          greeting="OPTIONAL SELFIE CHECK"
        />
        <Text style={styles.body}>
          Help other Nearry members recognise the person behind an account. You
          copy a random pose in a selfie, and a reviewer compares it with your
          current public profile picture.
        </Text>
        {loading ? (
          <LoadingState label="Checking verification status…" layout="detail" />
        ) : (
          <View style={styles.status}>
            <Text style={styles.statusTitle}>{title}</Text>
            <Text style={styles.body}>
              {review.status === "verified"
                ? "A reviewer checked your selfie against your profile photo. This does not verify legal identity, age or guarantee safety."
                : review.status === "pending"
                  ? "Your selfie is private while it is reviewed. You cannot submit another one yet."
                  : review.status === "rejected"
                    ? review.note || "Please take a new, clear selfie."
                    : "The Selfie checked badge appears only after a human reviewer approves your submission."}
            </Text>
          </View>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {!loading && statusFailed && (
          <Button
            title="Retry status check"
            variant="secondary"
            onPress={() => void refresh()}
          />
        )}
        {!loading && !statusFailed && canApply && !demoMode && (
          <View style={styles.form}>
            {!personalProfileReady(profile) ? (
              <Button
                title="Complete my profile"
                onPress={() => navigation.navigate("CompleteProfile")}
              />
            ) : !profile ||
              !hasSelfieComparisonAvatar(profile.id, profile.avatarUrl) ? (
              <>
                <Text style={styles.body}>
                  First add a clear photo of your face to your Nearry profile.
                </Text>
                <Button
                  title="Edit profile photo"
                  variant="secondary"
                  onPress={() => navigation.navigate("EditProfile")}
                />
              </>
            ) : (
              <>
                {!challenge ? (
                  <View style={styles.poseIntro}>
                    <Text style={styles.poseIntroTitle}>
                      You’ll copy a random pose
                    </Text>
                    <Text style={styles.body}>
                      We’ll show you a pose, like a thumbs up. Take a selfie
                      doing it within 10 minutes. This shows the reviewer the
                      photo was taken just now, not an old picture.
                    </Text>
                    <Button
                      title="Get my pose"
                      loading={posing}
                      onPress={() => void getPose()}
                    />
                  </View>
                ) : !timeLeft ? (
                  <View style={styles.poseIntro}>
                    <Text style={styles.poseIntroTitle}>That pose expired</Text>
                    <Text style={styles.body}>
                      No problem. Get a new pose and take your selfie within 10
                      minutes.
                    </Text>
                    <Button
                      title="Get a new pose"
                      loading={posing}
                      onPress={() => void getPose()}
                    />
                  </View>
                ) : (
                  <>
                    <View
                      style={styles.poseCard}
                      accessible
                      accessibilityLabel={`Your pose: ${challenge.label}. ${timeLeft} left.`}
                    >
                      <Text style={styles.poseEmoji}>
                        {poseEmoji(challenge.pose)}
                      </Text>
                      <View style={styles.poseCopy}>
                        <Text style={styles.poseKicker}>YOUR POSE</Text>
                        <Text style={styles.poseLabel}>{challenge.label}</Text>
                        <Text style={styles.poseTimer}>{timeLeft} left</Text>
                      </View>
                    </View>
                    <Text style={styles.instructions}>
                      Copy the pose in a clear front-camera selfie, in good
                      light. Keep your whole face visible: no sunglasses or
                      masks. Gallery photos are not accepted.
                    </Text>
                    {photo && (
                      <Image
                        source={{ uri: photo }}
                        style={styles.preview}
                        resizeMode="cover"
                      />
                    )}
                    <Button
                      title={photo ? "Retake selfie" : "Open front camera"}
                      variant="secondary"
                      disabled={busy}
                      onPress={() => void capture()}
                    />
                    {!photo && (
                      <Button
                        title="Get a different pose"
                        variant="ghost"
                        disabled={busy || posing}
                        onPress={() => void getPose()}
                      />
                    )}
                  </>
                )}
                {!!challenge && !!timeLeft && (
                  <>
                    <TouchableOpacity
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: agreed }}
                      disabled={busy}
                      onPress={() => setAgreed((v) => !v)}
                      style={styles.consent}
                    >
                      <View style={[styles.checkbox, agreed && styles.checked]}>
                        {agreed && <Text style={styles.tick}>✓</Text>}
                      </View>
                      <Text style={[styles.body, styles.consentText]}>
                        I agree to Nearry storing this selfie privately for
                        manual comparison with my profile picture and the
                        requested pose and queuing the review photo for deletion
                        after a decision, cancellation, or seven days without a
                        decision.
                      </Text>
                    </TouchableOpacity>
                    <Button
                      title="Submit for human review"
                      onPress={() => void submit()}
                      loading={busy}
                      disabled={!photo || !agreed || Platform.OS === "web"}
                    />
                  </>
                )}
              </>
            )}
          </View>
        )}
        {!loading &&
          !demoMode &&
          ["pending", "verified"].includes(review.status) && (
            <Button
              title={
                review.status === "pending"
                  ? "Cancel selfie review"
                  : "Remove selfie check"
              }
              variant="ghost"
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  "Remove this selfie check?",
                  "The badge will be removed and any pending private selfie queued for deletion.",
                  [
                    { text: "Keep it", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () => {
                        if (submitLock.current) return;
                        submitLock.current = true;
                        setBusy(true);
                        void withdrawPersonalSelfie()
                          .then(refresh)
                          .catch((e) => setError(e.message))
                          .finally(() => {
                            submitLock.current = false;
                            setBusy(false);
                          });
                      },
                    },
                  ],
                )
              }
            />
          )}
        {demoMode && (
          <Text style={styles.body}>
            Verification is disabled in demo mode.
          </Text>
        )}
        <Text style={styles.footnote}>
          This is a photo comparison, not an ID check or certified liveness
          test. Your selfie is not publicly displayed. You can report suspicious
          accounts even if they have this badge. The badge is optional.
          Unreviewed selfies expire after seven days.
        </Text>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  poseIntro: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  poseIntroTitle: { ...typography.body, ...weight("700"), color: colors.text },
  poseCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.night,
  },
  poseEmoji: { fontSize: 52, lineHeight: 62 },
  poseCopy: { flex: 1, gap: 3 },
  poseKicker: {
    fontSize: 11,
    letterSpacing: 1,
    color: colors.amberBright,
    ...weight("800"),
  },
  poseLabel: {
    fontSize: 18,
    lineHeight: 23,
    color: "#FFFFFF",
    ...weight("800"),
  },
  poseTimer: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    ...weight("600"),
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  heading: { ...typography.display, color: colors.text, fontSize: 30 },
  body: { ...typography.bodySmall, color: colors.textDim, lineHeight: 21 },
  status: {
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.white,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusTitle: { ...typography.title, color: colors.text, fontSize: 19 },
  error: { ...typography.bodySmall, color: colors.red },
  form: { gap: spacing.md },
  instructions: { ...typography.body, color: colors.text },
  preview: { width: 190, height: 230, alignSelf: "center", borderRadius: 20 },
  consent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: colors.white, ...weight("bold") },
  consentText: { flex: 1 },
  footnote: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.lg,
  },
});
