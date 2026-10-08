import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { isSupabaseConfigured } from '../../services/supabase';

const MENU_ITEMS = ['Edit profile', 'Notifications', 'Privacy', 'Help'];

const STATS = [
  { value: '4', label: 'POSTS' },
  { value: '12', label: 'JOINED' },
  { value: '8', label: 'FOLLOWING' },
];

export function ProfileScreen() {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <Screen>
        <EmptyState title="Not signed in" hint="Log in to view your profile." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!isSupabaseConfigured ? (
          <View style={styles.mockRow}>
            <Badge label="MOCK MODE" tone="neutral" />
          </View>
        ) : null}

        <View style={styles.headerRow}>
          <Avatar name={user.displayName || 'N'} size={64} />
          <View style={styles.nameCol}>
            <Text style={styles.name}>{user.displayName}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.menu}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={() => undefined}
            >
              <Text style={styles.menuLabel}>{item}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title="LOG OUT"
          variant="danger"
          onPress={() => {
            void signOut();
          }}
          style={styles.logout}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  mockRow: { marginTop: spacing.sm, marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  nameCol: { flex: 1 },
  name: { ...typography.title, color: colors.text },
  email: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: { ...typography.title, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  menu: { marginTop: spacing.lg },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  menuLabel: { ...typography.body, color: colors.text },
  chevron: { ...typography.heading, color: colors.textDim },
  logout: { marginTop: spacing.lg },
});
