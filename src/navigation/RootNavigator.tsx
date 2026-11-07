import { Alert } from "../services/appAlert";
import {
  LegalScreen,
  RestrictedAccountScreen,
} from "../screens/settings/SafetyScreens";
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Text } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button } from "../components/Button";
import { AccountTypeScreen } from "../screens/auth/AccountTypeScreen";
import { colors } from "../theme";
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
  } = useAuth();

  usePushSetup();
  const shownRoleMismatch = useRef<typeof roleMismatch>(null);

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
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
