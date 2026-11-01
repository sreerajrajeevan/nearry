import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { TermsAgreement } from "../../components/TermsAgreement";
import { AGREEMENT_REQUIRED } from "../../services/terms";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { BrandLogo } from "../../components/BrandLogo";
import { NearryAtmosphere } from "../../components/NearryAtmosphere";
import { Icon } from "../../components/Icon";
import { Badge } from "../../components/Badge";
import { colors, typography, spacing } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { isSupabaseConfigured } from "../../services/supabase";
import {
  isValidDisplayName,
  isValidEmail,
  isValidOtp,
} from "../../utils/validation";
import { AccountType } from "../../navigation/types";

type Props = {
  accountType: AccountType;
  kicker: string;
  mode: "login" | "signup";
  onSwitchMode: () => void;
  onBack: () => void;
};

/**
 * Passwordless auth: email OTP + Google via Supabase.
 * No passwords, no phone numbers. The saved profile's account type —
 * not this screen's lane — decides where the user lands after login.
 */
export function AuthScreen({
  accountType,
  kicker,
  mode,
  onSwitchMode,
  onBack,
}: Props) {
  const isLogin = mode === "login";
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [agreed, setAgreed] = useState(false);
  const { sendOtp, verifyOtp, signInGoogle, loading } = useAuth();

  const [step, setStep] = useState<"email" | "code">("email");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  useEffect(() => {
    const update = () =>
      setResendSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    if (!resendAt) return;
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  useEffect(() => {
    setAgreed(false);
    setStep("email");
    setCode("");
    setSentTo(null);
    setError(null);
  }, [mode, accountType]);

  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : "Something went wrong.");

  const sendCode = async () => {
    if (loading) return;
    setError(null);
    if (Date.now() < resendAt)
      return setError("Please wait before requesting another code.");
    if (!isLogin && !agreed) return setError(AGREEMENT_REQUIRED);
    const clean = email.trim();
    if (!isValidEmail(clean)) return setError("Enter a valid email address.");
    if (!isLogin && !isValidDisplayName(displayName))
      return setError("Display name must be 2–40 characters.");
    try {
      await sendOtp(
        clean,
        accountType,
        isLogin ? undefined : displayName.trim(),
        !isLogin,
        agreed,
      );
      setSentTo(clean);
      setResendAt(Date.now() + 60_000);
      setCode("");
      setStep("code");
    } catch (e) {
      fail(e);
    }
  };

  const confirmCode = async () => {
    if (loading) return;
    setError(null);
    if (!isLogin && !agreed) return setError(AGREEMENT_REQUIRED);
    if (!isValidOtp(code))
      return setError("Enter the full code from your email (6–10 digits).");
    try {
      await verifyOtp(sentTo ?? email.trim(), code.trim());
      // RootNavigator routes on session+profile automatically.
    } catch (e) {
      fail(e);
    }
  };

  const google = async () => {
    if (loading) return;
    setError(null);
    try {
      if (!isLogin && !agreed) return setError(AGREEMENT_REQUIRED);
      await signInGoogle(accountType, !isLogin, agreed);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Screen padded scroll keyboard>
      <View style={styles.authAtmosphere} pointerEvents="none"><NearryAtmosphere /></View>
      <View style={styles.brandRow}>
        <BrandLogo width={152} />
        <View style={styles.laneChip}>
          <Text style={styles.laneText}>{kicker.toUpperCase()} ACCOUNT</Text>
        </View>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Back to welcome"
        onPress={onBack}
        disabled={loading}
        style={styles.back}
      >
        <Icon name="arrow-left" size={16} />
        <Text style={styles.linkText}>Back</Text>
      </TouchableOpacity>
      <View style={styles.header}>
        <View style={styles.intro}>
          <View style={styles.orbitLine} pointerEvents="none" />
          <Text style={styles.kicker}>YOUR WORLD, A LITTLE CLOSER</Text>
        </View>
        <Text style={styles.title}>
          {step === "email"
            ? isLogin
              ? "Welcome back"
              : "Create account"
            : "Check your inbox"}
        </Text>
        {step === "email" && (
          <Text style={styles.sub}>
            {isLogin
              ? "Sign in securely with your email or Google account."
              : "Just a few details, then you're ready to explore Nearry."}
          </Text>
        )}
        {step === "code" && sentTo && (
          <Text style={styles.sub}>
            Code requested for {sentTo}. Check your inbox and spam folder.
          </Text>
        )}
      </View>

      {!isSupabaseConfigured && (
        <View style={styles.warn}>
          <Badge label="Preview build" />
          <Text style={styles.warnText}>
            Sign-in is unavailable in this build. Check the Supabase
            configuration before testing authentication.
          </Text>
        </View>
      )}

      {step === "email" ? (
        <>
          {!isLogin && (
            <Input
              label="Display name"
              placeholder="What should we call you?"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          )}
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="send"
            onSubmitEditing={sendCode}
          />
          <View style={styles.gap} />
          {!isLogin && (
            <TermsAgreement
              checked={agreed}
              onChange={(checked) => {
                setAgreed(checked);
                setError(null);
              }}
              disabled={loading}
              onTerms={() => navigation.navigate("Legal", { page: "terms" })}
              onPrivacy={() =>
                navigation.navigate("Legal", { page: "privacy" })
              }
            />
          )}
          <Button
            title="Send code"
            style={styles.submitButton}
            onPress={sendCode}
            loading={loading}
            disabled={!isLogin && !agreed}
          />
        </>
      ) : (
        <>
          <Input
            label="Email code"
            placeholder="Enter your code"
            value={code}
            onChangeText={(t: string) =>
              setCode(t.replace(/[^0-9]/g, "").slice(0, 10))
            }
            keyboardType="number-pad"
            returnKeyType="send"
            onSubmitEditing={confirmCode}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
          />
          <View style={styles.gap} />
          <Button title="Verify" style={styles.submitButton} onPress={confirmCode} loading={loading} />
          <TouchableOpacity
            onPress={sendCode}
            disabled={loading || resendSeconds > 0}
            accessibilityRole="button"
            activeOpacity={0.7}
            style={styles.link}
          >
            <Text style={styles.linkText}>
              {resendSeconds > 0
                ? `Resend code in ${resendSeconds}s`
                : "Resend code"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={loading}
            onPress={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            activeOpacity={0.7}
            style={styles.link}
          >
            <Text style={styles.linkText}>Use a different email</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>OR</Text>
        <View style={styles.line} />
      </View>
      <Button
        title="Continue with Google"
        style={styles.googleButton}
        variant="secondary"
        onPress={google}
        loading={loading}
        disabled={!isLogin && !agreed}
      />

      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}

      <TouchableOpacity
        onPress={onSwitchMode}
        disabled={loading}
        activeOpacity={0.7}
        style={styles.switch}
        accessibilityRole="button"
      >
        <Text style={styles.switchText}>
          {isLogin
            ? "New here? Create an account"
            : "Already have an account? Log in"}
        </Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  authAtmosphere: {
    ...StyleSheet.absoluteFillObject, overflow: "hidden",
  },
  intro: { marginTop: 30, marginBottom: 8, minHeight: 50, justifyContent: "flex-end" },
  orbitLine: {
    position: "absolute", top: -5, left: 8, width: 195, height: 55,
    borderWidth: 1, borderColor: "#EBCBB8", borderRadius: 110,
    transform: [{ rotate: "-14deg" }],
  },
  brandRow: {
    paddingTop: spacing.md, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", flexWrap: "wrap", gap: 10,
  },
  laneChip: {
    backgroundColor: colors.claySoft, borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 7,
  },
  laneText: {
    ...typography.caption, color: colors.clayDeep,
    fontSize: 10, letterSpacing: 0.8, fontWeight: "700",
  },
  submitButton: { borderRadius: 28, backgroundColor: colors.ink, minHeight: 54 },
  googleButton: { borderRadius: 28, backgroundColor: colors.white, minHeight: 52 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    alignSelf: "flex-start",
  },
  header: { marginTop: spacing.sm, marginBottom: spacing.xl },
  kicker: { ...typography.caption, color: colors.clay, letterSpacing: 1.1, fontWeight: "700" },
  title: { ...typography.display, color: colors.text, marginTop: spacing.sm, fontSize: 37, lineHeight: 43 },
  sub: { ...typography.body, color: colors.textDim, marginTop: spacing.sm },
  warn: { marginBottom: spacing.lg, gap: spacing.sm },
  warnText: { ...typography.caption, color: colors.textDim },
  gap: { height: spacing.md },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.lg,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: {
    ...typography.caption,
    color: colors.textFaint,
    marginHorizontal: spacing.md,
  },
  link: { marginTop: spacing.md, alignItems: "center" },
  linkText: { ...typography.label, color: colors.textDim },
  error: {
    ...typography.body,
    color: colors.red,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  switch: { marginTop: spacing.xl, alignItems: "center" },
  switchText: { ...typography.label, color: colors.text },
});
