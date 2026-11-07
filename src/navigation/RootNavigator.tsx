import { Alert } from "../services/appAlert";
import {
  LegalScreen,
  RestrictedAccountScreen,
} from "../screens/settings/SafetyScreens";
import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { AccountTypeScreen } from "../screens/auth/AccountTypeScreen";
import { colors, typography } from "../theme";
import { useReducedMotion } from "../store/MotionContext";
import { RootStackParamList } from "./types";
import { useAuth } from "../store/AuthContext";
import { usePushSetup } from "../hooks/useUnreadCounts";
import { LoadingState } from "../components/LoadingState";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { PersonalAuthScreen } from "../screens/auth/PersonalAuthScreen";
import { BusinessAuthScreen } from "../screens/auth/BusinessAuthScreen";
import { BusinessOnboardingScreen } from "../screens/onboarding/BusinessOnboardingScreen";
import { PersonalStack } from "./PersonalStack";
import { BusinessStack } from "./BusinessStack";

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Routes by auth state:
 * - bootstrapping              -> branded loading state
 * - demo mode                  -> demo lane tabs (explicitly separate)
 * - no session                 -> Welcome / auth
 * - Personal accounts may browse before completing their profile.
 * - Business onboarding remains mandatory before its management experience.
 * - session, onboarded         -> lane from SAVED profile account type,
 *                                 regardless of which auth screen was used
 */
export function RootNavigator() {
  const reduced = useReducedMotion();
  const {
    session,
    demoMode,
    bootstrapping,
    accountType,
    needsOnboarding,
    pendingOnboarding,
    profile,
    profileLoading,
    profileError,
    refreshProfile,
    signOut,
    roleMismatch,
    clearRoleMismatch,
    exitDemoMode,
  } = useAuth();
  const insets = useSafeAreaInsets();

  usePushSetup();
  const shownRoleMismatch = useRef<typeof roleMismatch>(null);

  // Demo mode has no way back in the stack, so the hardware back button
  // would close the app. Exit the demo instead — but only when the demo
  // root is showing: the navigation container's own back handler runs
  // first and pops inner screens, so this only fires when nothing is left
  // to pop.
  const exitDemoRef = useRef(exitDemoMode);
  exitDemoRef.current = exitDemoMode;
  useEffect(() => {
    if (!demoMode) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      exitDemoRef.current();
      return true;
    });
    return () => sub.remove();
  }, [demoMode]);

  // The login lane is only a hint: one email = one account = one fixed type.
  // If the user picked the other lane, say so instead of landing silently.
  useEffect(() => {
    if (!roleMismatch) {
      shownRoleMismatch.current = null;
      return;
    }
    if (shownRoleMismatch.current === roleMismatch) return;
    shownRoleMismatch.current = roleMismatch;
    const label = roleMismatch === "business" ? "Business" : "Personal";
    Alert.alert(
      `Your ${label} account`,
      `This email belongs to a ${label} account. We’ve opened your ${label} space.`,
      [{ text: "Continue", onPress: () => clearRoleMismatch() }],
    );
  }, [roleMismatch, clearRoleMismatch]);

  if (bootstrapping || (!demoMode && profileLoading)) {
    return (
      <LoadingState fullScreen layout="compact" label="Opening your account…" />
    );
  }

  if (!demoMode && !profile && (profileError || session)) {
    return (
      <View style={[styles.loading, { padding: 24 }]}>
        <Text style={{ color: colors.text, marginBottom: 20 }}>
          {profileError || "Loading your profile…"}
        </Text>
        <Button
          title="RETRY"
          onPress={() => void refreshProfile().catch(() => {})}
        />
        <Button
          title="SIGN OUT"
          variant="ghost"
          onPress={() => void signOut().catch(() => {})}
        />
      </View>
    );
  }
  if (
    !demoMode &&
    profile &&
    (profile.suspendedAt || profile.deletionRequestedAt)
  )
    return <RestrictedAccountScreen />;
  if (!demoMode && session && profile && !profile.roleSelected)
    return <AccountTypeScreen />;

  return (
    <View style={styles.root}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: reduced ? "none" : "fade",
        }}
      >
        {demoMode || (session && accountType) ? (
          needsOnboarding && pendingOnboarding === "business" ? (
            <Stack.Screen
              name="BusinessOnboarding"
              component={BusinessOnboardingScreen}
            />
          ) : accountType === "business" ? (
            <Stack.Screen name="BusinessApp" component={BusinessStack} />
          ) : (
            <Stack.Screen name="PersonalApp" component={PersonalStack} />
          )
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="PersonalAuth" component={PersonalAuthScreen} />
            <Stack.Screen name="BusinessAuth" component={BusinessAuthScreen} />
          </>
        )}
        <Stack.Screen name="Legal" component={LegalScreen} />
      </Stack.Navigator>
      {demoMode && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Leave demo"
          onPress={() => exitDemoMode()}
          activeOpacity={0.85}
          style={[
            styles.leaveDemo,
            { bottom: insets.bottom + 84 },
          ]}
        >
          <Icon name="x" size={14} color={colors.onAccent} />
          <Text style={styles.leaveDemoText}>Leave demo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveDemo: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.forest,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  leaveDemoText: { ...typography.label, color: colors.onAccent },
});
