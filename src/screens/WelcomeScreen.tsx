import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { BrandLogo } from "../components/BrandLogo";
import { CategoryArt } from "../components/CategoryArt";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { MotionPressable } from "../components/Motion";
import { TermsAgreement } from "../components/TermsAgreement";
import { colors, typography, spacing } from "../theme";
import { useReducedMotion } from "../store/MotionContext";
import { RootStackParamList } from "../navigation/types";
import { useAuth } from "../store/AuthContext";
import { isSupabaseConfigured } from "../services/supabase";
import { AGREEMENT_REQUIRED } from "../services/terms";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

/**
 * Original Nearry welcome: activity-first editorial tiles, not a map,
 * dating profiles, invented listings, or the reference app's swipe UI.
 * Real Google signup uses the existing explicit 18+/terms agreement path.
 */
export function WelcomeScreen({ navigation }: Props) {
  const { enterDemoMode, signInGoogle, loading } = useAuth();
  const reduced = useReducedMotion();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const float = useRef(new Animated.Value(0)).current;
  useFocusEffect(useCallback(() => {
    if (reduced) { float.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(float, {
        toValue: 1, duration: 3300,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(float, {
        toValue: 0, duration: 3300,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]));
    animation.start();
    return () => {
      animation.stop();
      float.stopAnimation();
      float.setValue(0);
    };
  }, [float, reduced]));

  const continueGoogle = async () => {
    if (loading) return;
    setError("");
    if (!agreed) { setError(AGREEMENT_REQUIRED); return; }
    try {
      await signInGoogle("personal", true, agreed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Google sign in.");
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <BrandLogo width={152} />
          <Text style={styles.eyebrow}>YOUR WORLD, A LITTLE CLOSER</Text>
        </View>

        <View style={styles.hero} accessible={false}>
          <View style={styles.tileRow}>
            <Animated.View style={[
              styles.tile, styles.play,
              { transform: [{ translateY: float.interpolate({inputRange:[0,1],outputRange:[0,-6]}) }] },
            ]}>
              <View style={styles.tileHead}><Icon name="activity" color={colors.ink} size={15} /><Text style={styles.tileLabel}>PLAY</Text></View>
              <CategoryArt category="Play" size={114} />
              <Text style={styles.tileNote}>Find your team</Text>
            </Animated.View>
            <Animated.View style={[
              styles.tile, styles.meet,
              { transform: [{ translateY: float.interpolate({inputRange:[0,1],outputRange:[-5,0]}) }] },
            ]}>
              <View style={styles.tileHead}><Icon name="coffee" color={colors.ink} size={15} /><Text style={styles.tileLabel}>MEET</Text></View>
              <CategoryArt category="Meet" size={114} />
              <Text style={styles.tileNote}>Make a plan</Text>
            </Animated.View>
          </View>
          <View style={styles.lower}>
            <View style={styles.smallSymbol}><Icon name="compass" size={18} color={colors.clay} /></View>
            <Text style={styles.lowerCopy}>Places to explore. People to meet. Good things to do.</Text>
            <View style={styles.smallSymbol}><Icon name="arrow-up-right" size={18} color={colors.clay} /></View>
          </View>
        </View>

        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>
            Less scrolling.{"\n"}<Text style={styles.accent}>More living.</Text>
          </Text>
          <Text style={styles.description}>
            Find real plans, meet people through activities and discover nearby local experiences.
          </Text>
        </View>

        <View style={styles.actions}>
          {!isSupabaseConfigured && (
            <Text style={styles.previewNotice}>Account sign-in isn't configured in this build. Try the sample preview below.</Text>
          )}
          <Button
            title="Continue with Google"
            onPress={() => void continueGoogle()}
            loading={loading}
            disabled={!agreed || !isSupabaseConfigured}
            style={styles.primaryButton}
          />
          <Button
            title="Continue with Email"
            variant="secondary"
            onPress={() => navigation.navigate("PersonalAuth", { mode: "signup" })}
            style={styles.secondaryButton}
          />
          <TermsAgreement
            checked={agreed}
            disabled={loading}
            onChange={v => { setAgreed(v); setError(""); }}
            onTerms={() => navigation.navigate("Legal", { page: "terms" })}
            onPrivacy={() => navigation.navigate("Legal", { page: "privacy" })}
          />
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <MotionPressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("PersonalAuth", { mode: "login" })}
            style={styles.signin}
          >
            <Text style={styles.signinText}>Already have an account? <Text style={styles.signinLink}>Log in</Text></Text>
          </MotionPressable>
          <View style={styles.rule} />
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Join Nearry as a business"
            onPress={() => navigation.navigate("BusinessAuth", { mode: "signup" })}
            style={styles.business}
          >
            <Icon name="briefcase" color={colors.clay} size={17} />
            <Text style={styles.businessText}>Have a local business? Join Nearry</Text>
            <Icon name="arrow-up-right" color={colors.clay} size={17} />
          </MotionPressable>
        </View>
        <View style={styles.demo}>
          <Text style={styles.demoTitle}>TAKE A LOOK FIRST</Text>
          <View style={styles.demoRow}>
            <MotionPressable accessibilityRole="button" style={styles.demoButton} onPress={() => enterDemoMode("personal")}>
              <Icon name="compass" size={15} color={colors.textDim} />
              <Text style={styles.demoText}>Explore demo</Text>
            </MotionPressable>
            <MotionPressable accessibilityRole="button" style={styles.demoButton} onPress={() => enterDemoMode("business")}>
              <Icon name="briefcase" size={15} color={colors.textDim} />
              <Text style={styles.demoText}>Business demo</Text>
            </MotionPressable>
          </View>
          <Text style={styles.demoNote}>Sample content only · no account required</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg,
    paddingBottom: spacing.xl, alignItems: "stretch",
  },
  top: { alignItems: "flex-start", gap: 9 },
  eyebrow: {
    ...typography.caption, letterSpacing: 1.4, color: colors.muted,
    fontSize: 10, fontWeight: "700",
  },
  hero: { marginTop: spacing.lg },
  tileRow: { flexDirection: "row", gap: 12 },
  tile: {
    flex: 1, minWidth: 0, height: 186, borderRadius: 22, padding: 14,
    justifyContent: "space-between", alignItems: "center", overflow: "hidden",
  },
  play: { backgroundColor: "#E5ECDD" },
  meet: { backgroundColor: "#F2E8DE" },
  tileHead: {
    flexDirection: "row", gap: 6, alignItems: "center",
    alignSelf: "flex-start",
  },
  tileLabel: {
    ...typography.caption, color: colors.ink,
    fontSize: 10, fontWeight: "700", letterSpacing: 1.2,
  },
  tileNote: { ...typography.bodySmall, color: colors.ink, fontWeight: "700" },
  lower: {
    marginTop: 11, borderWidth: 1, borderColor: colors.border,
    borderRadius: 17, paddingVertical: 10, paddingHorizontal: 12,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  smallSymbol: {
    width: 29, height: 29, backgroundColor: colors.claySoft,
    borderRadius: 9, alignItems: "center", justifyContent: "center",
  },
  lowerCopy: { ...typography.caption, color: colors.textDim, flex: 1, textAlign: "center" },
  copy: { marginTop: 22, gap: 9 },
  title: {
    ...typography.display, fontSize: 38, lineHeight: 43,
    letterSpacing: -1.6, color: colors.ink,
  },
  accent: { color: colors.clay },
  description: {
    ...typography.body, color: colors.textDim,
    maxWidth: 345, lineHeight: 22,
  },
  actions: { marginTop: 22, gap: 11 },
  primaryButton: { borderRadius: 28, minHeight: 54, backgroundColor: colors.ink },
  secondaryButton: { borderRadius: 28, minHeight: 52, backgroundColor: colors.white },
  previewNotice: { ...typography.caption, color: colors.textDim },
  error: { ...typography.bodySmall, color: colors.red, textAlign: "center" },
  signin: {
    alignItems: "center", paddingVertical: 8, minHeight: 40, justifyContent: "center",
  },
  signinText: { ...typography.bodySmall, color: colors.textDim },
  signinLink: { color: colors.clayDeep, fontWeight: "700" },
  rule: { height: 1, backgroundColor: colors.border, marginTop: 2 },
  business: {
    minHeight: 50, flexDirection: "row", justifyContent: "center",
    gap: 10, alignItems: "center",
  },
  businessText: { ...typography.bodySmall, fontWeight: "700", color: colors.clayDeep },
  demo: { marginTop: 14, gap: 8, alignItems: "center" },
  demoTitle: {
    ...typography.caption, letterSpacing: 1.2,
    fontSize: 10, color: colors.textDim, fontWeight: "700",
  },
  demoRow: { flexDirection: "row", gap: 8, width: "100%" },
  demoButton: {
    flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 7, borderRadius: 15,
    borderWidth: 1, borderColor: colors.border,
  },
  demoText: { ...typography.caption, fontWeight: "700", color: colors.textDim },
  demoNote: { ...typography.caption, color: colors.textDim },
});
