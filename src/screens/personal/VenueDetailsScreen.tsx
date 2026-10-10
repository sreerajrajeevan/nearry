import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { VenueDetailsProps } from '../../navigation/types';
import { getVenue } from '../../services/venues';
import { listPosts } from '../../services/posts';
import { Venue, NeedPost } from '../../services/mappers';
import { vacanciesLeft } from '../../utils/format';

/** Venue details + open posts at this venue. */
export function VenueDetailsScreen({ route, navigation }: VenueDetailsProps) {
  const { venueId } = route.params;
  const [venue, setVenue] = useState<Venue | null>(null);
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const v = await getVenue(venueId);
      if (!v) throw new Error('Venue not found.');
      setVenue(v);
      const all = await listPosts({ status: 'open' });
      setPosts(all.filter((p) => p.venueId === venueId || p.venueName === v.name));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [venueId]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (state === 'loading') {
    return (
      <Screen padded>
        <Text style={styles.status}>LOADING…</Text>
      </Screen>
    );
  }
  if (state === 'error' || !venue) {
    return (
      <Screen padded>
        <EmptyState title="Couldn't load this venue" hint="Check your connection and retry." />
        <Button title="RETRY" onPress={load} />
        <View style={styles.gap} />
        <Button title="GO BACK" variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.back}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.title}>{venue.name}</Text>
          <Badge label={venue.openNow ? 'OPEN NOW' : 'CLOSED'} tone={venue.openNow ? 'green' : 'red'} />
        </View>
        <Text style={styles.meta}>
          {venue.category.toUpperCase()} · {venue.area.toUpperCase()}
        </Text>
        <Text style={styles.meta}>★ {venue.rating.toFixed(1)}</Text>

        <Text style={styles.sectionTitle}>HAPPENING HERE · {posts.length}</Text>
        {posts.length === 0 ? (
          <EmptyState title="Nothing scheduled here" hint="Be the first to post an activity." />
        ) : (
          posts.map((p) => (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('PostDetails', { postId: p.id })}
            >
              <Card style={styles.postCard}>
                <Text style={styles.postTitle}>{p.title}</Text>
                <Text style={styles.postMeta}>
                  {p.startsAt} · {p.authorName}
                </Text>
                <Badge label={vacanciesLeft(p.vacancies, p.joinedCount)} tone={p.spotsLeft > 0 ? 'green' : 'red'} />
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  back: { marginBottom: spacing.md, alignSelf: 'flex-start' },
  backText: { ...typography.label, color: colors.textDim },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  title: { ...typography.h1, color: colors.text, flex: 1 },
  meta: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.textDim, marginTop: spacing.xl, marginBottom: spacing.md },
  postCard: { marginBottom: spacing.md },
  postTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  postMeta: { ...typography.caption, color: colors.textDim, marginBottom: spacing.sm },
  gap: { height: spacing.md },
});
