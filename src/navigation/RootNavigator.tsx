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
import { PersonalTabs } from './PersonalTabs';
import { BusinessTabs } from './BusinessTabs';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Routes by auth state:
 * - no user            -> Welcome / auth / onboarding
 * - personal, onboarded -> PersonalApp tabs
 * - business, onboarded -> BusinessApp tabs
 * Onboarding completion is tracked per account type in the auth screens.
 */
export function RootNavigator() {
  const { user, bootstrapping, pendingOnboarding } = useAuth();

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
      {!user ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="PersonalAuth" component={PersonalAuthScreen} />
          <Stack.Screen name="BusinessAuth" component={BusinessAuthScreen} />
        </>
      ) : pendingOnboarding === 'personal' ? (
        <Stack.Screen name="PersonalOnboarding" component={PersonalOnboardingScreen} />
      ) : pendingOnboarding === 'business' ? (
        <Stack.Screen name="BusinessOnboarding" component={BusinessOnboardingScreen} />
      ) : user.accountType === 'personal' ? (
        <Stack.Screen name="PersonalApp" component={PersonalTabs} />
      ) : (
        <Stack.Screen name="BusinessApp" component={BusinessTabs} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
