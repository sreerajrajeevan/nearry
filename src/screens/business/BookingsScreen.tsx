import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import {
  listBookingsForBusiness,
  confirmBooking,
  cancelBooking,
  subscribeToBookings,
} from '../../services/bookings';
import { Booking } from '../../services/mappers';

const FILTERS = ['ALL', 'PENDING', 'CONFIRMED', 'CANCELLED'] as const;
type Filter = (typeof FILTERS)[number];

function statusTone(status: Booking['status']): 'neutral' | 'green' | 'red' {
  if (status === 'confirmed') return 'green';
  if (status === 'cancelled') return 'red';
  return 'neutral';
}

/** Business bookings view — real records, confirm/cancel, realtime-synced. */
export function BookingsScreen() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setState('loading');
    try {
      setBookings(await listBookingsForBusiness(profile.id));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => subscribeToBookings(() => void load()), [load]);

  const visible = bookings.filter((b) => filter === 'ALL' || b.status === filter.toLowerCase());

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert('Hmm', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>BOOKINGS</Text>
        <Text style={styles.caption}>MANAGE INCOMING REQUESTS</Text>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
                style={[styles.chip, active && styles.chipSelected]}
              >
                <Text style={[styles.chipText, active && styles.chipTextSelected]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {state === 'loading' ? (
          <Text style={styles.status}>LOADING…</Text>
        ) : state === 'error' ? (
          <View>
            <EmptyState title="Couldn't load bookings" hint="Check your connection and retry." />
            <Button title="RETRY" onPress={() => void load()} />
          </View>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No bookings"
            hint={filter === 'ALL' ? 'New booking requests will appear here.' : `No ${filter.toLowerCase()} bookings.`}
          />
        ) : (
          visible.map((b) => (
            <Card key={b.id} style={styles.card}>
              <View style={styles.topRow}>
                <Avatar name={b.customerName} size={36} />
                <View style={styles.topText}>
                  <Text style={styles.customer}>{b.customerName}</Text>
                  <Text style={styles.offer}>{b.offerTitle}</Text>
                </View>
                <Badge label={b.status.toUpperCase()} tone={statusTone(b.status)} />
              </View>
              <Text style={styles.meta}>
                {new Date(b.slot).toLocaleString()} · {b.partySize} {b.partySize === 1 ? 'SEAT' : 'SEATS'}
              </Text>
              {b.status === 'pending' && (
                <View style={styles.actions}>
                  <Button
                    title="DECLINE"
                    variant="ghost"
                    loading={busy === `x${b.id}`}
                    onPress={() => run(`x${b.id}`, () => cancelBooking(b.id))}
                  />
                  <View style={styles.gap} />
                  <Button
                    title="CONFIRM"
                    loading={busy === `c${b.id}`}
                    onPress={() => run(`c${b.id}`, () => confirmBooking(b.id))}
                  />
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  caption: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs, marginBottom: spacing.md },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { borderColor: colors.red },
  chipText: { ...typography.caption, color: colors.textDim },
  chipTextSelected: { color: colors.red },
  card: { marginBottom: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topText: { flex: 1 },
  customer: { ...typography.body, color: colors.text },
  offer: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  meta: { ...typography.caption, color: colors.textDim, marginTop: spacing.sm },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  gap: { width: spacing.sm },
});
