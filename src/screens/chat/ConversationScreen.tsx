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
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ChatAvatar } from "../../components/ChatAvatar";
import { chatIdentity } from "../../utils/chatIdentity";
import { Icon } from "../../components/Icon";
import { colors, typography, spacing, weight } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import {
  listMessagesPage,
  sendMessage,
  markConversationRead,
  subscribeToConversation,
} from "../../services/chat";
import * as Crypto from "expo-crypto";
import { Cursor } from "../../utils/pagination";
import { setActiveChat } from "../../services/activeChat";
import { mergeMessages } from "../../utils/chatMessages";
import { buildTimeline, type TimelineItem } from "../../utils/chatTimeline";
import {
  ChatComposer,
  chatColors,
  DayChip,
  EventLine,
  MessageRow,
} from "../../components/chat/ChatParts";
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

/** 1:1 conversation. Text-only, realtime, server-authorized membership. */
export function ConversationScreen({ route, navigation }: Props) {
  const { conversationId, title } = route.params;
  const { profile } = useAuth();
  const myId = profile?.id ?? "";
  const [peer, setPeer] = useState<ConversationSafety | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<Cursor | null>(null),
    [olderBusy, setOlderBusy] = useState(false),
    [olderError, setOlderError] = useState("");
  const clearBoundary = useRef<string | null>(null),
    messagesRef = useRef<ChatMessage[]>([]),
    olderLock = useRef(false);
  messagesRef.current = messages;
  const retry = useRef<{ room: string; body: string; key: string } | null>(
    null,
  );
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
  const listRef = useRef<FlatList<TimelineItem<ChatMessage>> | null>(null);

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
        listMessagesPage(conversationId, myId),
        conversationSafety(conversationId),
      ]);
      if (!focused.current || ticket !== generation.current) return;
      setPeer(safety);
      const sameBoundary = clearBoundary.current === msgs.clearedAt;
      clearBoundary.current = msgs.clearedAt;
      setMessages((previous) =>
        sameBoundary ? mergeMessages(previous, msgs.items) : msgs.items,
      );
      setOlderCursor((old) =>
        sameBoundary && messagesRef.current.length > 60 ? old : msgs.cursor,
      );
      setState("ready");
    } catch {
      if (
        focused.current &&
        ticket === generation.current &&
        !messagesRef.current.length
      )
        setState("error");
    }
  }, [conversationId, myId]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      ++visit.current;
      setDraft("");
      clearBoundary.current = null;
      setOlderCursor(null);
      setOlderError("");
      const stopActive = setActiveChat(conversationId);
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
        stopActive();
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
      if (retry.current?.room !== sendingRoom || retry.current.body !== text)
        retry.current = {
          room: sendingRoom,
          body: text,
          key: Crypto.randomUUID(),
        };
      const msg = await sendMessage(
        conversationId,
        myId,
        text,
        retry.current.key,
      );
      if (
        room.current !== sendingRoom ||
        visit.current !== sendingVisit ||
        !focused.current
      )
        return;
      retry.current = null;
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

  const loadOlder = async () => {
    if (!olderCursor || olderLock.current) return;
    olderLock.current = true;
    setOlderBusy(true);
    setOlderError("");
    const scope = room.current,
      visitId = visit.current,
      boundary = clearBoundary.current;
    try {
      const page = await listMessagesPage(conversationId, myId, olderCursor);
      if (
        room.current !== scope ||
        visit.current !== visitId ||
        !focused.current
      )
        return;
      if (page.clearedAt !== boundary) {
        void load();
        return;
      }
      stickToBottom.current = false;
      setMessages((previous) => mergeMessages(page.items, previous));
      setOlderCursor(page.cursor);
    } catch {
      if (room.current === scope && visit.current === visitId)
        setOlderError("Could not load older messages.");
    } finally {
      olderLock.current = false;
      if (room.current === scope && visit.current === visitId)
        setOlderBusy(false);
    }
  };
  const visibleRead = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{
        item: TimelineItem<ChatMessage>;
        isViewable: boolean;
      }>;
    }) => {
      const last = viewableItems
        .filter((i) => i.isViewable)
        .flatMap((i) => (i.item.type === "message" ? [i.item.message] : []))
        .at(-1);
      if (last && focused.current && isForeground())
        void markConversationRead(last.conversationId, last.id).catch(() => {});
    },
  ).current;

  // Business chats: business name on top, the person running it underneath.
  const who = peer
    ? chatIdentity({
        name: peer.name,
        isBusiness: peer.isBusiness,
        businessName: peer.businessName,
        booking: peer.kind === "booking",
        contextTitle: peer.contextTitle,
      })
    : {
        kind: "plan" as const,
        title: title ?? "Conversation",
        subtitle: "",
        tag: "",
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
          <ChatAvatar name={who.title} kind={who.kind} size={40} />
          <View style={styles.headingText}>
            <Text style={styles.title} numberOfLines={1}>
              {who.title}
            </Text>
            {!!who.subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {who.subtitle}
              </Text>
            )}
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
              style={styles.listView}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              onLayout={() => {
                if (stickToBottom.current)
                  listRef.current?.scrollToEnd({ animated: false });
              }}
              data={buildTimeline(messages, [], {
                now: new Date(),
                myId,
              })}
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              onViewableItemsChanged={visibleRead}
              viewabilityConfig={{
                itemVisiblePercentThreshold: 80,
                minimumViewTime: 500,
              }}
              ListHeaderComponent={
                <>
                  {!!olderError && (
                    <Text accessibilityRole="alert" style={styles.sendError}>
                      {olderError}
                    </Text>
                  )}
                  {olderCursor && (
                    <Button
                      title="Older messages"
                      variant="ghost"
                      loading={olderBusy}
                      onPress={() => void loadOlder()}
                    />
                  )}
                </>
              }
              keyExtractor={(item) => item.key}
              renderItem={({ item }) =>
                item.type === "day" ? (
                  <DayChip label={item.label} />
                ) : item.type === "event" ? (
                  <EventLine text={item.text} />
                ) : (
                  <MessageRow
                    item={item}
                    group={false}
                    hint={
                      item.message.mine ? undefined : "Hold to report message"
                    }
                    onLongPress={
                      item.message.mine
                        ? undefined
                        : () =>
                            navigation.navigate("Report", {
                              target: {
                                kind: "message",
                                id: item.message.id,
                                name: "Message",
                              },
                            })
                    }
                  />
                )
              }
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
        <ChatComposer
          inputRef={inputRef}
          value={draft}
          onChangeText={setDraft}
          onSend={onSend}
          sending={sending}
          disabled={!peer?.canMessage}
          placeholder="Write a message…"
          label="Message"
          sendLabel="Send message"
          bottomInset={
            keyboardOpen ? spacing.sm : Math.max(insets.bottom, spacing.sm)
          }
        />
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
  flex: { flex: 1, minHeight: 0, backgroundColor: colors.surface },
  listView: { flex: 1, minHeight: 0 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: chatColors.theirsBorder,
    backgroundColor: colors.surface,
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
  transcript: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: chatColors.canvas,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  sendError: {
    ...typography.bodySmall,
    color: colors.red,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
});
