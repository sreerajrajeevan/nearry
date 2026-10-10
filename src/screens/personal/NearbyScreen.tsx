import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { PostRow } from '../../components/PostRow';
import { colors, typography, spacing } from '../../theme';
import { listPosts, subscribeToPosts } from '../../services/posts';
import { listLiveOffers } from '../../services/offers';
import { listVenues } from '../../services/venues';
import { NeedPost, Venue, Offer } from '../../services/mappers';
import { timeLeft } from '../../utils/format';
import { PersonalTabNav } from '../../navigation/types';

type LoadState = 'loading' | 'error' | 'ready';

export function NearbyScreen() {
  const navigation = useNavigation<PersonalTabNav>();
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const [p, v, o] = await Promise.all([listPosts(), listVenues(), listLiveOffers()]);
      setPosts(p);
      setVenues(v);
      setOffers(o);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );
  useEffect(() => subscribeToPosts(() => load(true)), [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const liveOffers = offers;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.red} />}
      >
        <Text style={styles.header}>NEARBY</Text>
        <Text style={styles.location}>KOCHI · 2 KM</Text>

        {state === 'loading' && posts.length === 0 ? (
          <Text style={styles.status}>LOADING…</Text>
        ) : state === 'error' && posts.length === 0 ? (
          <View>
            <EmptyState title="Couldn't load" hint="Check your connection and retry." />
            <Button title="RETRY" onPress={() => load()} />
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>LIVE OFFERS</Text>
            {liveOffers.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offerRow}>
                {liveOffers.map((offer) => (
                  <TouchableOpacity
                    key={offer.id}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('OfferDetails', { offerId: offer.id })}
                  >
                    <Card accent style={styles.offerCard}>
                      <Text style={styles.offerBusiness}>{offer.businessName}</Text>
                      <Text style={styles.offerTitle}>{offer.title}</Text>
                      <Badge label={timeLeft(offer.endsAt)} tone="red" />
                    </Card>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <EmptyState title="No live offers" hint="Check back soon." />
            )}

            <Text style={styles.sectionLabel}>NEED PEOPLE · {posts.length}</Text>
            {posts.length > 0 ? (
              posts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  onPress={() => navigation.navigate('PostDetails', { postId: post.id })}
                />
              ))
            ) : (
              <EmptyState title="No open posts" hint="Be the first to gather people nearby." />
            )}

            <Text style={styles.sectionLabel}>VENUES · {venues.length}</Text>
            {venues.length > 0 ? (
              venues.map((venue) => (
                <TouchableOpacity
                  key={venue.id}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('VenueDetails', { venueId: venue.id })}
                >
                  <View style={styles.venueRow}>
                    <View style={styles.venueLeft}>
                      <Text style={styles.venueName}>{venue.name}</Text>
                      <Text style={styles.venueMeta}>
                        {venue.category} · {venue.area}
                      </Text>
                      {venue.liveOffer ? <Text style={styles.venueOffer}>{venue.liveOffer}</Text> : null}
                    </View>
                    <View style={styles.venueRight}>
                      <Text style={styles.venueRating}>★ {venue.rating.toFixed(1)}</Text>
                      {venue.distanceKm !== undefined && (
                        <Text style={styles.venueDist}>{venue.distanceKm.toFixed(1)} KM</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <EmptyState title="No venues" hint="Nothing found in this area." />
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  location: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  sectionLabel: {
    ...typography.label,
    color: colors.textDim,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  offerRow: { gap: spacing.sm, paddingRight: spacing.md },
  offerCard: { width: 240 },
  offerBusiness: { ...typography.caption, color: colors.textDim, marginBottom: spacing.xs },
  offerTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.sm },
  venueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  venueLeft: { flex: 1 },
  venueName: { ...typography.heading, color: colors.text },
  venueMeta: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  venueOffer: { ...typography.caption, color: colors.red, marginTop: spacing.xs },
  venueRight: { alignItems: 'flex-end' },
  venueRating: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  venueDist: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
});
