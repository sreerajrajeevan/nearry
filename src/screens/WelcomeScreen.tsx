import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { colors, typography, spacing } from '../theme';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

/** Full-black hero: pick a lane — exploring or business. */
export function WelcomeScreen({ navigation }: Props) {
  return (
    <Screen padded>
      <View style={styles.hero}>
        <Text style={styles.wordmark}>
          NEARRY<Text style={styles.dot}>.</Text>
        </Text>
        <Text style={styles.tagline}>FIND YOUR PEOPLE. FILL YOUR PLACES.</Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="I'M EXPLORING"
          onPress={() => navigation.navigate('PersonalAuth', { mode: 'login' })}
        />
        <View style={styles.gap} />
        <Button
          title="I'M A BUSINESS"
          variant="secondary"
          onPress={() => navigation.navigate('BusinessAuth', { mode: 'login' })}
        />
      </View>

      <Text style={styles.caption}>NOTHING-STYLE MVP · V0.1</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    ...typography.display,
    fontSize: 58,
    lineHeight: 64,
    letterSpacing: 6,
    color: colors.text,
  },
  dot: {
    color: colors.red,
  },
  tagline: {
    ...typography.label,
    color: colors.textDim,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  actions: {
    marginBottom: spacing.xl,
  },
  gap: {
    height: spacing.md,
  },
  caption: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
