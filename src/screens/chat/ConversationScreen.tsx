import React, { useCallback, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { colors, typography, spacing } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import {
  listMessages,
  sendMessage,
  markConversationRead,
  subscribeToConversation,
} from "../../services/chat";
import { mergeMessages } from "../../utils/chatMessages";
import { ChatMessage } from "../../services/mappers";

type Props = {
  route: { params: { conversationId: string; title?: string } };
  navigation: { goBack: () => void };
};

function Bubble({ msg }: { msg: ChatMessage }) {
  return (
    <View style={[styles.bubbleRow, msg.mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, msg.mine && styles.bubbleMine]}>
        <Text style={[styles.body, msg.mine && styles.bodyMine]}>
          {msg.body}
        </Text>
        <Text style={[styles.time, msg.mine && styles.timeMine]}>
          {new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
}

/** 1:1 conversation. Text-only, realtime, server-authorized membership. */
export function ConversationScreen({ route, navigation }: Props) {
  const { conversationId, title } = route.params;
  const { profile } = useAuth();
  const myId = profile?.id ?? "";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const focused = useRef(false);
  const generation = useRef(0);
  const room = useRef("");
  room.current = `${conversationId}:${myId}`;
  const stickToBottom = useRef(true);
  const isForeground = () =>
    AppState.currentState !== "background" &&
    AppState.currentState !== "inactive";
  const load = useCallback(async () => {
    if (!isForeground()) return;
    const ticket = ++generation.current;
    try {
      const msgs = await listMessages(conversationId, myId);
      if (!focused.current || ticket !== generation.current) return;
      setMessages((previous) => mergeMessages(previous, msgs));
      setState("ready");
      // Only acknowledge the messages in this displayed snapshot.
      void markConversationRead(
        conversationId,
        msgs[msgs.length - 1]?.id,
      ).catch(() => {});
    } catch {
      if (focused.current && ticket === generation.current) setState("error");
    }
  }, [conversationId, myId]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setDraft("");
      setSending(false);
      stickToBottom.current = true;
      setMessages([]);
      setState("loading");
      const unsubscribe = subscribeToConversation(
        conversationId,
        () => void load(),
      );
      void load();
      const app = AppState.addEventListener("change", (state) => {
        if (state === "active") void load();
      });
      const timer = setInterval(() => void load(), 30_000);
      return () => {
        app.remove();
        clearInterval(timer);
        focused.current = false;
        ++generation.current;
        unsubscribe();
      };
    }, [conversationId, load]),
  );

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const sendingRoom = `${conversationId}:${myId}`;
    setSending(true);
    try {
      const msg = await sendMessage(conversationId, myId, text);
      if (room.current !== sendingRoom || !focused.current) return;
      setDraft("");
      stickToBottom.current = true;
      if (focused.current && isForeground()) {
        setMessages((prev) => mergeMessages(prev, [msg]));
        setState("ready");
        void markConversationRead(conversationId, msg.id).catch(() => {});
      }
      listRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      Alert.alert(
        "Could not send",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      if (room.current === sendingRoom) setSending(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.back}
        >
          <Icon name="arrow-left" size={16} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.heading}>
          <Avatar name={title ?? "Conversation"} size={44} tone="clay" />
          <Text style={styles.title} numberOfLines={1}>
            {title ?? "Conversation"}
          </Text>
        </View>

        {state === "loading" ? (
          <Text style={styles.status}>Loading…</Text>
        ) : state === "error" ? (
          <View>
            <EmptyState
              title="Couldn’t load messages"
              hint="Check your connection and retry."
            />
            <Button title="Retry" onPress={() => void load()} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m: ChatMessage) => m.id}
            renderItem={({ item }: { item: ChatMessage }) => (
              <Bubble msg={item} />
            )}
            contentContainerStyle={styles.list}
            onScroll={({ nativeEvent }) => {
              stickToBottom.current =
                nativeEvent.contentSize.height -
                  nativeEvent.layoutMeasurement.height -
                  nativeEvent.contentOffset.y <
                120;
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (stickToBottom.current)
                listRef.current?.scrollToEnd({ animated: false });
            }}
            ListEmptyComponent={
              <EmptyState
                title="No messages yet"
                hint="Say hello — keep it about the game or booking."
              />
            }
          />
        )}

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Message"
            style={styles.input}
            placeholder="Write a message…"
            placeholderTextColor={colors.textFaint}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
            editable={!sending}
            onSubmitEditing={onSend}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{
              disabled: !draft.trim() || sending,
              busy: sending,
            }}
            style={[
              styles.send,
              (!draft.trim() || sending) && styles.sendDisabled,
            ]}
            activeOpacity={0.8}
            onPress={onSend}
            disabled={!draft.trim() || sending}
          >
            {sending ? (
              <Text style={styles.sendText}>…</Text>
            ) : (
              <Icon name="arrow-up" size={20} color={colors.onAccent} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: {
    marginBottom: spacing.sm,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
  },
  backText: { ...typography.label, color: colors.textDim },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: spacing.lg,
  },
  title: { ...typography.title, color: colors.text, flex: 1 },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  list: { paddingBottom: spacing.md, flexGrow: 1 },
  bubbleRow: { alignItems: "flex-start", marginBottom: spacing.sm },
  bubbleRowMine: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "80%",
    backgroundColor: colors.claySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderBottomLeftRadius: 3,
  },
  bubbleMine: {
    backgroundColor: colors.ink,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 3,
  },
  body: { ...typography.body, color: colors.text },
  bodyMine: { color: colors.onAccent },
  time: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: 4,
    fontSize: 11,
  },
  timeMine: { color: colors.onAccent },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    fontSize: 16,
    minHeight: 48,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 110,
    borderRadius: 24,
  },
  send: {
    borderRadius: 23,
    width: 46,
    height: 46,
    backgroundColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { ...typography.title, color: colors.white },
});
