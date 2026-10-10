import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { PersonalTabNav } from '../../navigation/types';
import { listPosts, subscribeToPosts } from '../../services/posts';
import {
  approveRequest,
  cancelParticipation,
  declineRequest,
  listMyRequests,
  listRequestsForPost,
  withdrawRequest,
} from '../../services/joinRequests';
import { NeedPost, JoinRequest } from '../../services/mappers';

type IncomingItem = { post: NeedPost; requests: JoinRequest[] };

/**
 * Activity: my join requests (status) + incoming requests on my posts
 * (host approve/decline). Realtime-synced across devices.
 */
export function ActivityScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<PersonalTabNav>();
  const myId = profile?.id;

  const [mine, setMine] = useState<(JoinRequest & { postTitle: string })[]>([]);
  const [incoming, setIncoming] = useState<IncomingItem[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!myId) {
      setState('ready');
      return;
    }
    setState('loading');
    try {
      const [myReqs, myPosts] = await Promise.all([
        listMyRequests(myId),
        listPosts({ authorId: myId, status: 'all' }),
      ]);
      setMine(myReqs);
      const items: IncomingItem[] = [];
      for (const post of myPosts) {
        const reqs = await listRequestsForPost(post.id);
        if (reqs.length > 0) items.push({ post, requests: reqs });
      }
      setIncoming(items);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [myId]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => subscribeToPosts(() => load()), [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert('Hmm', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const statusTone = (s: JoinRequest['status']) =>
    s === 'approved' ? 'green' : s === 'pending' ? 'neutral' : 'red';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>ACTIVITY</Text>

        {state === 'loading' ? (
          <Text style={styles.status}>LOADING…</Text>
        ) : state === 'error' ? (
          <View>
            <EmptyState title="Couldn't load activity" hint="Check your connection and retry." />
            <Button title="RETRY" onPress={() => load()} />
          </View>
        ) : (
          <>
            {incoming.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>INCOMING REQUESTS</Text>
                {incoming.map(({ post, requests }) => (
                  <View key={post.id} style={styles.group}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate('PostDetails', { postId: post.id })}
                    >
                      <Text style={styles.groupTitle}>{post.title}</Text>
                    </TouchableOpacity>
                    {requests
                      .filter((r) => r.status === 'pending')
                      .map((r) => (
                        <Card key={r.id} style={styles.reqCard}>
                          <View style={styles.reqRow}>
                            <Avatar name={r.requesterName} size={28} />
                            <Text style={styles.reqName}>{r.requesterName}</Text>
                          </View>
                          <View style={styles.reqActions}>
                            <Button
                              title="DECLINE"
                              variant="ghost"
                              loading={busy === `d${r.id}`}
                              onPress={() => run(`d${r.id}`, () => declineRequest(r.id))}
                            />
                            <View style={styles.reqGap} />
                            <Button
                              title="APPROVE"
                              loading={busy === `a${r.id}`}
                              onPress={() => run(`a${r.id}`, () => approveRequest(r.id).then(() => {}))}
                            />
                          </View>
                        </Card>
                      ))}
                  </View>
                ))}
              </>
            )}

            <Text style={styles.sectionLabel}>MY REQUESTS</Text>
            {mine.length === 0 ? (
              <EmptyState title="No requests yet" hint="Find a post and request to join." />
            ) : (
              mine.map((r) => (
                <Card key={r.id} style={styles.row}>
                  <View style={styles.rowTop}>
                    <Text style={styles.postTitle}>{r.postTitle}</Text>
                    <Badge label={r.status.toUpperCase()} tone={statusTone(r.status)} />
                  </View>
                  <View style={styles.rowActions}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('PostDetails', { postId: r.postId })}
                    >
                      <Text style={styles.viewPost}>VIEW POST →</Text>
                    </TouchableOpacity>
                    {r.status === 'pending' && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => run(`w${r.id}`, () => withdrawRequest(r.id))}
                      >
                        <Text style={styles.withdraw}>{busy === `w${r.id}` ? '…' : 'WITHDRAW'}</Text>
                      </TouchableOpacity>
                    )}
                    {r.status === 'approved' && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => run(`l${r.id}`, () => cancelParticipation(r.id))}
                      >
                        <Text style={styles.withdraw}>{busy === `l${r.id}` ? '…' : 'LEAVE'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.md },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  sectionLabel: { ...typography.label, color: colors.textDim, marginTop: spacing.lg, marginBottom: spacing.sm },
  group: { marginBottom: spacing.md },
  groupTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.sm },
  reqCard: { marginBottom: spacing.sm },
  reqRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  reqName: { ...typography.body, color: colors.text, marginLeft: spacing.sm },
  reqActions: { flexDirection: 'row' },
  reqGap: { width: spacing.sm },
  row: { marginBottom: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  postTitle: { ...typography.body, color: colors.text, flex: 1 },
  rowActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  viewPost: { ...typography.label, color: colors.textDim },
  withdraw: { ...typography.label, color: colors.red },
});
