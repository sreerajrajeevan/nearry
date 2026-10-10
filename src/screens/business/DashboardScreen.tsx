import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { BusinessTabParamList } from '../../navigation/types';
import { useAuth } from '../../store/AuthContext';
import { Offer, mockBookings } from '../../data/mock';
import { listOffers } from '../../services/offers';
import { timeLeft } from '../../utils/format';

type Props = {
  navigation: { navigate: (screen: keyof BusinessTabParamList) => void };
};

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function DashboardScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const businessName = (profile?.displayName ?? 'YOUR BUSINESS').toUpperCase();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listOffers()
        .then((list) => {
          if (active) setOffers(list);
        })
        .catch(() => {
          /* keep last known list in mock mode */
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const liveOffers = offers.filter((o) => o.status === 'live');
  const pendingCount = mockBookings.filter((b) => b.status === 'pending').length;
  const totalRedemptions = offers.reduce((sum, o) => sum + o.redemptions, 0);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>DASHBOARD</Text>
        <Text style={styles.businessName}>{businessName}</Text>

        <View style={styles.statsRow}>
          <StatBox label="LIVE OFFERS" value={String(liveOffers.length)} />
          <StatBox label="PENDING" value={String(pendingCount)} />
          <StatBox label="REDEMPTIONS" value={String(totalRedemptions)} />
        </View>

        <Text style={styles.sectionTitle}>LIVE OFFERS</Text>
        {liveOffers.length === 0 ? (
          <EmptyState
            title="No live offers"
            hint="Publish your first last-minute offer to fill empty slots."
          />
        ) : (
          liveOffers.map((offer) => (
            <Card key={offer.id} style={styles.offerCard} accent>
              <View style={styles.offerHeader}>
                <Text style={styles.offerTitle} numberOfLines={1}>
                  {offer.title}
                </Text>
                {typeof offer.discountPct === 'number' ? (
                  <Badge label={`-${offer.discountPct}%`} tone="red" />
                ) : null}
              </View>
              <Text style={styles.offerDesc} numberOfLines={2}>
                {offer.description}
              </Text>
              <View style={styles.offerFooter}>
                <Badge label={timeLeft(offer.endsAt)} tone="red" />
                <Text style={styles.claimed}>
                  {offer.redemptions}/{offer.maxRedemptions ?? '—'} CLAIMED
                </Text>
              </View>
            </Card>
          ))
        )}

        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <Button
          title="CREATE OFFER"
          variant="secondary"
          onPress={() => navigation.navigate('CreateOffer')}
          style={styles.actionBtn}
        />
        <Button
          title="VIEW BOOKINGS"
          variant="secondary"
          onPress={() => navigation.navigate('Bookings')}
          style={styles.actionBtn}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  businessName: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  statValue: { ...typography.title, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textFaint, marginTop: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.textDim, marginTop: spacing.xl, marginBottom: spacing.sm },
  offerCard: { marginBottom: spacing.sm },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  offerTitle: { ...typography.heading, color: colors.text, flex: 1 },
  offerDesc: { ...typography.bodySmall, color: colors.textDim, marginTop: spacing.xs },
  offerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  claimed: { ...typography.caption, color: colors.textDim },
  actionBtn: { marginBottom: spacing.sm },
});
