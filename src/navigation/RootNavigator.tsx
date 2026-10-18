import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text, Alert } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button } from "../components/Button";
import { AccountTypeScreen } from "../screens/auth/AccountTypeScreen";
import { colors } from "../theme";
import { RootStackParamList } from "./types";
import { useAuth } from "../store/AuthContext";
import { usePushSetup } from "../hooks/useUnreadCounts";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { PersonalAuthScreen } from "../screens/auth/PersonalAuthScreen";
import { BusinessAuthScreen } from "../screens/auth/BusinessAuthScreen";
import { PersonalOnboardingScreen } from "../screens/onboarding/PersonalOnboardingScreen";
import { BusinessOnboardingScreen } from "../screens/onboarding/BusinessOnboardingScreen";
import { PersonalStack } from "./PersonalStack";
import { BusinessStack } from "./BusinessStack";

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Routes by auth state:
 * - bootstrapping              -> spinner
 * - demo mode                  -> demo lane tabs (explicitly separate)
 * - no session                 -> Welcome / auth
 * - session, onboarding needed -> resume onboarding (lane from saved profile)
 * - session, onboarded         -> lane from SAVED profile account type,
 *                                 regardless of which auth screen was used
 */
export function RootNavigator() {
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

  // The login lane is only a hint: one email = one account = one fixed type.
  // If the user picked the other lane, say so instead of landing silently.
  useEffect(() => {
    if (!roleMismatch) return;
    const label = roleMismatch === "business" ? "Business" : "Personal";
    Alert.alert(
      `Signed in to your ${label} account`,
      `This email is registered as a ${label} account, so we opened the ${label} app.`,
      [{ text: "OK", onPress: () => clearRoleMismatch() }],
    );
  }, [roleMismatch, clearRoleMismatch]);

  if (bootstrapping || (!demoMode && profileLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.red} size="large" />
      </View>
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
  if (!demoMode && session && profile && !profile.roleSelected)
    return <AccountTypeScreen />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "fade",
      }}
    >
      {demoMode || (session && accountType) ? (
        needsOnboarding && pendingOnboarding === "personal" ? (
          <Stack.Screen
            name="PersonalOnboarding"
            component={PersonalOnboardingScreen}
          />
        ) : needsOnboarding && pendingOnboarding === "business" ? (
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
