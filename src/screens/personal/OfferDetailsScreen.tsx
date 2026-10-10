import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Input } from '../../components/Input';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { PersonalStackParamList } from '../../navigation/types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../store/AuthContext';
import { getOffer } from '../../services/offers';
import { bookOffer } from '../../services/bookings';
import { Offer } from '../../services/mappers';
import { timeLeft } from '../../utils/format';

type Props = NativeStackScreenProps<PersonalStackParamList, 'OfferDetails'>;

function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const t = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!d || !t) return null;
  const dt = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function fmtINR(cents?: number): string {
  if (cents === undefined) return '';
  return `₹${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Offer details + booking. Capacity enforced atomically server-side. */
export function OfferDetailsScreen({ route, navigation }: Props) {
  const { offerId } = route.params;
  const { profile } = useAuth();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [formError, setFormError] = useState('');
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const o = await getOffer(offerId);
      if (!o) throw new Error('Offer not found.');
      setOffer(o);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [offerId]);

  useEffect(() => {
    void load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onBook = async () => {
    setFormError('');
    if (!profile) {
      setFormError('Sign in to book.');
      return;
    }
    const slot = parseDateTime(dateStr, timeStr);
    if (!slot) {
      setFormError('Enter date as YYYY-MM-DD and time as HH:MM (24h).');
      return;
    }
    setBooking(true);
    try {
      await bookOffer(offerId, slot.toISOString(), partySize);
      setDone(true);
    } catch (e) {
      Alert.alert('Could not book', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBooking(false);
    }
  };

  if (state === 'loading') {
    return (
      <Screen padded>
        <Text style={styles.status}>LOADING…</Text>
      </Screen>
    );
  }
  if (state === 'error' || !offer) {
    return (
      <Screen padded>
        <EmptyState title="Couldn't load this offer" hint="It may have ended." />
        <Button title="GO BACK" variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.back}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{offer.title}</Text>
          {typeof offer.discountPct === 'number' && <Badge label={`-${offer.discountPct}%`} tone="red" />}
        </View>
        <Text style={styles.business}>{offer.businessName.toUpperCase()}</Text>
        <Text style={styles.desc}>{offer.description}</Text>
        <View style={styles.metaRow}>
          <Badge label={timeLeft(offer.endsAt)} tone="red" />
          {offer.priceCents !== undefined && <Badge label={fmtINR(offer.priceCents)} tone="neutral" />}
          <Text style={styles.meta}>{offer.slotCapacity} SEATS/SLOT</Text>
        </View>

        {done ? (
          <View style={styles.doneBox}>
            <Badge label="BOOKED" tone="green" />
            <Text style={styles.doneText}>
              Your seats are held. The business will confirm shortly — track it in Activity.
            </Text>
          </View>
        ) : offer.status !== 'live' ? (
          <EmptyState title="This offer isn't live" hint="Check back for the next one." />
        ) : (
          <View style={styles.bookBox}>
            <Text style={styles.sectionTitle}>BOOK SEATS</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <Input label="DATE (YYYY-MM-DD)" placeholder="2026-10-18" value={dateStr} onChangeText={setDateStr} />
              </View>
              <View style={styles.half}>
                <Input label="TIME (HH:MM)" placeholder="19:00" value={timeStr} onChangeText={setTimeStr} />
              </View>
            </View>
            <Text style={styles.fieldLabel}>SEATS</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} activeOpacity={0.8} onPress={() => setPartySize((v) => Math.max(1, v - 1))}>
                <Text style={styles.stepText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{partySize}</Text>
              <TouchableOpacity style={styles.stepBtn} activeOpacity={0.8} onPress={() => setPartySize((v) => Math.min(20, v + 1))}>
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <Button title="BOOK NOW" onPress={onBook} loading={booking} style={styles.bookBtn} />
            <Text style={styles.note}>No payment in this milestone — booking only holds seats.</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl * 2 },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  back: { marginBottom: spacing.md, alignSelf: 'flex-start' },
  backText: { ...typography.label, color: colors.textDim },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  title: { ...typography.h1, color: colors.text, flex: 1 },
  business: { ...typography.caption, color: colors.textDim, marginTop: spacing.sm },
  desc: { ...typography.body, color: colors.text, marginTop: spacing.lg, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  meta: { ...typography.caption, color: colors.textDim },
  bookBox: { marginTop: spacing.xl },
  sectionTitle: { ...typography.label, color: colors.textDim, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  fieldLabel: { ...typography.label, color: colors.textDim, marginBottom: spacing.sm, marginTop: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { width: 44, height: 44, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  stepText: { ...typography.title, color: colors.text },
  stepValue: { ...typography.title, color: colors.text, minWidth: 36, textAlign: 'center' },
  formError: { ...typography.body, color: colors.red, marginVertical: spacing.sm },
  bookBtn: { marginTop: spacing.lg },
  note: { ...typography.caption, color: colors.textFaint, marginTop: spacing.md, textAlign: 'center' },
  doneBox: { marginTop: spacing.xl, alignItems: 'flex-start', gap: spacing.md },
  doneText: { ...typography.body, color: colors.text },
});
