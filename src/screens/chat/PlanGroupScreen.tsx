import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PersonalStackParamList } from "../../navigation/types";
import { useAuth } from "../../store/AuthContext";
import { Alert } from "../../services/appAlert";
import {
  getPlanGroup,
  leavePlanGroup,
  listPlanGroupMessages,
  markPlanGroupRead,
  renamePlanGroup,
  sendPlanGroupMessage,
  subscribeToPlanGroup,
  PlanGroup,
  PlanGroupMessage,
} from "../../services/planGroups";
import { blockUser } from "../../services/safety";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { colors } from "../../theme";
import { useReducedMotion } from "../../store/MotionContext";

type Props = NativeStackScreenProps<PersonalStackParamList, "PlanGroup">;
export function PlanGroupScreen({ route, navigation }: Props) {
  const { profile } = useAuth(),
    myId = profile?.id ?? "";
  const reduced = useReducedMotion();
  const address = route.params,
    roomKey = JSON.stringify(address) + myId;
  const [group, setGroup] = useState<PlanGroup | null>(null),
    [messages, setMessages] = useState<PlanGroupMessage[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading"),
    [error, setError] = useState("");
  const [draft, setDraft] = useState(""),
    [sending, setSending] = useState(false),
    [sendError, setSendError] = useState("");
  const [details, setDetails] = useState(false),
    [name, setName] = useState(""),
    [working, setWorking] = useState(false),
    [older, setOlder] = useState(false),
    [hasOlder, setHasOlder] = useState(false);
  const leaveTarget = useRef<{ id: string; hostId: string } | null>(null);
  const focused = useRef(false),
    generation = useRef(0),
    visit = useRef(0),
    currentRoom = useRef(roomKey),
    lock = useRef<string | null>(null),
    nonce = useRef<{ body: string; key: string } | null>(null);
  currentRoom.current = roomKey;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const detailsRef = useRef(details);
  detailsRef.current = details;
  const list = useRef<FlatList<PlanGroupMessage>>(null),
    stick = useRef(true);
  const insets = useSafeAreaInsets(),
    [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  useEffect(() => {
    setGroup(null);
    setMessages([]);
    setDraft("");
    setSendError("");
    setDetails(false);
    setState("loading");
    nonce.current = null;
    leaveTarget.current = null;
  }, [roomKey]);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboard(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboard(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const load = useCallback(async () => {
    if (currentRoom.current !== roomKey) return;
    const ticket = ++generation.current;
    try {
      const next = await getPlanGroup(address, myId);
      const pageSize = Math.min(500, Math.max(60, messagesRef.current.length));
      const page = await listPlanGroupMessages(
        next.id,
        myId,
        undefined,
        pageSize,
      );
      if (
        !focused.current ||
        ticket !== generation.current ||
        currentRoom.current !== roomKey
      )
        return;
      setGroup(next);
      leaveTarget.current = { id: next.id, hostId: next.hostId };
      if (!detailsRef.current) setName(next.name);
      // Refresh an authoritative window: removed/blocked messages must disappear.
      setMessages(page);
      setHasOlder(page.length === pageSize && page.length < 500);
      setState("ready");
      setError("");
      if (page.length)
        void markPlanGroupRead(next.id, myId, page[page.length - 1]).catch(
          () => {},
        );
    } catch (e) {
      if (
        focused.current &&
        ticket === generation.current &&
        currentRoom.current === roomKey
      ) {
        setGroup(null);
        setMessages([]);
        setState("error");
        setError(
          e instanceof Error ? e.message : "Could not load the plan group.",
        );
      }
    }
  }, [roomKey]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setSending(lock.current === roomKey);
      visit.current++;
      void load();
      const app = AppState.addEventListener("change", (state) => {
        if (state === "active") void load();
      });
      const timer = setInterval(() => {
        if (AppState.currentState === "active") void load();
      }, 30000);
      return () => {
        focused.current = false;
        generation.current++;
        visit.current++;
        app.remove();
        clearInterval(timer);
      };
    }, [load]),
  );
  useFocusEffect(
    useCallback(() => {
      if (!group?.id) return;
      return subscribeToPlanGroup(group.id, () => void load());
    }, [group?.id, load]),
  );
  const send = async () => {
    const body = draft.trim();
    if (!group || group.cancelled || !body || lock.current === roomKey) return;
    if (nonce.current?.body !== body)
      nonce.current = {
        body,
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
      };
    const key = nonce.current.key,
      room = roomKey,
      v = visit.current;
    lock.current = room;
    setSending(true);
    setSendError("");
    try {
      const message = await sendPlanGroupMessage(group.id, myId, body, key);
      if (
        !focused.current ||
        currentRoom.current !== room ||
        visit.current !== v
      )
        return;
      setMessages((current) =>
        current.some((m) => m.id === message.id)
          ? current
          : [...current, message].sort((a, b) => a.seq - b.seq),
      );
      setDraft((current) => (current.trim() === body ? "" : current));
      nonce.current = null;
      stick.current = true;
      void load();
    } catch (e) {
      if (
        focused.current &&
        currentRoom.current === room &&
        visit.current === v
      )
        setSendError(e instanceof Error ? e.message : "Could not send.");
    } finally {
      if (lock.current === room) lock.current = null;
      if (focused.current && currentRoom.current === room) setSending(false);
    }
  };
  const leave = () => {
    const target = group ?? leaveTarget.current;
    if (!target || working) return;
    Alert.alert(
      "Leave this plan and group?",
      "Your spot will be released and you’ll lose access to the group chat.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave plan",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              await leavePlanGroup(target.id, myId);
              setDetails(false);
              setGroup(null);
              setMessages([]);
              leaveTarget.current = null;
              setState("error");
              setError("You’ve left the plan. Your spot has been released.");
              navigation.goBack();
            } catch (e) {
              Alert.alert(
                "Could not leave",
                e instanceof Error ? e.message : "Please retry.",
              );
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  };
  const saveName = async () => {
    if (!group || working) return;
    setWorking(true);
    try {
      await renamePlanGroup(group.id, name, myId);
      await load();
    } catch (e) {
      Alert.alert(
        "Could not rename group",
        e instanceof Error ? e.message : "Please retry.",
      );
    } finally {
      setWorking(false);
    }
  };
  const loadOlder = async () => {
    if (!group || older || !messages.length || messages.length >= 500) return;
    setOlder(true);
    const room = roomKey;
    try {
      const page = await listPlanGroupMessages(group.id, myId, messages[0].seq);
      if (!focused.current || currentRoom.current !== room) return;
      setHasOlder(page.length === 60 && messages.length + page.length < 500);
      setMessages((current) =>
        [...page, ...current].filter(
          (m, i, a) => a.findIndex((x) => x.id === m.id) === i,
        ),
      );
    } catch (e) {
      Alert.alert(
        "Could not load earlier messages",
        e instanceof Error ? e.message : "Please retry.",
      );
    } finally {
      if (currentRoom.current === room) setOlder(false);
    }
  };
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <SafeAreaView style={styles.flex} edges={["top", "left", "right"]}>
        <View style={styles.heading}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={styles.iconButton}
          >
            <Icon name="arrow-left" size={22} />
          </TouchableOpacity>
          <Avatar name={group?.name ?? "Plan group"} size={38} />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Group details"
            disabled={!group}
            onPress={() => {
              Keyboard.dismiss();
              setName(group?.name ?? "");
              setDetails(true);
            }}
            style={styles.headingCopy}
          >
            <Text style={styles.title} numberOfLines={1}>
              {group?.name ?? "Plan group"}
            </Text>
            <Text style={styles.help}>
              {group
                ? `${group.memberCount} ${group.memberCount === 1 ? "member" : "members"} · View group details`
                : "Only the host and approved members"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Group options"
            disabled={!group}
            onPress={() => {
              Keyboard.dismiss();
              setName(group?.name ?? "");
              setDetails(true);
            }}
            style={styles.iconButton}
          >
            <Icon name="more-vertical" size={21} />
          </TouchableOpacity>
        </View>
        {group?.cancelled && (
          <Text style={styles.notice}>
            The plan was cancelled. This group is read-only.
          </Text>
        )}
        <View style={styles.transcript}>
          {state === "loading" ? (
            <LoadingState label="Opening your plan group…" />
          ) : state === "error" ? (
            <View style={{ padding: 20 }}>
              <EmptyState title="Group unavailable" hint={error} />
              <Button title="Retry" onPress={() => void load()} />
              {leaveTarget.current && leaveTarget.current.hostId !== myId && (
                <Button
                  title="Leave group & plan"
                  variant="danger"
                  loading={working}
                  onPress={leave}
                />
              )}
              <Button
                title="Back to conversations"
                variant="ghost"
                onPress={() => navigation.goBack()}
              />
            </View>
          ) : (
            <FlatList
              ref={list}
              data={messages}
              keyExtractor={(m) => m.id}
              style={styles.flex}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              contentContainerStyle={styles.list}
              onScroll={({ nativeEvent: e }) => {
                stick.current =
                  e.contentSize.height -
                    e.layoutMeasurement.height -
                    e.contentOffset.y <
                  120;
              }}
              scrollEventThrottle={100}
              onLayout={() => {
                if (stick.current)
                  list.current?.scrollToEnd({ animated: false });
              }}
              onContentSizeChange={() => {
                if (stick.current)
                  list.current?.scrollToEnd({ animated: false });
              }}
              ListHeaderComponent={
                hasOlder ? (
                  <Button
                    title="Load earlier messages"
                    variant="ghost"
                    loading={older}
                    onPress={() => {
                      stick.current = false;
                      void loadOlder();
                    }}
                  />
                ) : null
              }
              ListEmptyComponent={
                <EmptyState
                  title="Your plan, your people"
                  hint="Say hello. Approved members will join this group automatically."
                />
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.senderName}: ${item.body}${item.mine ? "" : ". Hold to report this message"}`}
                  onLongPress={() => {
                    if (!item.mine)
                      navigation.navigate("Report", {
                        target: {
                          kind: "plan_message",
                          id: item.id,
                          name: "Group message",
                        },
                      });
                  }}
                  style={[
                    styles.bubble,
                    item.mine ? styles.mine : styles.theirs,
                  ]}
                >
                  {!item.mine && (
                    <Text style={styles.sender}>{item.senderName}</Text>
                  )}
                  <Text style={[styles.body, item.mine && styles.mineText]}>
                    {item.body}
                  </Text>
                  <Text style={[styles.time, item.mine && styles.mineText]}>
                    {new Date(item.createdAt).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
        {!!sendError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {sendError} Your message is still here; tap Send to retry.
          </Text>
        )}
        <View
          style={[
            styles.composer,
            { paddingBottom: keyboard ? 8 : Math.max(insets.bottom, 8) },
          ]}
        >
          <TextInput
            accessibilityLabel="Group message"
            multiline
            maxLength={2000}
            submitBehavior="newline"
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            editable={!!group && !group.cancelled}
            placeholder="Message your group…"
            placeholderTextColor={colors.textDim}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Send group message"
            accessibilityState={{
              disabled: !draft.trim() || sending || !group || group.cancelled,
              busy: sending,
            }}
            style={[
              styles.send,
              (!draft.trim() || sending || !group || group.cancelled) && {
                opacity: 0.4,
              },
            ]}
            disabled={!draft.trim() || sending || !group || group.cancelled}
            onPress={() => void send()}
          >
            {sending ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Icon name="arrow-up" size={22} color={colors.onAccent} />
            )}
          </TouchableOpacity>
        </View>
        <Modal
          visible={details && !!group}
          transparent
          animationType={reduced ? "none" : "slide"}
          onRequestClose={() => setDetails(false)}
        >
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <Pressable
              style={styles.scrim}
              onPress={() => {
                if (!working) setDetails(false);
              }}
            >
              <Pressable
                style={[
                  styles.sheet,
                  { paddingBottom: Math.max(insets.bottom, 20) },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.heading}>
                    <Text
                      accessibilityRole="header"
                      style={[styles.title, { flex: 1 }]}
                    >
                      Plan group
                    </Text>
                    <Button
                      title="Done"
                      variant="ghost"
                      disabled={working}
                      onPress={() => setDetails(false)}
                    />
                  </View>
                  <Text style={styles.help}>{group?.planTitle}</Text>
                  {group?.hostId === myId ? (
                    <>
                      <Input
                        label="Group name"
                        value={name}
                        onChangeText={setName}
                        maxLength={80}
                        editable={!working}
                      />
                      <Button
                        title="Save group name"
                        variant="secondary"
                        loading={working}
                        onPress={() => void saveName()}
                      />
                    </>
                  ) : (
                    <Text style={styles.title}>{group?.name}</Text>
                  )}
                  <Button
                    title="View plan"
                    variant="ghost"
                    onPress={() => {
                      if (group) {
                        setDetails(false);
                        navigation.navigate("PostDetails", {
                          postId: group.postId,
                        });
                      }
                    }}
                  />
                  <Text style={styles.help}>
                    Members join when approved by the host. Leaving also
                    releases your place in the plan.
                  </Text>
                  {group?.members?.map((member) => (
                    <View key={member.id} style={styles.member}>
                      <Avatar name={member.name} size={32} />
                      <Text style={[styles.body, { flex: 1 }]}>
                        {member.name}
                        {member.host ? " · Host" : ""}
                        {member.id === myId ? " · You" : ""}
                      </Text>
                      {member.id !== myId && (
                        <>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Report ${member.name}`}
                            style={styles.iconButton}
                            onPress={() => {
                              setDetails(false);
                              navigation.navigate("Report", {
                                target: {
                                  kind: "user",
                                  id: member.id,
                                  name: member.name,
                                },
                              });
                            }}
                          >
                            <Icon name="flag" size={16} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Block ${member.name}`}
                            style={styles.iconButton}
                            onPress={() =>
                              Alert.alert(
                                "Block this person?",
                                "Their messages will be hidden. Blocking the host also removes access to this group; you can still leave the plan.",
                                [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Block",
                                    style: "destructive",
                                    onPress: async () => {
                                      try {
                                        await blockUser(
                                          member.id,
                                          true,
                                          member.name,
                                        );
                                        setDetails(false);
                                        await load();
                                      } catch (e) {
                                        Alert.alert(
                                          "Could not block",
                                          e instanceof Error
                                            ? e.message
                                            : "Please retry.",
                                        );
                                      }
                                    },
                                  },
                                ],
                              )
                            }
                          >
                            <Icon name="slash" size={16} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ))}
                  {group?.hostId === myId ? (
                    <Text style={styles.help}>
                      You’re the host. To end the plan, use Cancel plan on its
                      details page.
                    </Text>
                  ) : (
                    <Button
                      title="Leave group & plan"
                      variant="danger"
                      loading={working}
                      onPress={leave}
                    />
                  )}
                </ScrollView>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  heading: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  iconButton: {
    width: 42,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  help: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.textDim,
    marginVertical: 5,
  },
  notice: {
    padding: 12,
    fontSize: 12,
    color: colors.textDim,
    backgroundColor: colors.sageSoft,
  },
  transcript: { flex: 1, minHeight: 0 },
  list: { padding: 15, gap: 10, flexGrow: 1 },
  bubble: {
    maxWidth: "87%",
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  mine: { alignSelf: "flex-end", backgroundColor: colors.accent },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface },
  body: { fontSize: 14, lineHeight: 21, color: colors.text },
  mineText: { color: colors.onAccent },
  sender: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.coralDeep,
    marginBottom: 4,
  },
  time: {
    fontSize: 9,
    color: colors.textDim,
    textAlign: "right",
    marginTop: 4,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingTop: 9,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    fontSize: 15,
    lineHeight: 21,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.background,
    color: colors.text,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { color: colors.red, fontSize: 12, padding: 12 },
  scrim: { flex: 1, backgroundColor: "#0008", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "85%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 18,
  },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
