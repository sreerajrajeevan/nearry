import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Input } from '../../components/Input';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { mockPosts, mockOffers, Venue } from '../../data/mock';
import { searchVenues } from '../../services/venues';
import { timeLeft } from '../../utils/format';

type Filter = 'all' | 'venues' | 'posts' | 'offers';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'venues', label: 'VENUES' },
  { key: 'posts', label: 'POSTS' },
  { key: 'offers', label: 'OFFERS' },
];

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [venues, setVenues] = useState<Venue[]>([]);

  useEffect(() => {
    searchVenues(query)
      .then(setVenues)
      .catch(() => setVenues([]));
  }, [query]);

  const q = query.trim().toLowerCase();
  const posts = mockPosts.filter((p) => p.title.toLowerCase().includes(q));
  const offers = mockOffers.filter(
    (o) => o.title.toLowerCase().includes(q) || o.businessName.toLowerCase().includes(q),
  );

  const showVenues = filter === 'all' || filter === 'venues';
  const showPosts = filter === 'all' || filter === 'posts';
  const showOffers = filter === 'all' || filter === 'offers';
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

        {hasResults ? (
          <>
            {showVenues && venues.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>VENUES</Text>
                {venues.map((venue) => (
                  <Card key={venue.id} style={styles.resultCard}>
                    <Text style={styles.resultTitle}>{venue.name}</Text>
                    <Text style={styles.resultMeta}>
                      {venue.category} · {venue.area} · {venue.distanceKm.toFixed(1)} KM
                    </Text>
                  </Card>
                ))}
              </>
            ) : null}

            {showPosts && posts.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>POSTS</Text>
                {posts.map((post) => (
                  <Card key={post.id} style={styles.resultCard}>
                    <Text style={styles.resultTitle}>{post.title}</Text>
                    <Text style={styles.resultMeta}>
                      {post.authorName} · {post.startsAt}
                    </Text>
                  </Card>
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
