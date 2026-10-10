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
import { listMyOffers } from '../../services/offers';
import { listBookingsForBusiness, subscribeToBookings } from '../../services/bookings';
import { Offer, Booking } from '../../services/mappers';
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

/** Dashboard — metrics derived from real offer + booking records. */
export function DashboardScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [state, setState] = useState<'loading' | 'ready'>('loading');

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const [o, b] = await Promise.all([listMyOffers(profile.id), listBookingsForBusiness(profile.id)]);
      setOffers(o);
      setBookings(b);
    } catch {
      /* keep last known */
    } finally {
      setState('ready');
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  React.useEffect(() => subscribeToBookings(() => void load()), [load]);

  const businessName = (profile?.businessName ?? profile?.displayName ?? 'YOUR BUSINESS').toUpperCase();
  const liveOffers = offers.filter((o) => o.status === 'live');
  const draftOffers = offers.filter((o) => o.status === 'draft');
  const activeBookings = bookings.filter((b) => b.status === 'pending' || b.status === 'confirmed');
  const seatsBooked = activeBookings.reduce((sum, b) => sum + b.partySize, 0);
  const verified = profile?.verificationStatus === 'verified';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>DASHBOARD</Text>
        <View style={styles.nameRow}>
          <Text style={styles.businessName}>{businessName}</Text>
          <Badge
            label={verified ? 'VERIFIED' : (profile?.verificationStatus ?? 'UNVERIFIED').toUpperCase()}
            tone={verified ? 'green' : 'red'}
          />
        </View>

        {state === 'loading' ? (
          <Text style={styles.status}>LOADING…</Text>
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatBox label="LIVE OFFERS" value={String(liveOffers.length)} />
              <StatBox label="DRAFTS" value={String(draftOffers.length)} />
              <StatBox label="BOOKINGS" value={String(activeBookings.length)} />
              <StatBox label="SEATS BOOKED" value={String(seatsBooked)} />
            </View>

            {!verified && (
              <Card style={styles.verifyCard} accent>
                <Text style={styles.verifyTitle}>GET VERIFIED TO PUBLISH</Text>
                <Text style={styles.verifyDesc}>
                  Offers stay as drafts until your business is verified. Submit your documents
                  from the Business tab.
                </Text>
              </Card>
            )}

            <Text style={styles.sectionTitle}>LIVE OFFERS</Text>
            {liveOffers.length === 0 ? (
              <EmptyState
                title="No live offers"
                hint={verified ? 'Publish your first offer to fill empty slots.' : 'Verify your business, then publish.'}
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
                    <Text style={styles.claimed}>{offer.slotCapacity} SEATS/SLOT</Text>
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
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  businessName: { ...typography.caption, color: colors.textDim },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
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
  verifyCard: { marginTop: spacing.lg },
  verifyTitle: { ...typography.label, color: colors.red, marginBottom: spacing.xs },
  verifyDesc: { ...typography.bodySmall, color: colors.textDim },
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
