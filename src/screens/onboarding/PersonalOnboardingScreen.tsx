import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { colors, typography, spacing, radius } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { requestLocationPermission } from '../../services/location';

const INTERESTS = ['Sports', 'Food', 'Music', 'Outdoors', 'Games', 'Culture', 'Nightlife'];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

/** 3-step personal onboarding: interests → location → done. */
export function PersonalOnboardingScreen() {
  const { completeOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [locating, setLocating] = useState(false);

  const toggle = (item: string) =>
    setSelected((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );

  const enableLocation = async () => {
    setLocating(true);
    try {
      await requestLocationPermission();
    } finally {
      setLocating(false);
      setStep(3);
    }
  };

  const progress = `0${step} / 03`;

  return (
    <Screen padded>
      <Text style={styles.progress}>{progress}</Text>

      {step === 1 && (
        <View style={styles.body}>
          <Text style={styles.title}>What are you into?</Text>
          <Text style={styles.sub}>Pick a few. We use this to surface your kind of people.</Text>
          <View style={styles.chips}>
            {INTERESTS.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={selected.includes(item)}
                onPress={() => toggle(item)}
              />
            ))}
          </View>
          <View style={styles.footer}>
            <Button title="CONTINUE" onPress={() => setStep(2)} />
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={styles.body}>
          <Text style={styles.title}>Where are you?</Text>
          <Text style={styles.sub}>
            Nearby runs on location. Enable it to see people and places around you.
          </Text>
          <View style={styles.footer}>
            <Button title="ENABLE LOCATION" onPress={enableLocation} loading={locating} />
            <View style={styles.gap} />
            <Button title="SKIP" variant="ghost" onPress={() => setStep(3)} />
          </View>
          <TouchableOpacity onPress={() => setStep(1)} style={styles.back} activeOpacity={0.7}>
            <Text style={styles.backText}>← BACK</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 3 && (
        <View style={styles.done}>
          <Text style={styles.doneTitle}>
            YOU'RE IN<Text style={styles.dot}>.</Text>
          </Text>
          <Text style={styles.sub}>Your people are already out there. Go find them.</Text>
          <View style={styles.footer}>
            <Button title="START EXPLORING" onPress={() => completeOnboarding({ interests: selected })} />
          </View>
          <TouchableOpacity onPress={() => setStep(2)} style={styles.back} activeOpacity={0.7}>
            <Text style={styles.backText}>← BACK</Text>
          </TouchableOpacity>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    ...typography.label,
    color: colors.textFaint,
    marginTop: spacing.md,
  },
  body: {
    flex: 1,
    marginTop: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sub: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginBottom: spacing.lg,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.red,
  },
  chipText: {
    ...typography.label,
    color: colors.textDim,
  },
  chipTextSelected: {
    color: colors.text,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: spacing.md,
  },
  gap: {
    height: spacing.sm,
  },
  back: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  backText: {
    ...typography.label,
    color: colors.textFaint,
  },
  done: {
    flex: 1,
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    ...typography.display,
    color: colors.text,
    textAlign: 'center',
  },
  dot: {
    color: colors.red,
  },
});
