import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing } from "../../theme";
import { listConversations } from "../../services/chat";
import { Conversation } from "../../services/mappers";

type Props = {
  navigation: {
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      setConversations(await listConversations());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.header}>Messages</Text>
        {state === "loading" ? (
          <Text style={styles.status}>Loading…</Text>
        ) : state === "error" ? (
          <View>
            <EmptyState
              title="Couldn't load chats"
              hint="Check your connection and retry."
            />
            <Button title="Retry" onPress={() => void load()} />
          </View>
        ) : conversations.length === 0 ? (
          <EmptyState
            title="No conversations"
            hint="Approve a join request or confirm a booking to start chatting."
          />
        ) : (
          conversations.map((c) => (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate("Conversation", {
                  conversationId: c.id,
                  title: c.otherName,
                })
              }
            >
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Avatar name={c.otherName} size={40} />
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
                        <Badge label={String(c.unreadCount)} tone="red" />
                      )}
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  text: { flex: 1 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: { ...typography.heading, color: colors.text, flex: 1 },
  time: { ...typography.caption, color: colors.textFaint },
  context: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 4,
  },
  preview: { ...typography.bodySmall, color: colors.textDim, flex: 1 },
});
