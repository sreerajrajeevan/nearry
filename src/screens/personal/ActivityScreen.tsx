import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { mockActivity } from '../../data/mock';

type ActivityItem = {
  id: string;
  text: string;
  time: string;
  unread: boolean;
};

export function ActivityScreen() {
  const [items, setItems] = useState<ActivityItem[]>(() =>
    mockActivity.map((a) => ({ ...a })),
  );

  const unreadCount = items.filter((i) => i.unread).length;

  const markAllRead = () =>
    setItems((prev) => prev.map((i) => ({ ...i, unread: false })));

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>ACTIVITY</Text>
          {unreadCount > 0 ? (
            <Button title="MARK ALL READ" variant="ghost" onPress={markAllRead} />
          ) : null}
        </View>

        {items.length > 0 ? (
          items.map((item) => (
            <Card key={item.id} style={styles.row}>
              <View style={styles.rowInner}>
                <View style={styles.dotCol}>
                  {item.unread ? <View style={styles.dot} /> : null}
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.text}>{item.text}</Text>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState title="No activity" hint="Your updates will appear here." />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  header: { ...typography.title, color: colors.text },
  row: { marginBottom: spacing.sm },
  rowInner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dotCol: { width: 12, alignItems: 'center', paddingTop: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  textCol: { flex: 1 },
  text: { ...typography.bodySmall, color: colors.text },
  time: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
});
