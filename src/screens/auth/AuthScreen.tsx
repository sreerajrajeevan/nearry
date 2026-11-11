import {
  EmailCodeCooldowns,
  normalizeEmail,
  normalizeEmailCode,
} from "../../utils/emailSignIn";
import { PageHeading } from "../../components/PageHeading";
import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { TermsAgreement } from "../../components/TermsAgreement";
import { AGREEMENT_REQUIRED } from "../../services/terms";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { BrandHeader } from "../../components/BrandHeader";
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
  const [pendingAction, setPendingAction] = useState<
    "send" | "verify" | "google" | null
  >(null);
  const [errorFor, setErrorFor] = useState<"email" | "google">("email");
  const actionLock = useRef(false);
  const version = useRef(0);
  const cooldowns = useRef(new EmailCodeCooldowns());
  const busy = loading || pendingAction !== null;
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
    version.current++;
    setAgreed(false);
    setStep("email");
    setCode("");
    setSentTo(null);
    setError(null);
    return () => {
      version.current++;
    };
  }, [mode, accountType]);

  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : "Something went wrong.");

  const sendCode = async () => {
    if (busy || actionLock.current) return;
    setErrorFor("email");
    setError(null);
    if (Date.now() < cooldowns.current.expiresAt(email))
      return setError("Please wait before requesting another code.");
    if (!isLogin && !agreed) return setError(AGREEMENT_REQUIRED);
    const clean = normalizeEmail(email);
    if (!isValidEmail(clean)) return setError("Enter a valid email address.");
    if (!isLogin && !isValidDisplayName(displayName))
      return setError("Display name must be 2–40 characters.");
    const run = version.current;
    actionLock.current = true;
    setPendingAction("send");
    try {
      await sendOtp(
        clean,
        accountType,
        isLogin ? undefined : displayName.trim(),
        !isLogin,
        agreed,
      );
      cooldowns.current.record(clean);
      if (run !== version.current) return;
      setSentTo(clean);
      setResendAt(cooldowns.current.expiresAt(clean));
      setCode("");
      setStep("code");
    } catch (e) {
      if (run === version.current) fail(e);
    } finally {
      actionLock.current = false;
      if (run === version.current) setPendingAction(null);
    }
  };

  const confirmCode = async () => {
    if (busy || actionLock.current) return;
    setErrorFor("email");
    setError(null);
    if (!isLogin && !agreed) return setError(AGREEMENT_REQUIRED);
    if (!isValidOtp(code))
      return setError("Enter the full code from your email (6–10 digits).");
    const run = version.current;
    actionLock.current = true;
    setPendingAction("verify");
    try {
      await verifyOtp(
        sentTo ?? normalizeEmail(email),
        normalizeEmailCode(code),
      );
      // RootNavigator routes on session+profile automatically.
    } catch (e) {
      if (run === version.current) fail(e);
    } finally {
      actionLock.current = false;
      if (run === version.current) setPendingAction(null);
    }
  };

  const google = async () => {
    if (busy || actionLock.current) return;
    setErrorFor("google");
    setError(null);
    if (!isLogin && !agreed) return setError(AGREEMENT_REQUIRED);
    const run = version.current;
    actionLock.current = true;
    setPendingAction("google");
    try {
      await signInGoogle(accountType, !isLogin, agreed);
    } catch (e) {
      if (run === version.current) fail(e);
    } finally {
      actionLock.current = false;
      if (run === version.current) setPendingAction(null);
    }
  };

  const emailError =
    error && errorFor === "email" ? (
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={styles.error}
      >
        {error}
      </Text>
    ) : null;
  return (
    <Screen padded scroll keyboard>
      <BrandHeader context={kicker} />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Back to welcome"
        onPress={onBack}
        disabled={busy}
        style={styles.back}
      >
        <Icon name="arrow-left" size={16} />
        <Text style={styles.linkText}>Back</Text>
      </TouchableOpacity>
      <PageHeading
        compact
        greeting={kicker}
        title={
          step === "email"
            ? isLogin
              ? "Welcome back"
              : "Create account"
            : "Check your inbox"
        }
        subtitle={
          step === "code" && sentTo
            ? `Code requested for ${sentTo}. Check your inbox and spam folder.`
            : undefined
        }
      />

      {!isSupabaseConfigured && (
        <View style={styles.warn}>
          <Badge label="Preview build" />
          <Text style={styles.warnText}>
            Sign-in is not available in this build yet. Go back to explore the
            personal or business demo.
          </Text>
        </View>
      )}

      {step === "email" ? (
        <>
          {!isLogin && (
            <Input
              label="Display name"
              placeholder="What should we call you?"
              editable={!busy}
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
            editable={!busy}
            autoCorrect={false}
            autoComplete="email"
            onChangeText={(value) => {
              setEmail(value);
              setError(null);
              setResendAt(cooldowns.current.expiresAt(value));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="send"
            onSubmitEditing={sendCode}
          />
          {emailError}
          <View style={styles.gap} />
          {!isLogin && (
            <TermsAgreement
              checked={agreed}
              onChange={(checked) => {
                setAgreed(checked);
                setError(null);
              }}
              disabled={busy}
              onTerms={() => navigation.navigate("Legal", { page: "terms" })}
              onPrivacy={() =>
                navigation.navigate("Legal", { page: "privacy" })
              }
            />
          )}
          <Button
            title={
              resendSeconds > 0 ? `Send code in ${resendSeconds}s` : "Send code"
            }
            onPress={sendCode}
            loading={pendingAction === "send"}
            disabled={busy || resendSeconds > 0 || (!isLogin && !agreed)}
          />
        </>
      ) : (
        <>
          <Input
            label="Email code"
            placeholder="Enter your code"
            value={code}
            editable={!busy}
            onChangeText={(value: string) => {
              setCode(normalizeEmailCode(value));
              setError(null);
            }}
            keyboardType="number-pad"
            returnKeyType="send"
            onSubmitEditing={confirmCode}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
          />
          <View style={styles.gap} />
          {emailError}
          <Button
            title="Verify code"
            onPress={confirmCode}
            loading={pendingAction === "verify"}
            disabled={busy}
          />
          <TouchableOpacity
            onPress={sendCode}
            disabled={busy || resendSeconds > 0}
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
            disabled={busy}
            onPress={() => {
              setStep("email");
              setCode("");
              setError(null);
              setResendAt(cooldowns.current.expiresAt(email));
            }}
            activeOpacity={0.7}
            style={styles.link}
          >
            <Text style={styles.linkText}>Use a different email</Text>
          </TouchableOpacity>
          {isLogin && (
            <Button
              title="New here? Create an account"
              variant="ghost"
              disabled={busy}
              onPress={onSwitchMode}
            />
          )}
        </>
      )}

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>OR</Text>
        <View style={styles.line} />
      </View>
      <Button
        title="Continue with Google"
        variant="secondary"
        onPress={google}
        loading={pendingAction === "google"}
        disabled={busy || (!isLogin && !agreed)}
      />

      {error && errorFor === "google" && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}

      {!(isLogin && step === "code") && (
        <TouchableOpacity
          onPress={onSwitchMode}
          disabled={busy}
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
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    alignSelf: "flex-start",
  },
  header: { marginTop: spacing.sm, marginBottom: spacing.lg, backgroundColor: colors.deepTeal, padding: 24, borderRadius: 28 },
  kicker: { ...typography.label, color: colors.onTeal, letterSpacing: 0 },
  title: { ...typography.display, color: colors.white, marginTop: spacing.sm },
  sub: { ...typography.body, color: colors.onTeal, marginTop: spacing.sm },
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
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  switch: { marginTop: spacing.xl, alignItems: "center" },
  switchText: { ...typography.label, color: colors.text },
});
