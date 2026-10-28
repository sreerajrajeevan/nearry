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
 * Passwordless auth: email OTP (6-digit code) + Google via Supabase.
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
    if (!isValidOtp(code)) return setError("Enter the 6-digit code.");
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
      <BrandHeader context={kicker} />
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
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>
          {step === "email"
            ? isLogin
              ? "Welcome back"
              : "Create account"
            : "Check your inbox"}
        </Text>
        {step === "code" && sentTo && (
          <Text style={styles.sub}>We sent a 6-digit code to {sentTo}.</Text>
        )}
      </View>

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
            onPress={sendCode}
            loading={loading}
            disabled={!isLogin && !agreed}
          />
        </>
      ) : (
        <>
          <Input
            label="6-digit code"
            placeholder="123456"
            value={code}
            onChangeText={(t: string) =>
              setCode(t.replace(/[^0-9]/g, "").slice(0, 6))
            }
            keyboardType="number-pad"
            returnKeyType="send"
            onSubmitEditing={confirmCode}
            autoFocus
          />
          <View style={styles.gap} />
          <Button title="Verify" onPress={confirmCode} loading={loading} />
          <TouchableOpacity
            onPress={sendCode}
            disabled={loading}
            activeOpacity={0.7}
            style={styles.link}
          >
            <Text style={styles.linkText}>Resend code</Text>
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
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    alignSelf: "flex-start",
  },
  header: { marginTop: spacing.sm, marginBottom: spacing.lg },
  kicker: { ...typography.label, color: colors.red, letterSpacing: 0 },
  title: { ...typography.display, color: colors.text, marginTop: spacing.sm },
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
