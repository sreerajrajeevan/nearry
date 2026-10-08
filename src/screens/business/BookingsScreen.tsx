import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { Booking, mockBookings } from '../../data/mock';

const FILTERS = ['ALL', 'PENDING', 'CONFIRMED'] as const;
type Filter = (typeof FILTERS)[number];

function statusTone(status: Booking['status']): 'neutral' | 'green' | 'red' {
  if (status === 'confirmed') return 'green';
  if (status === 'cancelled') return 'red';
  return 'neutral';
}

export function BookingsScreen() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [bookings, setBookings] = useState<Booking[]>(mockBookings);

  const visible = bookings.filter(
    (b) => filter === 'ALL' || b.status === filter.toLowerCase(),
  );

  const setStatus = (id: string, status: Booking['status']) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
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

        {visible.length === 0 ? (
          <EmptyState
            title="No bookings"
            hint={
              filter === 'ALL'
                ? 'New booking requests will appear here.'
                : `Nothing ${filter.toLowerCase()} right now.`
            }
          />
        ) : (
          visible.map((booking) => (
            <Card key={booking.id} style={styles.card}>
              <View style={styles.topRow}>
                <Avatar name={booking.customerName} size={40} />
                <View style={styles.nameBlock}>
                  <Text style={styles.customerName}>{booking.customerName}</Text>
                  <Text style={styles.slot}>{booking.slot}</Text>
                </View>
                <Badge label={booking.status} tone={statusTone(booking.status)} />
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.offerTitle} numberOfLines={1}>
                  {booking.offerTitle}
                </Text>
                <Text style={styles.party}>×{booking.partySize}</Text>
              </View>

              {booking.status === 'pending' ? (
                <View style={styles.actionsRow}>
                  <Button
                    title="CONFIRM"
                    variant="primary"
                    onPress={() => setStatus(booking.id, 'confirmed')}
                    style={styles.smallBtn}
                  />
                  <Button
                    title="DECLINE"
                    variant="danger"
                    onPress={() => setStatus(booking.id, 'cancelled')}
                    style={styles.smallBtn}
                  />
                </View>
              ) : null}
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
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { borderColor: colors.red, backgroundColor: colors.surfaceRaised },
  chipText: { ...typography.label, color: colors.textFaint },
  chipTextSelected: { color: colors.red },
  card: { marginBottom: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameBlock: { flex: 1 },
  customerName: { ...typography.heading, color: colors.text },
  slot: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  offerTitle: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
  party: { ...typography.mono, color: colors.text },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  smallBtn: { flex: 1, height: 42 },
});
