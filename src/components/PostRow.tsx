import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from './Card';
import { Badge } from './Badge';
import { Avatar } from './Avatar';
import { colors, typography, spacing } from '../theme';
import { NeedPost } from '../services/mappers';
import { vacanciesLeft } from '../utils/format';

type Props = {
  post: NeedPost;
  onPress: () => void;
};

/** Shared Need-People post row: title, author, time, vacancy badge. */
export function PostRow({ post, onPress }: Props) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Card style={styles.card}>
        <Text style={styles.title}>{post.title}</Text>
        <View style={styles.authorRow}>
          <Avatar name={post.authorName} size={28} />
          <View style={styles.authorText}>
            <Text style={styles.authorName}>{post.authorName}</Text>
            <Text style={styles.meta}>{post.startsAt}</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <Badge
            label={post.status === 'open' ? vacanciesLeft(post.vacancies, post.joinedCount) : post.status.toUpperCase()}
            tone={post.status === 'open' && post.spotsLeft > 0 ? 'green' : 'red'}
          />
          {post.venueName && <Text style={styles.venue}>{post.venueName.toUpperCase()}</Text>}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  authorText: { marginLeft: spacing.sm },
  authorName: { ...typography.body, color: colors.text },
  meta: { ...typography.caption, color: colors.textDim },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  venue: { ...typography.caption, color: colors.textFaint },
});
