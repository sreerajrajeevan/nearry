import { LoadingState } from "../../components/LoadingState";
import { ConversationActions } from "../../components/ConversationActions";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { conversationSafety, ConversationSafety } from "../../services/safety";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
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
  navigation: {
    goBack: () => void;
    navigate: (
      screen: "Report",
      params: { target: import("../../services/safety").ReportTarget },
    ) => void;
  };
};

function Bubble({
  msg,
  onReport,
}: {
  msg: ChatMessage;
  onReport?: () => void;
}) {
  return (
    <View style={[styles.bubbleRow, msg.mine && styles.bubbleRowMine]}>
      <TouchableOpacity
        activeOpacity={0.95}
        onLongPress={onReport}
        accessibilityRole={onReport ? "button" : undefined}
        accessibilityLabel={
          onReport ? `${msg.body}. Hold to report message` : undefined
        }
        style={[styles.bubble, msg.mine && styles.bubbleMine]}
      >
        <Text style={[styles.body, msg.mine && styles.bodyMine]}>
          {msg.body}
        </Text>
        <Text style={[styles.time, msg.mine && styles.timeMine]}>
          {new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** 1:1 conversation. Text-only, realtime, server-authorized membership. */
export function ConversationScreen({ route, navigation }: Props) {
  const { conversationId, title } = route.params;
  const { profile } = useAuth();
  const myId = profile?.id ?? "";
  const [peer, setPeer] = useState<ConversationSafety | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [sending, setSending] = useState(false);
  const sendingLock = useRef<string | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const [sendError, setSendError] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  const focused = useRef(false);
  const generation = useRef(0);
  const visit = useRef(0);
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
      const [msgs, safety] = await Promise.all([
        listMessages(conversationId, myId),
        conversationSafety(conversationId),
      ]);
      if (!focused.current || ticket !== generation.current) return;
      setPeer(safety);
      // Use the authoritative snapshot: a clear on another device must remove old bubbles.
      setMessages(msgs);
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
      ++visit.current;
      setDraft("");
      setSending(false);
      setPeer(null);
      setSendError("");
      setActionsOpen(false);
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
        ++visit.current;
        ++generation.current;
        unsubscribe();
      };
    }, [conversationId, load]),
  );

  const onSend = async () => {
    const sentDraft = draft;
    const text = sentDraft.trim();
    if (!text || sendingLock.current === room.current || !peer?.canMessage)
      return;
    const sendingRoom = `${conversationId}:${myId}`;
    const sendingVisit = visit.current;
    sendingLock.current = sendingRoom;
    setSendError("");
    setSending(true);
    try {
      const msg = await sendMessage(conversationId, myId, text);
      if (
        room.current !== sendingRoom ||
        visit.current !== sendingVisit ||
        !focused.current
      )
        return;
      ++generation.current; // Discard a reload started before this send committed.
      // Keep anything typed while the send was in flight.
      setDraft((current) => (current === sentDraft ? "" : current));
      stickToBottom.current = true;
      if (focused.current && isForeground()) {
        setMessages((prev) => mergeMessages(prev, [msg]));
        setState("ready");
        void markConversationRead(conversationId, msg.id).catch(() => {});
      }
      listRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      if (
        room.current === sendingRoom &&
        visit.current === sendingVisit &&
        focused.current
      )
        setSendError(
          e instanceof Error ? e.message : "Could not send. Please try again.",
        );
    } finally {
      if (sendingLock.current === sendingRoom) sendingLock.current = null;
      if (
        room.current === sendingRoom &&
        visit.current === sendingVisit &&
        focused.current
      ) {
        setSending(false);
        if (Platform.OS === "web" || Keyboard.isVisible())
          inputRef.current?.focus();
      }
    }
  };

  return (
    // The keyboard owner fills the window, outside safe-area padding. Android
    // edge-to-edge does not resize this window; an undefined behavior covers the input.
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <SafeAreaView style={styles.flex} edges={["top", "left", "right"]}>
        <View style={styles.heading}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={styles.iconButton}
          >
            <Icon name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Avatar
            name={peer?.name ?? title ?? "Conversation"}
            size={40}
            tone="clay"
          />
          <View style={styles.headingText}>
            <Text style={styles.title} numberOfLines={1}>
              {peer?.name ?? title ?? "Conversation"}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              About your plans & bookings
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Conversation options"
            onPress={() => {
              Keyboard.dismiss();
              setActionsOpen(true);
            }}
            style={styles.iconButton}
          >
            <Icon name="more-vertical" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        {peer && !peer.canMessage && (
          <Text style={styles.status}>
            Messaging is unavailable because an account is blocked or inactive.
            Manage your blocks in Safety & privacy.
          </Text>
        )}
        <View style={styles.transcript}>
          {state === "loading" ? (
            <LoadingState label="Loading messages…" layout="list" />
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
              style={styles.flex}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              onLayout={() => {
                if (stickToBottom.current)
                  listRef.current?.scrollToEnd({ animated: false });
              }}
              data={messages}
              keyExtractor={(m: ChatMessage) => m.id}
              renderItem={({ item }: { item: ChatMessage }) => (
                <Bubble
                  msg={item}
                  onReport={
                    item.mine
                      ? undefined
                      : () =>
                          navigation.navigate("Report", {
                            target: {
                              kind: "message",
                              id: item.id,
                              name: "Message",
                            },
                          })
                  }
                />
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
        </View>
        {!!sendError && (
          <Text
            accessibilityRole="alert"
            numberOfLines={3}
            style={styles.sendError}
          >
            {sendError} Your message is still here; tap Send to retry.
          </Text>
        )}
        <View
          style={[
            styles.composer,
            {
              paddingBottom: keyboardOpen
                ? spacing.sm
                : Math.max(insets.bottom, spacing.sm),
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            accessibilityLabel="Message"
            style={styles.input}
            placeholder="Write a message…"
            placeholderTextColor={colors.textFaint}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
            editable={!!peer?.canMessage}
            // Enter inserts a newline; sending is always an explicit tap.
            submitBehavior="newline"
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{
              disabled: !draft.trim() || sending || !peer?.canMessage,
              busy: sending,
            }}
            style={[
              styles.send,
              (!draft.trim() || sending || !peer?.canMessage) &&
                styles.sendDisabled,
            ]}
            activeOpacity={0.8}
            onPress={onSend}
            disabled={!draft.trim() || sending || !peer?.canMessage}
          >
            {sending ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <Icon name="arrow-up" size={20} color={colors.onAccent} />
            )}
          </TouchableOpacity>
        </View>
        {actionsOpen && (
          <ConversationActions
            conversationId={conversationId}
            name={peer?.name ?? title ?? "this person"}
            otherUserId={peer?.userId}
            onClose={() => setActionsOpen(false)}
            onReport={() => {
              setActionsOpen(false);
              navigation.navigate("Report", {
                target: {
                  kind: "conversation",
                  id: conversationId,
                  name: title ?? peer?.name ?? "Conversation",
                },
              });
            }}
            onChanged={() => navigation.goBack()}
          />
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: 0, backgroundColor: colors.background },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
    flexShrink: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headingText: { flex: 1, minWidth: 0 },
  title: { ...typography.heading, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  status: {
    ...typography.bodySmall,
    color: colors.textDim,
    padding: spacing.sm,
  },
  transcript: { flex: 1, minHeight: 0, overflow: "hidden" },
  list: { padding: spacing.md, flexGrow: 1, justifyContent: "flex-end" },
  sendError: {
    ...typography.bodySmall,
    color: colors.red,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
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
    flexShrink: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    fontSize: 16,
    minHeight: 48,
    minWidth: 0,
    backgroundColor: colors.background,
    textAlignVertical: "top",
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
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { ...typography.title, color: colors.white },
});
