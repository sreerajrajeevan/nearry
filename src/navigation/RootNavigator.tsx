import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { RootStackParamList } from './types';
import { useAuth } from '../store/AuthContext';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { PersonalAuthScreen } from '../screens/auth/PersonalAuthScreen';
import { BusinessAuthScreen } from '../screens/auth/BusinessAuthScreen';
import { PersonalOnboardingScreen } from '../screens/onboarding/PersonalOnboardingScreen';
import { BusinessOnboardingScreen } from '../screens/onboarding/BusinessOnboardingScreen';
import { PersonalStack } from './PersonalStack';
import { BusinessTabs } from './BusinessTabs';

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
  const { session, demoMode, bootstrapping, accountType, needsOnboarding, pendingOnboarding } =
    useAuth();

  if (bootstrapping) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.red} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade',
      }}
    >
      {demoMode || (session && accountType) ? (
        needsOnboarding && pendingOnboarding === 'personal' ? (
          <Stack.Screen name="PersonalOnboarding" component={PersonalOnboardingScreen} />
        ) : needsOnboarding && pendingOnboarding === 'business' ? (
          <Stack.Screen name="BusinessOnboarding" component={BusinessOnboardingScreen} />
        ) : accountType === 'business' ? (
          <Stack.Screen name="BusinessApp" component={BusinessTabs} />
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
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
