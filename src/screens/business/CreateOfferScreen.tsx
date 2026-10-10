import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { createOffer } from '../../services/offers';

type StartsIn = 'NOW' | 'IN 1H' | 'TONIGHT';
type Duration = '2H' | '4H' | 'TODAY';

const STARTS_IN_OPTIONS: StartsIn[] = ['NOW', 'IN 1H', 'TONIGHT'];
const DURATION_OPTIONS: Duration[] = ['2H', '4H', 'TODAY'];

function ChipRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: T[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = opt === selected;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            activeOpacity={0.8}
            style={[styles.chip, active && styles.chipSelected]}
          >
            <Text style={[styles.chipText, active && styles.chipTextSelected]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Stepper({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.8}
          onPress={() => onChange(Math.max(min, value - step))}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>
          {value}
          {suffix}
        </Text>
        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.8}
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function computeWindow(startsIn: StartsIn, duration: Duration): { startsAt: string; endsAt: string } {
  const now = new Date();
  let start: Date;
  if (startsIn === 'IN 1H') {
    start = new Date(now.getTime() + 3_600_000);
  } else if (startsIn === 'TONIGHT') {
    start = new Date(now);
    start.setHours(19, 0, 0, 0);
    if (start.getTime() <= now.getTime()) start = new Date(now.getTime() + 3_600_000);
  } else {
    start = now;
  }

  let end: Date;
  if (duration === '2H') {
    end = new Date(start.getTime() + 2 * 3_600_000);
  } else if (duration === '4H') {
    end = new Date(start.getTime() + 4 * 3_600_000);
  } else {
    end = new Date(start);
    end.setHours(23, 59, 0, 0);
  }

  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export function CreateOfferScreen() {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const [discount, setDiscount] = useState(20);
  const [startsIn, setStartsIn] = useState<StartsIn>('NOW');
  const [duration, setDuration] = useState<Duration>('2H');
  const [maxRedemptions, setMaxRedemptions] = useState(50);
  const [publishing, setPublishing] = useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
    setTitleError(undefined);
    setDiscount(20);
    setStartsIn('NOW');
    setDuration('2H');
    setMaxRedemptions(50);
  };

  const publish = async () => {
    if (!title.trim()) {
      setTitleError('TITLE IS REQUIRED');
      return;
    }
    setTitleError(undefined);
    setPublishing(true);
    try {
      const { startsAt, endsAt } = computeWindow(startsIn, duration);
      await createOffer(profile?.id ?? 'demo-business', {
        title: title.trim(),
        description: description.trim(),
        discountPct: discount,
        startsAt,
        endsAt,
        maxRedemptions,
      });
      Alert.alert('Offer is live', `"${title.trim()}" is now visible to nearby users.`);
      reset();
    } catch (e) {
      Alert.alert('Publish failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>CREATE OFFER</Text>
        <Text style={styles.caption}>LAST-MINUTE PUSH</Text>

        <Input
          label="OFFER TITLE"
          placeholder="e.g. Happy Hours Flat 20% Off"
          value={title}
          onChangeText={(t: string) => {
            setTitle(t);
            if (titleError && t.trim()) setTitleError(undefined);
          }}
          error={titleError}
          maxLength={60}
        />
        <Input
          label="DESCRIPTION"
          placeholder="What is included, when it applies…"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={240}
          style={styles.textarea}
        />

        <Stepper
          label="DISCOUNT"
          value={discount}
          suffix="%"
          min={0}
          max={90}
          step={5}
          onChange={setDiscount}
        />

        <Text style={styles.fieldLabel}>STARTS</Text>
        <ChipRow options={STARTS_IN_OPTIONS} selected={startsIn} onSelect={setStartsIn} />

        <Text style={styles.fieldLabel}>DURATION</Text>
        <ChipRow options={DURATION_OPTIONS} selected={duration} onSelect={setDuration} />

        <Stepper
          label="MAX REDEMPTIONS"
          value={maxRedemptions}
          suffix=""
          min={10}
          max={500}
          step={10}
          onChange={setMaxRedemptions}
        />

        <Button
          title="PUBLISH OFFER"
          onPress={publish}
          loading={publishing}
          style={styles.publishBtn}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  caption: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs, marginBottom: spacing.lg },
  /** Replaces Input's fixed-height style (spread order) for a 3-row textarea. */
  textarea: {
    height: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
  fieldLabel: { ...typography.label, color: colors.textDim, marginTop: spacing.md, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  chipSelected: { borderColor: colors.red, backgroundColor: colors.surfaceRaised },
  chipText: { ...typography.label, color: colors.textFaint },
  chipTextSelected: { color: colors.red },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { ...typography.heading, color: colors.text },
  stepValue: { ...typography.heading, color: colors.red, minWidth: 64, textAlign: 'center' },
  publishBtn: { marginTop: spacing.xl },
});
