import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { colors, typography, spacing } from '../theme';
import { NeedPost } from '../services/mappers';
import { formatWhen } from '../utils/format';

type Props = {
  post: NeedPost;
  distanceKm?: number;
  cta?: string;
  onPress: () => void;
};

/**
 * Quiet-minimal post row (mockups v2): flat, hairline divider, no card.
 * "AR  Arjun is asking            1.2 km away
 *  Anyone for football at 8?
 *  Unity Turf · Tonight, 8 pm
 *  3 spots · ₹150 each            I'm interested ↗"
 */
export function PostRow({ post, distanceKm, cta = "I'm interested", onPress }: Props) {
  const price = post.costCents != null ? `₹${(post.costCents / 100).toFixed(0)} each` : null;
  const spots =
    post.status !== 'open' ? post.status.toUpperCase()
    : post.spotsLeft <= 0 ? 'Full'
    : `${post.spotsLeft} spot${post.spotsLeft === 1 ? '' : 's'}`;
  const metaLine = [spots, price].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.row}>
      <View style={styles.topLine}>
        <Avatar name={post.authorName} size={30} />
        <Text style={styles.asking}>{post.authorName} is asking</Text>
        {distanceKm !== undefined && (
          <Text style={styles.distance}>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm.toFixed(1)} km away`}</Text>
        )}
      </View>
      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.meta}>
        {[post.venueName, formatWhen(post.startsAt)].filter(Boolean).join(' · ')}
      </Text>
      <View style={styles.bottomLine}>
        <Text style={styles.spots}>{metaLine}</Text>
        <Text style={styles.cta}>{cta} ↗</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  asking: { ...typography.body, color: colors.text, flex: 1 },
  distance: { ...typography.bodySmall, color: colors.muted },
  title: { ...typography.title, fontSize: 26, color: colors.text, marginTop: spacing.sm },
  meta: { ...typography.body, color: colors.muted, marginTop: spacing.xs },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  spots: { ...typography.body, color: colors.text },
  cta: { ...typography.body, color: colors.clay, fontWeight: '600' },
});
