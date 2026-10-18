import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, typography, spacing } from "../theme";
import { Icon } from "./Icon";

type Props = {
  context?: string;
  onContextPress?: () => void;
  location?: boolean;
  onMessagesPress?: () => void;
  unreadMessages?: number;
  onNotificationsPress?: () => void;
  unreadNotifications?: number;
};

export function BrandHeader({
  context,
  onContextPress,
  location = false,
  onMessagesPress,
  unreadMessages = 0,
  onNotificationsPress,
  unreadNotifications = 0,
}: Props) {
  const unread = Math.max(0, Math.floor(unreadMessages));
  const unreadNotifs = Math.max(0, Math.floor(unreadNotifications));
  const contextContent = (
    <>
      {location && <Icon name="map-pin" size={13} />}
      <Text style={styles.context} numberOfLines={1}>
        {context}
      </Text>
      {onContextPress && <Icon name="chevron-down" size={13} />}
    </>
  );
  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <View style={styles.brand} accessibilityLabel="Nearry">
          <View style={styles.mark}>
            <View style={styles.tail} />
          </View>
          <Text style={styles.wordmark}>nearry</Text>
        </View>
        {!!context &&
          (onContextPress ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Change location, ${context}`}
              hitSlop={4}
              onPress={onContextPress}
              style={styles.contextButton}
              activeOpacity={0.65}
            >
              {contextContent}
            </TouchableOpacity>
          ) : (
            <View style={styles.contextButton}>{contextContent}</View>
          ))}
      </View>
      <View style={styles.actions}>
        {onNotificationsPress && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              unreadNotifs > 0
                ? `Notifications, ${unreadNotifs} unread`
                : "Notifications"
            }
            accessibilityHint="Open your notifications"
            onPress={onNotificationsPress}
            activeOpacity={0.7}
            style={styles.messagesButton}
          >
            <Icon name="bell" size={22} color={colors.text} />
            {unreadNotifs > 0 && (
              <View
                style={styles.unreadBadge}
                pointerEvents="none"
                accessible={false}
              >
                <Text style={styles.unreadText}>
                  {unreadNotifs > 99 ? "99+" : unreadNotifs}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {onMessagesPress && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              unread > 0
                ? `Messages, ${unread} unread message${unread === 1 ? "" : "s"}`
                : "Messages"
            }
            accessibilityHint="Open your conversations"
            onPress={onMessagesPress}
            activeOpacity={0.7}
            style={styles.messagesButton}
          >
            <Icon name="message-circle" size={22} color={colors.text} />
            {unread > 0 && (
              <View
                style={styles.unreadBadge}
                pointerEvents="none"
                accessible={false}
              >
                <Text style={styles.unreadText}>
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  identity: { flex: 1, minWidth: 0 },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 0,
  },
  mark: {
    width: 17,
    height: 15,
    borderRadius: 6,
    borderBottomLeftRadius: 1,
    backgroundColor: colors.accent,
  },
  tail: {
    position: "absolute",
    bottom: -4,
    left: 0,
    width: 6,
    height: 8,
    borderBottomRightRadius: 6,
    backgroundColor: colors.accent,
  },
  wordmark: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -1,
  },
  contextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 36,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: "flex-start",
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 1,
    minWidth: 0,
  },
  messagesButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    minHeight: 20,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.background,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  unreadText: {
    ...typography.caption,
    lineHeight: 16,
    color: colors.onAccent,
    fontWeight: "600",
  },
  context: {
    ...typography.caption,
    fontSize: 13,
    color: colors.text,
    flexShrink: 1,
  },
});
