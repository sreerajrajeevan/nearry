import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { Input } from '../../components/Input';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import {
  getVerificationState,
  submitVerificationDoc,
  claimVenue,
  VerificationState,
} from '../../services/verification';
import { searchVenues, listVenues } from '../../services/venues';
import { Venue } from '../../services/mappers';
import { isDemoMode } from '../../services/supabase';

const STATUS_COPY: Record<VerificationState, string> = {
  unverified: 'Not verified. Submit a business document to get reviewed.',
  pending: 'Under review. You can publish once approved.',
  verified: 'Verified. Your offers can go live.',
  rejected: 'Not approved. Submit a clearer document to try again.',
};

function statusTone(s: VerificationState): 'neutral' | 'green' | 'red' {
  if (s === 'verified') return 'green';
  if (s === 'pending') return 'neutral';
  return 'red';
}

/** Business profile: verification, venue association, sign out. */
export function BusinessProfileScreen() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [verif, setVerif] = useState<{ status: VerificationState; docPath?: string }>({
    status: 'unverified',
  });
  const [venue, setVenue] = useState<Venue | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Venue[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile || isDemoMode()) return;
    try {
      setVerif(await getVerificationState(profile.id));
      const venues = await listVenues();
      setVenue(venues.find((v) => v.businessId === profile.id) ?? null);
    } catch {
      /* keep last known */
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setResults((await searchVenues(q)).filter((v) => !v.businessId).slice(0, 5));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const name = (profile?.businessName ?? profile?.displayName ?? 'YOUR BUSINESS').toUpperCase();
  const details = (profile?.businessDetails ?? {}) as { category?: string; area?: string };
  const category = (details.category ?? profile?.businessDetails?.toString() ?? '').toString().toUpperCase();

  const onSubmitDoc = async () => {
    if (!profile) return;
    setBusy('doc');
    try {
      await submitVerificationDoc(profile.id);
      await refreshProfile();
      await load();
      Alert.alert('Submitted', 'Your documents are under review.');
    } catch (e) {
      Alert.alert('Could not submit', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onClaim = async (v: Venue) => {
    setBusy(`claim-${v.id}`);
    try {
      await claimVenue(v.id);
      setQuery('');
      setResults([]);
      await load();
    } catch (e) {
      Alert.alert('Could not claim', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Avatar name={name} size={64} />
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.category}>
              {[category, details.area?.toUpperCase()].filter(Boolean).join(' · ') || 'BUSINESS'}
            </Text>
          </View>
        </View>

        {isDemoMode() && (
          <View style={styles.demoRow}>
            <Badge label="DEMO MODE" tone="red" />
          </View>
        )}

        <Text style={styles.sectionTitle}>VERIFICATION</Text>
        <Card style={styles.verifyCard} accent={verif.status !== 'verified'}>
          <View style={styles.verifyRow}>
            <Text style={styles.verifyTitle}>BUSINESS VERIFICATION</Text>
            <Badge label={verif.status.toUpperCase()} tone={statusTone(verif.status)} />
          </View>
          <Text style={styles.verifyDesc}>{STATUS_COPY[verif.status]}</Text>
          {(verif.status === 'unverified' || verif.status === 'rejected') && !isDemoMode() && (
            <Button
              title="SUBMIT DOCUMENT"
              variant="secondary"
              loading={busy === 'doc'}
              onPress={onSubmitDoc}
              style={styles.verifyBtn}
            />
          )}
        </Card>

        <Text style={styles.sectionTitle}>MY VENUE</Text>
        {venue ? (
          <Card>
            <Text style={styles.venueName}>{venue.name}</Text>
            <Text style={styles.venueMeta}>
              {venue.category} · {venue.area}
            </Text>
          </Card>
        ) : (
          <>
            <Text style={styles.venueHint}>Claim your venue so customers can find you.</Text>
            <Input label="" placeholder="Search venues to claim…" value={query} onChangeText={setQuery} />
            {results.map((v) => (
              <View key={v.id} style={styles.claimRow}>
                <View style={styles.claimText}>
                  <Text style={styles.venueName}>{v.name}</Text>
                  <Text style={styles.venueMeta}>
                    {v.category} · {v.area}
                  </Text>
                </View>
                <Button
                  title="CLAIM"
                  variant="secondary"
                  loading={busy === `claim-${v.id}`}
                  onPress={() => onClaim(v)}
                />
              </View>
            ))}
          </>
        )}

        <Button
          title="LOG OUT"
          variant="danger"
          onPress={() => {
            void signOut();
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
  demoRow: { marginTop: spacing.md, alignItems: 'flex-start' },
  sectionTitle: { ...typography.label, color: colors.textDim, marginTop: spacing.xl, marginBottom: spacing.sm },
  verifyCard: {},
  verifyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  verifyTitle: { ...typography.label, color: colors.text },
  verifyDesc: { ...typography.bodySmall, color: colors.textDim, marginTop: spacing.sm },
  verifyBtn: { marginTop: spacing.md },
  venueHint: { ...typography.bodySmall, color: colors.textDim, marginBottom: spacing.sm },
  venueName: { ...typography.heading, color: colors.text },
  venueMeta: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  claimText: { flex: 1 },
  logoutBtn: { marginTop: spacing.xl },
});
