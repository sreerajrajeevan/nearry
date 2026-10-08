import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { mockVenues, mockOffers, NeedPost } from '../../data/mock';
import { listPosts } from '../../services/posts';
import { timeLeft, vacanciesLeft } from '../../utils/format';

export function NearbyScreen() {
  const [posts, setPosts] = useState<NeedPost[]>([]);

  useEffect(() => {
    listPosts()
      .then(setPosts)
      .catch(() => setPosts([]));
  }, []);

  const liveOffers = mockOffers.filter((o) => o.status === 'live');

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>NEARBY</Text>
        <Text style={styles.location}>KOCHI · 2 KM</Text>

        <Text style={styles.sectionLabel}>LIVE OFFERS</Text>
        {liveOffers.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.offerRow}
          >
            {liveOffers.map((offer) => (
              <Card key={offer.id} accent style={styles.offerCard}>
                <Text style={styles.offerBusiness}>{offer.businessName}</Text>
                <Text style={styles.offerTitle}>{offer.title}</Text>
                <Badge label={timeLeft(offer.endsAt)} tone="red" />
              </Card>
            ))}
          </ScrollView>
        ) : (
          <EmptyState title="No live offers" hint="Check back soon." />
        )}

        <Text style={styles.sectionLabel}>NEED PEOPLE</Text>
        {posts.length > 0 ? (
          posts.map((post) => (
            <Card key={post.id} style={styles.postCard}>
              <Text style={styles.postTitle}>{post.title}</Text>
              <View style={styles.authorRow}>
                <Avatar name={post.authorName} size={28} />
                <View style={styles.authorText}>
                  <Text style={styles.authorName}>{post.authorName}</Text>
                  <Text style={styles.startsAt}>{post.startsAt}</Text>
                </View>
              </View>
              <Text style={styles.postDesc} numberOfLines={2}>
                {post.description}
              </Text>
              <View style={styles.postFooter}>
                <Badge label={vacanciesLeft(post.vacancies, post.joinedCount)} tone="red" />
                <Text style={styles.tags}>{post.tags.map((t) => `#${t}`).join('  ')}</Text>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState title="No open posts" hint="Be the first to gather people nearby." />
        )}

        <Text style={styles.sectionLabel}>VENUES</Text>
        {mockVenues.length > 0 ? (
          mockVenues.map((venue) => (
            <View key={venue.id} style={styles.venueRow}>
              <View style={styles.venueLeft}>
                <Text style={styles.venueName}>{venue.name}</Text>
                <Text style={styles.venueMeta}>
                  {venue.category} · {venue.area}
                </Text>
                {venue.liveOffer ? (
                  <Text style={styles.venueOffer}>{venue.liveOffer}</Text>
                ) : null}
              </View>
              <View style={styles.venueRight}>
                <Text style={styles.venueRating}>★ {venue.rating.toFixed(1)}</Text>
                <Text style={styles.venueDist}>{venue.distanceKm.toFixed(1)} KM</Text>
              </View>
            </View>
          ))
        ) : (
          <EmptyState title="No venues" hint="Nothing found in this area." />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  location: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
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
  postCard: { marginBottom: spacing.sm },
  postTitle: { ...typography.heading, color: colors.text },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  authorText: { flex: 1 },
  authorName: { ...typography.bodySmall, color: colors.text },
  startsAt: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  postDesc: { ...typography.bodySmall, color: colors.textDim, marginBottom: spacing.sm },
  postFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  tags: { ...typography.caption, color: colors.textFaint, flexShrink: 1, textAlign: 'right' },
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
