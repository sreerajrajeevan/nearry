import { ConversationActions } from "../../components/ConversationActions";
import { LoadingState } from "../../components/LoadingState";
import React, { useCallback, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { PageHeading } from "../../components/PageHeading";
import { Icon } from "../../components/Icon";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing, surfaces } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { subscribeToNotifications } from "../../services/notifications";
import { onUnreadChanged } from "../../services/unreadEvents";
import { listConversations } from "../../services/chat";
import { listPlanGroups, PlanGroup } from "../../services/planGroups";
import { Conversation } from "../../services/mappers";

type Props = {
  navigation: {
    goBack?: () => void;
    canGoBack?: () => boolean;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
};

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "NOW";
  if (mins < 60) return `${mins}M`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}H`;
  return `${Math.floor(h / 24)}D`;
}

/** Shared chat list for personal + business lanes. */
export function ChatListScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const focused = useRef(false),
    version = useRef(0);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<PlanGroup[]>([]);
  const [groupError, setGroupError] = useState(false);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(
    async (silent = false) => {
      const ticket = ++version.current;
      if (!silent) setState("loading");
      try {
        const [result, planGroups] = await Promise.all([
          listConversations(),
          profile?.accountType === "personal"
            ? listPlanGroups(profile.id).catch(() => null)
            : Promise.resolve([]),
        ]);
        if (!focused.current || ticket !== version.current) return;
        setConversations(result);
        setGroupError(planGroups === null);
        if (planGroups) setGroups(planGroups);
        setState("ready");
      } catch {
        if (focused.current && ticket === version.current && !silent)
          setState("error");
      }
    },
    [profile?.id, profile?.accountType],
  );

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setSelected(null);
      void load();
      const refresh = () => void load(true);
      const stop = profile
        ? subscribeToNotifications(profile.id, refresh)
        : () => {};
      const stopLocal = onUnreadChanged(refresh);
      const appState = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      const timer = setInterval(refresh, 30000);
      return () => {
        focused.current = false;
        ++version.current;
        stop();
        stopLocal();
        appState.remove();
        clearInterval(timer);
      };
    }, [load, profile?.id]),
  );

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {navigation.canGoBack?.() && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
            onPress={() => navigation.goBack?.()}
          >
            <Icon name="arrow-left" size={16} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <PageHeading compact title="Your conversations" />
        <Text style={styles.subtitle}>About your plans and bookings</Text>
        {groupError && (
          <View>
            <Text accessibilityRole="alert" style={styles.subtitle}>
              Couldn’t load plan groups. Your direct chats are still available.
            </Text>
            <Button
              title="Retry plan groups"
              variant="ghost"
              onPress={() => void load(true)}
            />
          </View>
        )}
        {groups.length > 0 && (
          <View>
            <Text accessibilityRole="header" style={styles.name}>
              Plan groups
            </Text>
            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                accessibilityRole="button"
                accessibilityLabel={`${group.name}. ${group.memberCount} members. ${group.unreadCount ?? 0} unread messages`}
                style={styles.chatContent}
                onPress={() =>
                  navigation.navigate("PlanGroup", { groupId: group.id })
                }
              >
                <Avatar name={group.name} size={44} tone="clay" />
                <View style={styles.text}>
                  <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {group.name}
                    </Text>
                    <Text style={styles.time}>{timeAgo(group.lastAt)}</Text>
                  </View>
                  <Text style={styles.context} numberOfLines={1}>
                    {group.memberCount} members ·{" "}
                    {group.cancelled ? "Cancelled plan" : group.planTitle}
                  </Text>
                  <View style={styles.bottomRow}>
                    <Text style={styles.preview} numberOfLines={1}>
                      {group.lastBody ?? "Say hello to your group…"}
                    </Text>
                    {!!group.unreadCount && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>
                          {group.unreadCount > 99 ? "99+" : group.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <Text accessibilityRole="header" style={styles.name}>
              Direct messages
            </Text>
          </View>
        )}
        {conversations.length > 0 && (
          <Text style={styles.subtitle}>
            Hold a chat for options, or tap its three dots.
          </Text>
        )}
        {state === "loading" ? (
          <LoadingState label="Loading conversations…" layout="list" />
        ) : state === "error" ? (
          <View>
            <EmptyState
              title="Couldn't load chats"
              hint="Check your connection and retry."
            />
            <Button title="Retry" onPress={() => void load()} />
          </View>
        ) : conversations.length === 0 && groups.length === 0 ? (
          <EmptyState
            title="No conversations"
            hint="Approve a join request or confirm a booking to start chatting."
          />
        ) : (
          conversations.map((c) => (
            <View key={c.id} style={styles.chatRow}>
              <TouchableOpacity
                style={styles.chatOpen}
                accessibilityRole="button"
                accessibilityLabel={`${c.otherName}. ${c.contextTitle}${c.unreadCount > 0 ? `. ${c.unreadCount} unread message${c.unreadCount === 1 ? "" : "s"}` : ""}`}
                accessibilityHint="Double tap to open. Long press for conversation options."
                accessibilityActions={[
                  { name: "longpress", label: "Conversation options" },
                ]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === "longpress")
                    setSelected(c);
                }}
                onLongPress={() => setSelected(c)}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("Conversation", {
                    conversationId: c.id,
                    title: c.otherName,
                  })
                }
              >
                <View style={styles.chatContent}>
                  <Avatar name={c.otherName} size={44} tone="clay" />
                  <View style={styles.text}>
                    <View style={styles.topRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {c.otherName}
                      </Text>
                      <Text style={styles.time}>{timeAgo(c.lastAt)}</Text>
                    </View>
                    <Text style={styles.context} numberOfLines={1}>
                      {c.contextTitle}
                    </Text>
                    <View style={styles.bottomRow}>
                      <Text style={styles.preview} numberOfLines={1}>
                        {c.lastBody ?? "Say hello…"}
                      </Text>
                      {c.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>
                            {c.unreadCount > 99 ? "99+" : c.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Options for ${c.otherName}`}
                style={styles.more}
                onPress={() => setSelected(c)}
              >
                <Icon name="more-vertical" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
      {selected && (
        <ConversationActions
          key={selected.id}
          conversationId={selected.id}
          otherUserId={selected.otherUserId}
          name={selected.otherName}
          onClose={() => setSelected(null)}
          onReport={() => {
            setSelected(null);
            navigation.navigate("Report", {
              target: {
                kind: "conversation",
                id: selected.id,
                name: selected.otherName,
              },
            });
          }}
          onChanged={() => {
            setSelected(null);
            void load(true);
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  back: {
    flexDirection: "row",
    gap: 5,
    minHeight: 44,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  backText: { ...typography.bodySmall, color: colors.textDim },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginBottom: spacing.sm,
  },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  chatRow: {
    ...surfaces.card,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chatOpen: { flex: 1, minWidth: 0 },
  more: {
    width: 44,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  chatContent: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 20,
  },
  text: { flex: 1, minWidth: 0 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: { ...typography.heading, color: colors.text, flex: 1 },
  time: { ...typography.caption, color: colors.textFaint },
  context: { ...typography.caption, color: colors.accent, marginTop: 2 },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 4,
  },
  preview: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
  unreadBadge: {
    minWidth: 22,
    minHeight: 22,
    paddingHorizontal: 5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
  },
  unreadText: {
    ...typography.caption,
    color: colors.onGold,
    fontWeight: "600",
  },
});
