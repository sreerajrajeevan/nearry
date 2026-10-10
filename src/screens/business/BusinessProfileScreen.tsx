import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { mockOffers } from '../../data/mock';
import { isSupabaseConfigured } from '../../services/supabase';

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function BusinessProfileScreen() {
  const { profile, signOut } = useAuth();
  const name = (profile?.displayName ?? 'YOUR BUSINESS').toUpperCase();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Avatar name={name} size={64} />
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.category}>CAFÉ · FORT KOCHI</Text>
          </View>
        </View>

        {!isSupabaseConfigured ? (
          <View style={styles.mockBadge}>
            <Badge label="MOCK MODE" tone="neutral" />
          </View>
        ) : null}

        <Card style={styles.infoCard}>
          <InfoRow label="ADDRESS" value="Marine Drive, Fort Kochi" />
          <InfoRow label="HOURS" value="9:00 AM – 11:00 PM" />
          <InfoRow label="PHONE" value="+91 98470 12345" last />
        </Card>

        <View style={styles.statsRow}>
          <StatBox label="RATING" value="4.6" />
          <StatBox label="OFFERS" value={String(mockOffers.length)} />
          <StatBox label="FOLLOWERS" value="1.2K" />
        </View>

        <Button
          title="LOG OUT"
          variant="danger"
          onPress={() => {
            signOut();
          }}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  nameBlock: { flex: 1 },
  name: { ...typography.title, color: colors.text },
  category: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  mockBadge: { marginTop: spacing.md, alignItems: 'flex-start' },
  infoCard: { marginTop: spacing.lg, paddingVertical: spacing.sm },
  infoRow: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  infoRowBorder: { borderBottomWidth: 1, borderColor: colors.border },
  infoLabel: { ...typography.caption, color: colors.textFaint },
  infoValue: { ...typography.body, color: colors.text, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  statValue: { ...typography.title, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textFaint, marginTop: spacing.xs },
  logoutBtn: { marginTop: spacing.xl },
});
