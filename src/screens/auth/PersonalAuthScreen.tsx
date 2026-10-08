import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { isSupabaseConfigured } from '../../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalAuth'>;

/**
 * Personal account auth — email/password + Google OAuth.
 * On success RootNavigator auto-routes (no manual navigation here).
 */
export function PersonalAuthScreen({ navigation, route }: Props) {
  const mode = route.params?.mode ?? 'login';
  const isLogin = mode === 'login';
  const { signIn, signUp, signInGoogle, loading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      if (isLogin) {
        await signIn(email.trim(), password, 'personal');
      } else {
        await signUp(email.trim(), password, displayName.trim(), 'personal');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const google = async () => {
    setError(null);
    try {
      await signInGoogle('personal');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const switchMode = () => {
    setError(null);
    navigation.setParams({ mode: isLogin ? 'signup' : 'login' });
  };

  return (
    <Screen padded>
      <View style={styles.header}>
        {!isSupabaseConfigured && (
          <View style={styles.mockBadge}>
            <Badge label="MOCK MODE" />
          </View>
        )}
        <Text style={styles.kicker}>PERSONAL</Text>
        <Text style={styles.title}>{isLogin ? 'Welcome back' : 'Create account'}</Text>
      </View>

      {!isLogin && (
        <Input
          label="DISPLAY NAME"
          placeholder="What should we call you?"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          returnKeyType="next"
        />
      )}
      <Input
        label="EMAIL"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
      />
      <Input
        label="PASSWORD"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        returnKeyType="done"
      />

      <Button
        title={isLogin ? 'LOG IN' : 'SIGN UP'}
        onPress={submit}
        loading={loading}
      />
      <View style={styles.gap} />
      <Button
        title="CONTINUE WITH GOOGLE"
        variant="secondary"
        onPress={google}
        loading={loading}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity onPress={switchMode} style={styles.switch} activeOpacity={0.7}>
        <Text style={styles.switchText}>
          {isLogin ? 'NEW HERE? CREATE ACCOUNT' : 'HAVE AN ACCOUNT? LOG IN'}
        </Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  mockBadge: {
    marginBottom: spacing.md,
  },
  kicker: {
    ...typography.label,
    color: colors.red,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  gap: {
    height: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.red,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  switch: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  switchText: {
    ...typography.label,
    color: colors.textDim,
  },
});
