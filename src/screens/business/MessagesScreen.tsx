import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';

export function MessagesScreen() {
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>MESSAGES</Text>
        <Text style={styles.caption}>CUSTOMER CONVERSATIONS</Text>

        <EmptyState
          title="No conversations yet"
          hint="Messages with customers appear here once bookings are confirmed."
        />

        <Card style={styles.teaser}>
          <Text style={styles.teaserTitle}>CHAT · MILESTONE 3</Text>
          <Text style={styles.teaserHint}>
            Real-time chat with customers ships in milestone 3. Booking confirmations will open
            threads automatically.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  caption: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  teaser: { opacity: 0.55, marginTop: spacing.sm, borderStyle: 'dashed' },
  teaserTitle: { ...typography.label, color: colors.textDim },
  teaserHint: { ...typography.bodySmall, color: colors.textFaint, marginTop: spacing.xs },
});
