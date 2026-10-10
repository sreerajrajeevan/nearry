import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { isSupabaseConfigured } from '../../services/supabase';
import { isValidDisplayName, isValidEmail, isValidOtp } from '../../utils/validation';
import { AccountType } from '../../navigation/types';

type Props = {
  accountType: AccountType;
  kicker: string;
  mode: 'login' | 'signup';
  onSwitchMode: () => void;
};

/**
 * Passwordless auth: email OTP (6-digit code) + Google via Supabase.
 * No passwords, no phone numbers. The saved profile's account type —
 * not this screen's lane — decides where the user lands after login.
 */
export function AuthScreen({ accountType, kicker, mode, onSwitchMode }: Props) {
  const isLogin = mode === 'login';
  const { sendOtp, verifyOtp, signInGoogle, loading } = useAuth();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : 'Something went wrong.');

  const sendCode = async () => {
    setError(null);
    const clean = email.trim();
    if (!isValidEmail(clean)) return setError('Enter a valid email address.');
    if (!isLogin && !isValidDisplayName(displayName))
      return setError('Display name must be 2–40 characters.');
    try {
      await sendOtp(clean, accountType, isLogin ? undefined : displayName.trim());
      setSentTo(clean);
      setStep('code');
    } catch (e) {
      fail(e);
    }
  };

  const confirmCode = async () => {
    setError(null);
    if (!isValidOtp(code)) return setError('Enter the 6-digit code.');
    try {
      await verifyOtp(sentTo ?? email.trim(), code.trim());
      // RootNavigator routes on session+profile automatically.
    } catch (e) {
      fail(e);
    }
  };

  const google = async () => {
    setError(null);
    try {
      await signInGoogle(accountType);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Screen padded>
      <View style={styles.header}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>
          {step === 'email' ? (isLogin ? 'Welcome back' : 'Create account') : 'Check your inbox'}
        </Text>
        {step === 'code' && sentTo && (
          <Text style={styles.sub}>We sent a 6-digit code to {sentTo}.</Text>
        )}
      </View>

      {!isSupabaseConfigured && (
        <View style={styles.warn}>
          <Badge label="BACKEND NOT CONFIGURED" />
          <Text style={styles.warnText}>
            Real sign-in needs the Supabase backend. Use the demo from the welcome screen,
            or configure EXPO_PUBLIC_SUPABASE_URL / ANON_KEY and rebuild.
          </Text>
        </View>
      )}

      {step === 'email' ? (
        <>
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
            returnKeyType="send"
            onSubmitEditing={sendCode}
          />
          <View style={styles.gap} />
          <Button title="SEND CODE" onPress={sendCode} loading={loading} />
        </>
      ) : (
        <>
          <Input
            label="6-DIGIT CODE"
            placeholder="123456"
            value={code}
            onChangeText={(t: string) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            returnKeyType="send"
            onSubmitEditing={confirmCode}
            autoFocus
          />
          <View style={styles.gap} />
          <Button title="VERIFY" onPress={confirmCode} loading={loading} />
          <TouchableOpacity onPress={sendCode} activeOpacity={0.7} style={styles.link}>
            <Text style={styles.linkText}>RESEND CODE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
            activeOpacity={0.7}
            style={styles.link}
          >
            <Text style={styles.linkText}>USE A DIFFERENT EMAIL</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>OR</Text>
        <View style={styles.line} />
      </View>
      <Button title="CONTINUE WITH GOOGLE" variant="secondary" onPress={google} loading={loading} />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity onPress={onSwitchMode} activeOpacity={0.7} style={styles.switch}>
        <Text style={styles.switchText}>
          {isLogin ? "NEW HERE? CREATE AN ACCOUNT" : 'ALREADY HAVE ONE? LOG IN'}
        </Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xl, marginBottom: spacing.lg },
  kicker: { ...typography.label, color: colors.red, letterSpacing: 3 },
  title: { ...typography.h1, color: colors.text, marginTop: spacing.sm },
  sub: { ...typography.body, color: colors.textDim, marginTop: spacing.sm },
  warn: { marginBottom: spacing.lg, gap: spacing.sm },
  warnText: { ...typography.caption, color: colors.textDim },
  gap: { height: spacing.md },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { ...typography.caption, color: colors.textFaint, marginHorizontal: spacing.md },
  link: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { ...typography.label, color: colors.textDim },
  error: { ...typography.body, color: colors.red, marginTop: spacing.lg, textAlign: 'center' },
  switch: { marginTop: spacing.xl, alignItems: 'center' },
  switchText: { ...typography.label, color: colors.text },
});
