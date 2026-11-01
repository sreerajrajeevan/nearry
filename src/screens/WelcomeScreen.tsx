import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { BrandLogo } from "../components/BrandLogo";
import { NearryAtmosphere } from "../components/NearryAtmosphere";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { MotionPressable } from "../components/Motion";
import { TermsAgreement } from "../components/TermsAgreement";
import { colors, typography, spacing } from "../theme";
import { RootStackParamList } from "../navigation/types";
import { useAuth } from "../store/AuthContext";
import { isSupabaseConfigured } from "../services/supabase";
import { AGREEMENT_REQUIRED } from "../services/terms";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

/**
 * Premium Nearry welcome: exact brand artwork, a quiet orbital motif,
 * rich typography and two real sign-in paths. No demo entries or fake
 * nearby users/places. The 18+ agreement is still explicit for signup.
 */
export function WelcomeScreen({ navigation }: Props) {
  const { signInGoogle, loading } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");

  const continueGoogle = async () => {
    if (loading) return;
    setError("");
    if (!agreed) {
      setError(AGREEMENT_REQUIRED);
      return;
    }
    if (!isSupabaseConfigured) {
      setError("Google sign-in is not configured in this build.");
      return;
    }
    try {
      await signInGoogle("personal", true, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start Google sign-in.");
    }
  };

  return (
    <Screen padded={false}>
      <View style={styles.background} pointerEvents="none">
        <NearryAtmosphere />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.page}
      >
        <View style={styles.masthead}>
          <View style={styles.orbitAccent} pointerEvents="none">
            <View style={styles.orbitLine} />
            <View style={styles.orbitPoint} />
          </View>
          <BrandLogo width={190} />
          <Text style={styles.eyebrow}>YOUR WORLD, A LITTLE CLOSER</Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>
            Less scrolling.{"\n"}<Text style={styles.accent}>More living.</Text>
          </Text>
          <Text style={styles.description}>
            Find real plans, meet people through activities and discover nearby local experiences.
          </Text>
        </View>

        <View style={styles.actions}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ disabled: loading, busy: loading }}
            onPress={() => void continueGoogle()}
            disabled={loading}
            style={styles.googleButton}
          >
            <View style={styles.googleCircle} accessible={false}>
              <Text style={styles.googleG}>G</Text>
            </View>
            <Text style={styles.googleText}>
              {loading ? "Connecting…" : "Continue with Google"}
            </Text>
          </MotionPressable>
          <Button
            title="Continue with Email"
            variant="secondary"
            onPress={() => navigation.navigate("PersonalAuth", { mode: "signup" })}
            style={styles.emailButton}
          />
          <TermsAgreement
            checked={agreed}
            disabled={loading}
            onChange={v => { setAgreed(v); setError(""); }}
            onTerms={() => navigation.navigate("Legal", { page: "terms" })}
            onPrivacy={() => navigation.navigate("Legal", { page: "privacy" })}
          />
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          )}
          <MotionPressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("PersonalAuth", { mode: "login" })}
            style={styles.login}
          >
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginLink}>Log in</Text>
            </Text>
          </MotionPressable>
          <MotionPressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("BusinessAuth", { mode: "signup" })}
            style={styles.business}
          >
            <Icon name="briefcase" size={15} color={colors.clayDeep} />
            <Text style={styles.businessText}>Joining as a business?</Text>
            <Icon name="arrow-up-right" size={15} color={colors.clayDeep} />
          </MotionPressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  background: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  page: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 42,
    paddingBottom: 22,
  },
  masthead: {
    minHeight: 95, alignItems: "center", justifyContent: "center", gap: 17,
  },
  orbitAccent: {
    position: "absolute", top: -26, height: 97, width: 270,
    alignItems: "center", justifyContent: "center",
  },
  orbitLine: {
    width: 265, height: 75, borderRadius: 150, borderWidth: 1,
    borderColor: "#E7B89D", transform: [{ rotate: "-19deg" }],
  },
  orbitPoint: {
    position: "absolute", top: 7, right: 15, width: 7, height: 7,
    borderRadius: 5, backgroundColor: "#D77442",
  },
  eyebrow: {
    ...typography.caption, fontSize: 10, letterSpacing: 2.4,
    fontWeight: "700", color: "#74756E", textAlign: "center",
  },
  spacer: { flexGrow: 1, minHeight: 90 },
  copy: { marginBottom: 27 },
  title: {
    ...typography.display, fontSize: 41, lineHeight: 47,
    letterSpacing: -1.9, color: colors.ink,
  },
  accent: { color: colors.clay },
  description: {
    ...typography.body, fontSize: 16, lineHeight: 25,
    color: "#777970", maxWidth: 410, marginTop: 22,
  },
  actions: { gap: 12 },
  googleButton: {
    minHeight: 56, backgroundColor: colors.clay,
    borderRadius: 32, flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    gap: 15, paddingHorizontal: 18,
    shadowColor: colors.clay, shadowRadius: 12,
    shadowOpacity: 0.13, shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  googleCircle: {
    width: 27, height: 27, borderRadius: 14,
    backgroundColor: colors.white, alignItems: "center",
    justifyContent: "center",
  },
  googleG: { fontSize: 20, fontWeight: "800", color: "#4285F4" },
  googleText: { ...typography.body, color: colors.white, fontWeight: "700" },
  emailButton: {
    minHeight: 56, borderRadius: 32, backgroundColor: "#FFFDFC",
    borderColor: "#CBBDB2",
  },
  error: { ...typography.bodySmall, color: colors.clayDeep, textAlign: "center" },
  login: { minHeight: 46, justifyContent: "center", alignItems: "center" },
  loginText: { ...typography.body, color: colors.textDim, textAlign: "center" },
  loginLink: { color: colors.clayDeep, fontWeight: "800" },
  business: {
    minHeight: 42, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
  },
  businessText: { ...typography.bodySmall, fontWeight: "600", color: colors.clayDeep },
});
