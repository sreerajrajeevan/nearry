import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { BusinessTabParamList } from '../../navigation/types';
import { useAuth } from '../../store/AuthContext';
import { listMyOffers } from '../../services/offers';
import { listBookingsForBusiness, subscribeToBookings, confirmBooking } from '../../services/bookings';
import { Offer, Booking } from '../../services/mappers';
import { formatTime } from '../../utils/format';

type Props = {
  navigation: { navigate: (screen: keyof BusinessTabParamList) => void };
};

/**
 * Quiet-minimal business dashboard (mockups v2):
 * greeting, big stat numbers, offer nudge, today's schedule as flat rows.
 */
export function DashboardScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [state, setState] = useState<'loading' | 'ready'>('loading');
  const [confirming, setConfirming] = useState<string | null>(null);

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

  const businessName = profile?.businessName || profile?.displayName || 'your business';
  const firstName = businessName.split(' ')[0];
  const liveOffers = offers.filter((o) => o.status === 'live');
  const draftOffers = offers.filter((o) => o.status === 'draft');
  const upcoming = bookings
    .filter((b) => b.status !== 'cancelled' && new Date(b.slot).getTime() >= Date.now() - 3600_000)
    .sort((a, b) => new Date(a.slot).getTime() - new Date(b.slot).getTime());
  const verified = profile?.verificationStatus === 'verified';
  const pad = (n: number) => String(n).padStart(2, '0');

  const onConfirm = async (id: string) => {
    setConfirming(id);
    try {
      await confirmBooking(id);
      await load();
    } catch {
      /* surface stays; bookings screen shows detail */
    } finally {
      setConfirming(null);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.logoMark} />
          <Text style={styles.wordmark}>nearry</Text>
          <View style={styles.flex} />
          <Text style={styles.headerMeta} numberOfLines={1}>{businessName}</Text>
        </View>

        <Text style={styles.hello}>Hello, {firstName}.</Text>
        <Text style={styles.headline}>Make room{"\n"}for a new face.</Text>

        {state === 'loading' ? (
          <Text style={styles.status}>Loading…</Text>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{pad(upcoming.length)}</Text>
                <Text style={styles.statLabel}>Bookings today</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{pad(draftOffers.length)}</Text>
                <Text style={styles.statLabel}>Openings to fill</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {!verified ? (
              <View style={styles.nudge}>
                <Text style={styles.nudgeTitle}>Get verified to go live.</Text>
                <Text style={styles.nudgeDesc}>
                  Your offers stay as drafts until your business is verified. Submit your documents from the Business tab.
                </Text>
              </View>
            ) : draftOffers.length > 0 ? (
              <View style={styles.nudge}>
                <Text style={styles.nudgeTitle}>Someone nearby could use that slot.</Text>
                <Text style={styles.nudgeDesc}>
                  Invite your neighbourhood in with a last-minute offer.
                </Text>
                <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('CreateOffer')}>
                  <Text style={styles.nudgeCta}>Say hello with an offer ↗</Text>
                </TouchableOpacity>
              </View>
            ) : liveOffers.length === 0 ? (
              <View style={styles.nudge}>
                <Text style={styles.nudgeTitle}>No live offers yet.</Text>
                <Text style={styles.nudgeDesc}>
                  Publish your first offer to fill empty slots.
                </Text>
                <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('CreateOffer')}>
                  <Text style={styles.nudgeCta}>Say hello with an offer ↗</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Coming through your door</Text>
              <Text style={styles.sectionMeta}>Today</Text>
            </View>

            {upcoming.length === 0 ? (
              <EmptyState title="Quiet today" hint="New bookings will appear here." />
            ) : (
              upcoming.slice(0, 8).map((b) => (
                <View key={b.id} style={styles.schedRow}>
                  <Text style={styles.schedTime}>{formatTime(b.slot)}</Text>
                  <View style={styles.schedMid}>
                    <Text style={styles.schedName}>{b.customerName}</Text>
                    <Text style={styles.schedDetail}>
                      {[b.offerTitle, b.partySize > 1 ? `${b.partySize} people` : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {b.status === 'confirmed' ? (
                    <Text style={styles.schedDone}>Confirmed</Text>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={confirming === b.id}
                      onPress={() => onConfirm(b.id)}
                    >
                      <Text style={styles.schedAction}>
                        {confirming === b.id ? '…' : 'Confirm'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}

            {upcoming.length > 8 && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Bookings')}>
                <Text style={styles.moreLink}>All bookings ↗</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  logoMark: {
    width: 30,
    height: 30,
    backgroundColor: colors.clay,
    borderRadius: 9,
    borderBottomLeftRadius: 2,
    marginRight: spacing.sm,
  },
  wordmark: { ...typography.heading, fontSize: 24, color: colors.text, letterSpacing: -0.5 },
  headerMeta: { ...typography.body, color: colors.muted, maxWidth: 140 },
  hello: { ...typography.body, color: colors.muted, marginTop: spacing.lg },
  headline: { ...typography.display, fontSize: 40, lineHeight: 46, color: colors.text, marginTop: spacing.xs },
  status: { ...typography.body, color: colors.muted, marginTop: spacing.xl },
  statsRow: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.xl },
  stat: { flex: 1 },
  statValue: { ...typography.display, fontSize: 44, color: colors.text },
  statLabel: { ...typography.body, color: colors.muted, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: spacing.lg },
  nudge: { paddingVertical: spacing.sm },
  nudgeTitle: { ...typography.title, fontSize: 26, color: colors.text },
  nudgeDesc: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  nudgeCta: { ...typography.body, color: colors.clay, fontWeight: '600', marginTop: spacing.md },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  sectionMeta: { ...typography.bodySmall, color: colors.muted },
  schedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: spacing.md,
  },
  schedTime: { ...typography.body, color: colors.muted, width: 76 },
  schedMid: { flex: 1 },
  schedName: { ...typography.body, color: colors.text, fontWeight: '600' },
  schedDetail: { ...typography.bodySmall, color: colors.muted, marginTop: 2 },
  schedDone: { ...typography.body, color: colors.muted },
  schedAction: { ...typography.body, color: colors.clay, fontWeight: '600' },
  moreLink: { ...typography.body, color: colors.clay, fontWeight: '600', marginTop: spacing.md },
});
