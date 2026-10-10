import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Input } from '../../components/Input';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { PostRow } from '../../components/PostRow';
import { colors, typography, spacing } from '../../theme';
import { mockOffers } from '../../data/mock';
import { searchVenues } from '../../services/venues';
import { listPosts } from '../../services/posts';
import { NeedPost, Venue } from '../../services/mappers';
import { timeLeft } from '../../utils/format';
import { PersonalTabNav } from '../../navigation/types';

type Filter = 'all' | 'venues' | 'posts' | 'offers';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'venues', label: 'VENUES' },
  { key: 'posts', label: 'POSTS' },
  { key: 'offers', label: 'OFFERS' },
];

export function SearchScreen() {
  const navigation = useNavigation<PersonalTabNav>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState('idle');
      setVenues([]);
      setPosts([]);
      return;
    }
    setState('loading');
    const t = setTimeout(async () => {
      try {
        const [v, p] = await Promise.all([searchVenues(q), listPosts({ search: q })]);
        setVenues(v);
        setPosts(p);
        setState('ready');
      } catch {
        setState('error');
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const q = query.trim().toLowerCase();
  const offers = q
    ? mockOffers.filter(
        (o) => o.title.toLowerCase().includes(q) || o.businessName.toLowerCase().includes(q),
      )
    : [];

  const showVenues = filter === 'all' || filter === 'venues';
  const showPosts = filter === 'all' || filter === 'posts';
  const showOffers = filter === 'all' || filter === 'offers';
  const searched = state === 'ready' || state === 'loading' || state === 'error';
  const hasResults =
    (showVenues && venues.length > 0) ||
    (showPosts && posts.length > 0) ||
    (showOffers && offers.length > 0);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>SEARCH</Text>

        <Input
          placeholder="Venues, posts, offers…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          containerStyle={styles.input}
        />

        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.8}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!searched ? (
          <EmptyState title="Search Nearry" hint="Find venues, people and offers around you." />
        ) : state === 'loading' ? (
          <Text style={styles.status}>SEARCHING…</Text>
        ) : state === 'error' ? (
          <View>
            <EmptyState title="Search failed" hint="Check your connection and try again." />
            <Button title="RETRY" onPress={() => setQuery((s) => s + ' ')} />
          </View>
        ) : hasResults ? (
          <>
            {showVenues && venues.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>VENUES</Text>
                {venues.map((venue) => (
                  <TouchableOpacity
                    key={venue.id}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('VenueDetails', { venueId: venue.id })}
                  >
                    <Card style={styles.resultCard}>
                      <Text style={styles.resultTitle}>{venue.name}</Text>
                      <Text style={styles.resultMeta}>
                        {venue.category} · {venue.area}
                      </Text>
                    </Card>
                  </TouchableOpacity>
                ))}
              </>
            ) : null}

            {showPosts && posts.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>POSTS</Text>
                {posts.map((post) => (
                  <PostRow
                    key={post.id}
                    post={post}
                    onPress={() => navigation.navigate('PostDetails', { postId: post.id })}
                  />
                ))}
              </>
            ) : null}

            {showOffers && offers.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>OFFERS</Text>
                {offers.map((offer) => (
                  <Card key={offer.id} accent style={styles.resultCard}>
                    <Text style={styles.resultMeta}>{offer.businessName}</Text>
                    <Text style={styles.resultTitle}>{offer.title}</Text>
                    <View style={styles.offerFooter}>
                      <Badge label={timeLeft(offer.endsAt)} tone="red" />
                    </View>
                  </Card>
                ))}
              </>
            ) : null}
          </>
        ) : (
          <EmptyState title="No results" hint="Try another search." />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  input: { marginTop: spacing.md },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { borderColor: colors.red },
  chipText: { ...typography.caption, color: colors.textDim },
  chipTextActive: { color: colors.red },
  sectionLabel: {
    ...typography.label,
    color: colors.textDim,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  resultCard: { marginBottom: spacing.sm },
  resultTitle: { ...typography.heading, color: colors.text },
  resultMeta: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  offerFooter: { marginTop: spacing.sm },
});
