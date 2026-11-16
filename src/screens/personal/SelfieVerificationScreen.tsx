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
  withdrawPersonalSelfie,
  SelfieReview,
} from "../../services/selfieVerification";

import { submitPersonalSelfie } from "../../services/selfiePhoto";
import { personalProfileReady } from "../../utils/profileReadiness";
import { PageHeading } from "../../components/PageHeading";
import { Icon, IconName } from "../../components/Icon";
import { VerifiedAvatar } from "../../components/VerifiedAvatar";
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
    if (!profile || !photo || !agreed || submitLock.current) return;
    const run = active.current;
    submitLock.current = true;
    setBusy(true);
    setError("");
    try {
      await submitPersonalSelfie(profile.id, photo);
      if (run !== active.current) return;
      setPhoto(null);
      setAgreed(false);
      await refresh();
    } catch (e) {
      if (run !== active.current) return;
      // A lost response can follow a committed submission. Refresh before retrying.
      await refresh();
      if (run === active.current)
        setError(e instanceof Error ? e.message : "Could not submit selfie.");
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  };

  const canApply =
    review.status === "unverified" || review.status === "rejected";
  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton onPress={() => navigation.goBack()} />
        <PageHeading
          title={
            review.status === "verified" && !loading
              ? "You’re verified."
              : "A face to your hello."
          }
          greeting="SELFIE CHECK"
        />
        {loading ? (
          <LoadingState label="Checking verification status…" layout="detail" />
        ) : (
          <StatusHero
            review={review}
            name={profile?.displayName || "You"}
            avatarUrl={profile?.avatarUrl}
          />
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
                <Text style={styles.instructions}>
                  Take a clear front-camera selfie in good light. No sunglasses
                  or masks. Gallery uploads are not accepted in this flow.
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
                    I agree to Nearry storing this selfie privately for manual
                    comparison with my profile picture and queuing the review
                    photo for deletion after a decision, cancellation, or seven
                    days without a decision.
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
          </View>
        )}
        {demoMode && (
          <Text style={styles.body}>
            Verification is disabled in demo mode.
          </Text>
        )}
        <Text style={styles.footnote}>
          A photo comparison by a person, not an ID or age check. Your selfie is
          private and deleted after review. Unreviewed selfies expire after
          seven days.
        </Text>
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
              style={styles.remove}
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
      </ScrollView>
    </Screen>
  );
}
function formatDay(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function Point({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Icon name={icon} size={15} color={colors.success} />
      </View>
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

/** One clear card for where the selfie check stands. */
function StatusHero({
  review,
  name,
  avatarUrl,
}: {
  review: SelfieReview;
  name: string;
  avatarUrl?: string;
}) {
  if (review.status === "verified") {
    const day = formatDay(review.reviewedAt);
    return (
      <View style={[styles.hero, styles.heroVerified]}>
        <VerifiedAvatar name={name} uri={avatarUrl} verified />
        <Text style={styles.heroTitle}>Green tick is on</Text>
        <Text style={styles.heroBody}>
          A reviewer matched your selfie to your profile photo
          {day ? ` on ${day}` : ""}.
        </Text>
        <View style={styles.points}>
          <Point icon="user-check" text="Shows on your profile" />
          <Point icon="map-pin" text="Shows on the plans you host" />
          <Point icon="lock" text="Your selfie stays private" />
        </View>
      </View>
    );
  }
  const card: Record<
    Exclude<SelfieReview["status"], "verified">,
    { icon: IconName; title: string; body: string }
  > = {
    pending: {
      icon: "clock",
      title: "We’re checking your selfie",
      body: "A reviewer will compare it with your profile photo. We’ll send you a notification when it’s done.",
    },
    rejected: {
      icon: "refresh-cw",
      title: "Let’s try another photo",
      body: review.note || "Please take a new, clear selfie.",
    },
    unverified: {
      icon: "shield",
      title: "Get your green tick",
      body: "Take a quick selfie. A reviewer checks it matches your profile photo, then a green tick appears on your profile.",
    },
  };
  const c = card[review.status];
  return (
    <View style={styles.hero}>
      <View style={styles.heroIcon}>
        <Icon name={c.icon} size={26} color={colors.amberDeep} />
      </View>
      <Text style={styles.heroTitle}>{c.title}</Text>
      {review.status === "rejected" ? (
        <View style={styles.note}>
          <Text style={styles.noteLabel}>Reviewer’s note</Text>
          <Text style={styles.noteText}>{c.body}</Text>
        </View>
      ) : (
        <Text style={styles.heroBody}>{c.body}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.lg,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 10,
  },
  heroVerified: {
    backgroundColor: colors.successSoft,
    borderColor: "#A7F3D0",
    paddingTop: spacing.xl,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    ...typography.title,
    fontSize: 21,
    lineHeight: 27,
    color: colors.ink,
    textAlign: "center",
    ...weight("800"),
    marginTop: 4,
  },
  heroBody: {
    ...typography.bodySmall,
    color: colors.textDim,
    lineHeight: 21,
    textAlign: "center",
  },
  points: { alignSelf: "stretch", gap: 10, marginTop: 6 },
  point: { flexDirection: "row", alignItems: "center", gap: 10 },
  pointIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  pointText: { ...typography.bodySmall, color: colors.ink, flex: 1 },
  note: {
    alignSelf: "stretch",
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.amberSoft,
    gap: 4,
  },
  noteLabel: {
    fontSize: 12,
    color: colors.amberDeep,
    ...weight("800"),
  },
  noteText: { ...typography.bodySmall, color: colors.ink, lineHeight: 21 },
  remove: { alignSelf: "center" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  body: { ...typography.bodySmall, color: colors.textDim, lineHeight: 21 },
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
