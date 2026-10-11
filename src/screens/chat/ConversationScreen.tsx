import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import {
  listMessages,
  sendMessage,
  markConversationRead,
  subscribeToConversation,
} from '../../services/chat';
import { ChatMessage } from '../../services/mappers';

type Props = {
  route: { params: { conversationId: string; title?: string } };
  navigation: { goBack: () => void };
};

function Bubble({ msg }: { msg: ChatMessage }) {
  return (
    <View style={[styles.bubbleRow, msg.mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, msg.mine && styles.bubbleMine]}>
        <Text style={[styles.body, msg.mine && styles.bodyMine]}>{msg.body}</Text>
        <Text style={[styles.time, msg.mine && styles.timeMine]}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

/** 1:1 conversation. Text-only, realtime, server-authorized membership. */
export function ConversationScreen({ route, navigation }: Props) {
  const { conversationId, title } = route.params;
  const { profile } = useAuth();
  const myId = profile?.id ?? '';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [sending, setSending] = useState(false);
  const listRef = useRef<{ scrollToEnd: (o: { animated?: boolean }) => void } | null>(null);

  const load = useCallback(async () => {
    try {
      const msgs = await listMessages(conversationId, myId);
      setMessages(msgs);
      setState('ready');
      void markConversationRead(conversationId).catch(() => {});
    } catch {
      setState('error');
    }
  }, [conversationId, myId]);

  useEffect(() => {
    void load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => subscribeToConversation(conversationId, () => void load()), [conversationId, load]);

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(conversationId, myId, text);
      setDraft('');
      setMessages((prev) => [...prev, msg]);
      listRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.back}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {(title ?? 'CHAT').toUpperCase()}
        </Text>

        {state === 'loading' ? (
          <Text style={styles.status}>LOADING…</Text>
        ) : state === 'error' ? (
          <EmptyState title="Couldn't load messages" hint="Check your connection and retry." />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m: ChatMessage) => m.id}
            renderItem={({ item }: { item: ChatMessage }) => <Bubble msg={item} />}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <EmptyState title="No messages yet" hint="Say hello — keep it about the game or booking." />
            }
          />
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor={colors.textFaint}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
            editable={!sending}
            onSubmitEditing={onSend}
          />
          <TouchableOpacity
            style={[styles.send, (!draft.trim() || sending) && styles.sendDisabled]}
            activeOpacity={0.8}
            onPress={onSend}
            disabled={!draft.trim() || sending}
          >
            <Text style={styles.sendText}>{sending ? '…' : '↑'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { marginBottom: spacing.sm, alignSelf: 'flex-start' },
  backText: { ...typography.label, color: colors.textDim },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.md },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  list: { paddingBottom: spacing.md, flexGrow: 1 },
  bubbleRow: { alignItems: 'flex-start', marginBottom: spacing.sm },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: { backgroundColor: colors.red, borderColor: colors.red },
  body: { ...typography.body, color: colors.text },
  bodyMine: { color: colors.white },
  time: { ...typography.caption, color: colors.textFaint, marginTop: 4, fontSize: 10 },
  timeMine: { color: 'rgba(255,255,255,0.7)' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 110,
  },
  send: {
    width: 46,
    height: 46,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { ...typography.title, color: colors.white },
});
