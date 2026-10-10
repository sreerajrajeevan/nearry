import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';
import { colors, typography, spacing } from '../../theme';
import { PostDetailsProps } from '../../navigation/types';
import { useAuth } from '../../store/AuthContext';
import { getPost, cancelPost, subscribeToPosts } from '../../services/posts';
import {
  approveRequest,
  cancelParticipation,
  declineRequest,
  listRequestsForPost,
  myRequestForPost,
  requestToJoin,
  withdrawRequest,
} from '../../services/joinRequests';
import { NeedPost } from '../../services/mappers';
import { JoinRequest } from '../../services/mappers';
import { timeLeft, vacanciesLeft } from '../../utils/format';

/**
 * Post details: host manages requests, participants request/withdraw.
 * Realtime subscription keeps every device in sync.
 */
export function PostDetailsScreen({ route, navigation }: PostDetailsProps) {
  const { postId } = route.params;
  const { profile } = useAuth();
  const myId = profile?.id;

  const [post, setPost] = useState<NeedPost | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [myRequest, setMyRequest] = useState<JoinRequest | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMsg('');
    try {
      const p = await getPost(postId);
      if (!p) throw new Error('Post not found.');
      setPost(p);
      const [reqs, mine] = await Promise.all([
        listRequestsForPost(postId),
        myId ? myRequestForPost(postId, myId) : Promise.resolve(null),
      ]);
      setRequests(reqs);
      setMyRequest(mine);
      setState('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Could not load this post.');
      setState('error');
    }
  }, [postId, myId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when returning to the screen, and live via realtime.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => subscribeToPosts(load), [load]);

  const isHost = !!myId && post?.authorId === myId;
  const pending = requests.filter((r) => r.status === 'pending');
  const approved = requests.filter((r) => r.status === 'approved');

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

  const onCancelPost = () => {
    Alert.alert(
      'Cancel this post?',
      'Approved participants will see it as cancelled. This cannot be undone.',
      [
        { text: 'KEEP IT', style: 'cancel' },
        { text: 'CANCEL POST', style: 'destructive', onPress: () => run('cancel', () => cancelPost(postId)) },
      ],
    );
  };

  if (state === 'loading') {
    return (
      <Screen padded>
        <Text style={styles.status}>LOADING…</Text>
      </Screen>
    );
  }
  if (state === 'error' || !post) {
    return (
      <Screen padded>
        <EmptyState title="Couldn't load this post" hint={errorMsg} />
        <Button title="RETRY" onPress={load} />
        <View style={styles.gap} />
        <Button title="GO BACK" variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const spotsBadge =
    post.status === 'open' ? vacanciesLeft(post.vacancies, post.joinedCount) : post.status.toUpperCase();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.back}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{post.title}</Text>
          <Badge label={spotsBadge} tone={post.status === 'open' && post.spotsLeft > 0 ? 'green' : 'red'} />
        </View>
        <View style={styles.authorRow}>
          <Avatar name={post.authorName} size={28} />
          <Text style={styles.authorName}>{post.authorName}</Text>
          {post.venueName && <Text style={styles.meta}> · {post.venueName}</Text>}
        </View>
        <Text style={styles.meta}>{post.startsAt}</Text>
        {post.expiresAt && <Text style={styles.meta}>Requests close {timeLeft(post.expiresAt)}</Text>}
        <Text style={styles.desc}>{post.description}</Text>
        {post.tags.length > 0 && (
          <View style={styles.tags}>
            {post.tags.map((t) => (
              <Badge key={t} label={t.toUpperCase()} />
            ))}
          </View>
        )}

        {isHost ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              REQUESTS · {pending.length} PENDING · {approved.length} IN
            </Text>
            {pending.length === 0 && approved.length === 0 && (
              <EmptyState title="No requests yet" hint="Share this post to fill the spots." />
            )}
            {pending.map((r) => (
              <Card key={r.id} style={styles.reqCard}>
                <View style={styles.reqRow}>
                  <Avatar name={r.requesterName} size={32} />
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
            {approved.map((r) => (
              <View key={r.id} style={styles.approvedRow}>
                <Avatar name={r.requesterName} size={24} />
                <Text style={styles.approvedName}>{r.requesterName}</Text>
                <Badge label="IN" tone="green" />
              </View>
            ))}
            {post.status === 'open' && (
              <View style={styles.hostActions}>
                <Button
                  title="EDIT POST"
                  variant="secondary"
                  onPress={() => navigation.navigate('EditPost', { postId: post.id })}
                />
                <View style={styles.gap} />
                <Button title="CANCEL POST" variant="danger" loading={busy === 'cancel'} onPress={onCancelPost} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            {post.status !== 'open' ? (
              <EmptyState title={`This post is ${post.status}`} hint="Keep an eye out for the next one." />
            ) : !myRequest || myRequest.status === 'declined' || myRequest.status === 'withdrawn' ? (
              <Button
                title="REQUEST TO JOIN"
                loading={busy === 'join'}
                onPress={() => myId && run('join', () => requestToJoin(postId, myId).then(() => {}))}
              />
            ) : myRequest.status === 'pending' ? (
              <>
                <Badge label="REQUEST PENDING" tone="neutral" />
                <View style={styles.gap} />
                <Button
                  title="WITHDRAW REQUEST"
                  variant="ghost"
                  loading={busy === 'wd'}
                  onPress={() => run('wd', () => withdrawRequest(myRequest.id))}
                />
              </>
            ) : (
              <>
                <Badge label="YOU'RE IN" tone="green" />
                <View style={styles.gap} />
                <Button
                  title="LEAVE ACTIVITY"
                  variant="danger"
                  loading={busy === 'lv'}
                  onPress={() => run('lv', () => cancelParticipation(myRequest.id))}
                />
              </>
            )}
          </View>
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
  authorRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  authorName: { ...typography.body, color: colors.text, marginLeft: spacing.sm },
  meta: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  desc: { ...typography.body, color: colors.text, marginTop: spacing.lg, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  section: { marginTop: spacing.xl },
  sectionTitle: { ...typography.label, color: colors.textDim, marginBottom: spacing.md },
  reqCard: { marginBottom: spacing.md },
  reqRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  reqName: { ...typography.body, color: colors.text, marginLeft: spacing.sm },
  reqActions: { flexDirection: 'row' },
  reqGap: { width: spacing.sm },
  approvedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  approvedName: { ...typography.body, color: colors.text, flex: 1 },
  hostActions: { marginTop: spacing.lg },
  gap: { height: spacing.md },
});
