import React from "react";
import {
  emailOtpEnabled,
  reviewerLoginEnabled,
} from "../../utils/authAvailability";
import { StyleSheet, Text, View } from "react-native";
import {
  OnboardingLayout,
  OnboardingHeading,
  OnboardingButton,
  OnboardingInput,
  OnboardingLink,
  ob,
  onboardingColors as c,
} from "../../components/onboarding/OnboardingKit";
import { MotionPressable } from "../../components/Motion";
import { BrandMark } from "../../components/BrandLogo";
import { normalizeEmailCode } from "../../utils/emailSignIn";
import { isValidEmail, isValidOtp } from "../../utils/validation";
import { weight } from "../../theme";
type Props = {
  reviewerMode: boolean;
  password: string;
  setPassword: (value: string) => void;
  reviewer: () => Promise<void>;
  toggleReviewer: () => void;
  kicker: string;
  isLogin: boolean;
  step: "email" | "code";
  email: string;
  code: string;
  sentTo: string | null;
  error: string | null;
  errorFor: "email" | "google" | "reviewer";
  busy: boolean;
  pendingAction: "send" | "verify" | "google" | "reviewer" | null;
  resendSeconds: number;
  configured: boolean;
  setEmail: (value: string) => void;
  setCode: (value: string) => void;
  sendCode: () => Promise<void>;
  confirmCode: () => Promise<void>;
  google: () => Promise<void>;
  changeEmail: () => void;
  onBack: () => void;
  onSwitchMode: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
};
export function AuthPresentation(p: Props) {
  const code = emailOtpEnabled && p.step === "code";
  const googleOnly = !emailOtpEnabled && !p.reviewerMode;
  return (
    <OnboardingLayout
      onBack={p.onBack}
      busy={p.busy}
      screenKey={p.step + p.kicker + p.isLogin}
      footer={
        <>
          <OnboardingButton
            title={
              p.reviewerMode
                ? "Sign in for review"
                : googleOnly
                  ? "Continue with Google"
                  : code
                    ? "Verify & continue"
                    : p.resendSeconds > 0
                      ? `Send code in ${p.resendSeconds}s`
                      : "Send email code"
            }
            onPress={() =>
              void (p.reviewerMode
                ? p.reviewer()
                : googleOnly
                  ? p.google()
                  : code
                    ? p.confirmCode()
                    : p.sendCode())
            }
            loading={
              p.pendingAction ===
              (p.reviewerMode
                ? "reviewer"
                : googleOnly
                  ? "google"
                  : code
                    ? "verify"
                    : "send")
            }
            disabled={
              p.busy ||
              !p.configured ||
              (p.reviewerMode
                ? !isValidEmail(p.email) || !p.password
                : googleOnly
                  ? false
                  : code
                    ? !isValidOtp(p.code)
                    : !isValidEmail(p.email) || p.resendSeconds > 0)
            }
          />
          <OnboardingLink
            title={
              p.isLogin
                ? "New here? Create an account"
                : "Already have an account? Log in"
            }
            disabled={p.busy}
            onPress={p.onSwitchMode}
          />
        </>
      }
    >
      <View style={styles.hello} accessible={false}>
        <BrandMark size={40} color={c.amber} dotColor={c.white} />
      </View>
      <OnboardingHeading
        kicker={`${p.kicker} account`}
        title={
          p.reviewerMode
            ? "Review Nearry."
            : code
              ? "Check your inbox."
              : p.isLogin
                ? "Good to see you again."
                : "Let’s make it official."
        }
        subtitle={
          p.reviewerMode
            ? "Use the credentials provided in Play Console. This opens the real app with the account’s saved role."
            : googleOnly
              ? "Join this test with Google. Email sign-in is not available in this build yet."
              : code
                ? `Code requested for ${p.sentTo}. Check your inbox and spam folder.`
                : "Your next hello starts here. Continue with Google or email."
        }
      />
      {!p.configured && (
        <View style={ob.card}>
          <Text style={ob.help}>
            Sign-in is not configured in this build. Go back and use Preview to
            explore with sample data.
          </Text>
        </View>
      )}
      {!code && !p.reviewerMode && !googleOnly && (
        <>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{
              disabled: p.busy || !p.configured,
              busy: p.pendingAction === "google",
            }}
            disabled={p.busy || !p.configured}
            onPress={() => void p.google()}
            style={[
              styles.google,
              (p.busy || !p.configured) && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.g}>G</Text>
            <Text style={styles.googleText}>
              {p.pendingAction === "google"
                ? "Opening Google…"
                : "Continue with Google"}
            </Text>
          </MotionPressable>
          {p.error && p.errorFor === "google" && (
            <Text accessibilityRole="alert" style={ob.error}>
              {p.error}
            </Text>
          )}
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={ob.help}>or use your email</Text>
            <View style={styles.line} />
          </View>
        </>
      )}
      {p.reviewerMode ? (
        <>
          <OnboardingInput
            label="Review account email"
            value={p.email}
            onChangeText={p.setEmail}
            editable={!p.busy}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
          />
          <OnboardingInput
            label="Review account password"
            value={p.password}
            onChangeText={p.setPassword}
            editable={!p.busy}
            secureTextEntry
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={() => void p.reviewer()}
          />
          {p.error && p.errorFor === "reviewer" && (
            <Text accessibilityRole="alert" style={ob.error}>
              {p.error}
            </Text>
          )}
        </>
      ) : googleOnly ? null : code ? (
        <>
          <OnboardingInput
            label="Email code"
            placeholder="Enter your code"
            value={p.code}
            onChangeText={(v) => p.setCode(normalizeEmailCode(v))}
            editable={!p.busy}
            maxLength={16}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            onSubmitEditing={() => void p.confirmCode()}
            returnKeyType="send"
          />
          <OnboardingLink
            title={
              p.resendSeconds > 0
                ? `Resend code in ${p.resendSeconds}s`
                : "Resend code"
            }
            disabled={p.busy || p.resendSeconds > 0}
            onPress={() => void p.sendCode()}
          />
          <OnboardingLink
            title="Use a different email"
            disabled={p.busy}
            onPress={p.changeEmail}
          />
        </>
      ) : (
        <>
          <OnboardingInput
            label="Email address"
            placeholder="you@example.com"
            value={p.email}
            onChangeText={p.setEmail}
            editable={!p.busy}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            clearable
            returnKeyType="send"
            onSubmitEditing={() => void p.sendCode()}
          />
          <Text style={ob.help}>
            We’ll send a code. No password to remember.
          </Text>
        </>
      )}
      {p.error && p.errorFor === "email" && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={ob.error}
        >
          {p.error}
        </Text>
      )}
      {reviewerLoginEnabled && (
        <OnboardingLink
          title={
            p.reviewerMode ? "Back to Google sign-in" : "App review access"
          }
          disabled={p.busy}
          onPress={p.toggleReviewer}
        />
      )}
      <View style={styles.legal}>
        <OnboardingLink title="Privacy Policy" onPress={p.onPrivacy} />
        <OnboardingLink title="Terms & Guidelines" onPress={p.onTerms} />
      </View>
    </OnboardingLayout>
  );
}
const styles = StyleSheet.create({
  hello: {
    width: 74,
    height: 74,
    borderRadius: 23,
    backgroundColor: c.night,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 27,
    transform: [{ rotate: "-7deg" }],
  },
  google: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 15,
    padding: 12,
    backgroundColor: c.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
  },
  g: { fontSize: 23, color: "#4285F4", ...weight("700") },
  googleText: { fontSize: 14, ...weight("600"), color: c.ink },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 20,
  },
  line: { height: 1, flex: 1, backgroundColor: c.line },
  legal: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 20,
  },
});
