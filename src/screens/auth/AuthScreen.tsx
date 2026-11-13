import {
  EmailCodeCooldowns,
  normalizeEmail,
  normalizeEmailCode,
} from "../../utils/emailSignIn";
import { AuthPresentation } from "./AuthPresentation";
import React, { useEffect, useState, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { AGREEMENT_REQUIRED } from "../../services/terms";
import { useAuth } from "../../store/AuthContext";
import { isSupabaseConfigured } from "../../services/supabase";
import { isValidEmail, isValidOtp } from "../../utils/validation";
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
    const run = version.current;
    actionLock.current = true;
    setPendingAction("send");
    try {
      await sendOtp(clean, accountType, undefined, !isLogin, agreed);
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

  return (
    <AuthPresentation
      kicker={kicker}
      isLogin={isLogin}
      step={step}
      email={email}
      code={code}
      sentTo={sentTo}
      error={error}
      errorFor={errorFor}
      busy={busy}
      pendingAction={pendingAction}
      agreed={agreed}
      resendSeconds={resendSeconds}
      configured={isSupabaseConfigured}
      setEmail={(value) => {
        setEmail(value);
        setError(null);
        setResendAt(cooldowns.current.expiresAt(value));
      }}
      setCode={(value) => {
        setCode(value);
        setError(null);
      }}
      setAgreed={(value) => {
        setAgreed(value);
        setError(null);
      }}
      sendCode={sendCode}
      confirmCode={confirmCode}
      google={google}
      changeEmail={() => {
        setStep("email");
        setCode("");
        setError(null);
        setResendAt(cooldowns.current.expiresAt(email));
      }}
      onBack={onBack}
      onSwitchMode={onSwitchMode}
      onTerms={() => navigation.navigate("Legal", { page: "terms" })}
      onPrivacy={() => navigation.navigate("Legal", { page: "privacy" })}
    />
  );
}
