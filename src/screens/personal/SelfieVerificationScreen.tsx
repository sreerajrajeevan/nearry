import React, { useCallback, useState } from "react";
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { LoadingState } from "../../components/LoadingState";
import { colors, typography, spacing } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { PersonalStackParamList } from "../../navigation/types";
import { getMySelfieReview, submitPersonalSelfie, SelfieReview } from "../../services/selfieVerification";

type Props = NativeStackScreenProps<PersonalStackParamList, "SelfieVerification">;
const EMPTY: SelfieReview = { status: "unverified" };

export function SelfieVerificationScreen({ navigation }: Props) {
  const { profile, demoMode } = useAuth();
  const [review, setReview] = useState<SelfieReview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (!profile || demoMode) { setLoading(false); return; }
    setLoading(true); setError("");
    try { setReview(await getMySelfieReview(profile.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load review status."); }
    finally { setLoading(false); }
  }, [profile?.id, demoMode]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const capture = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Use your phone", "Selfie review requires the Nearry mobile camera.");
      return;
    }
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Camera permission needed", "Enable camera access in your phone settings to take a selfie.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"], cameraType: ImagePicker.CameraType.front,
        allowsEditing: false, quality: 0.65,
      });
      if (!result.canceled && result.assets[0]?.uri)
        setPhoto(result.assets[0].uri);
    } catch (e) {
      Alert.alert("Could not open camera", e instanceof Error ? e.message : "Please try again.");
    }
  };
  const submit = async () => {
    if (!profile || !photo || !agreed || busy) return;
    setBusy(true); setError("");
    try {
      await submitPersonalSelfie(profile.id, photo);
      setPhoto(null); setAgreed(false);
      await refresh();
      Alert.alert("Submitted", "Your private selfie is awaiting a human review. No badge is shown until approval.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit selfie.");
    } finally { setBusy(false); }
  };

  const canApply = review.status === "unverified" || review.status === "rejected";
  const title = review.status === "verified" ? "Selfie checked" :
    review.status === "pending" ? "Awaiting review" :
    review.status === "rejected" ? "Verification needs another try" : "Check your profile photo";
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Selfie verification</Text>
        <Text style={styles.body}>
          Help other Nearry members recognise the person behind an account. A reviewer
          compares your private selfie with your current public profile picture.
        </Text>
        {loading ? <LoadingState label="Checking verification status…" layout="detail" /> :
          <View style={styles.status}>
            <Text style={styles.statusTitle}>{title}</Text>
            <Text style={styles.body}>
              {review.status === "verified" ? "A reviewer checked your selfie against your profile photo. This does not verify legal identity, age or guarantee safety." :
                review.status === "pending" ? "Your selfie is private while it is reviewed. You cannot submit another one yet." :
                review.status === "rejected" ? (review.note || "Please take a new, clear selfie.") :
                "The Selfie checked badge appears only after a human reviewer approves your submission."}
            </Text>
          </View>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {!loading && canApply && !demoMode && (
          <View style={styles.form}>
            {!profile?.avatarUrl ? (
              <>
                <Text style={styles.body}>First add a clear photo of your face to your Nearry profile.</Text>
                <Button title="Edit profile photo" variant="secondary"
                  onPress={() => navigation.navigate("EditProfile")} />
              </>
            ) : (
              <>
                <Text style={styles.instructions}>
                  Take a clear front-camera selfie in good light. No sunglasses or masks.
                  Gallery uploads are not accepted in this flow.
                </Text>
                {photo && <Image source={{ uri: photo }} style={styles.preview} resizeMode="cover" />}
                <Button title={photo ? "Retake selfie" : "Open front camera"}
                  variant="secondary" onPress={() => void capture()} />
                <TouchableOpacity accessibilityRole="checkbox"
                  accessibilityState={{ checked: agreed }} onPress={() => setAgreed(v => !v)}
                  style={styles.consent}>
                  <View style={[styles.checkbox, agreed && styles.checked]}>
                    {agreed && <Text style={styles.tick}>✓</Text>}
                  </View>
                  <Text style={[styles.body, styles.consentText]}>
                    I agree to Nearry storing this selfie privately for manual comparison
                    with my profile picture and deleting the review photo after a decision.
                  </Text>
                </TouchableOpacity>
                <Button title="Submit for human review" onPress={() => void submit()}
                  loading={busy} disabled={!photo || !agreed || Platform.OS === "web"} />
              </>
            )}
          </View>
        )}
        {demoMode && <Text style={styles.body}>Verification is disabled in demo mode.</Text>}
        <Text style={styles.footnote}>
          This is a photo comparison, not an ID check or certified liveness test.
          Your selfie is not publicly displayed. You can report suspicious accounts
          even if they have this badge. Verification is optional.
        </Text>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  back: { alignSelf: "flex-start", paddingVertical: spacing.sm },
  backText: { ...typography.label, color: colors.textDim },
  heading: { ...typography.display, color: colors.text, fontSize: 30 },
  body: { ...typography.bodySmall, color: colors.textDim, lineHeight: 21 },
  status: { padding: spacing.md, borderRadius: 18, backgroundColor: colors.white, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  statusTitle: { ...typography.title, color: colors.text, fontSize: 19 },
  error: { ...typography.bodySmall, color: colors.red },
  form: { gap: spacing.md },
  instructions: { ...typography.body, color: colors.text },
  preview: { width: 190, height: 230, alignSelf: "center", borderRadius: 20 },
  consent: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: spacing.sm },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checked: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: colors.white, fontWeight: "bold" },
  consentText: { flex: 1 },
  footnote: { ...typography.caption, color: colors.textDim, marginTop: spacing.lg },
});
