import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, typography, spacing } from "../theme";
import { Icon } from "./Icon";
import { BrandLogo } from "./BrandLogo";

type Props = {
  context?: string;
  onContextPress?: () => void;
  location?: boolean;
  onMessagesPress?: () => void;
  unreadMessages?: number;
  onNotificationsPress?: () => void;
  unreadNotifications?: number;
  compact?: boolean;
};

export function BrandHeader({
  context,
  onContextPress,
  location = false,
  onMessagesPress,
  unreadMessages = 0,
  onNotificationsPress,
  unreadNotifications = 0,
  compact = false,
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
    <View style={[styles.header, compact && styles.compactHeader]}>
      <View style={styles.identity}>
        <BrandLogo width={compact ? 128 : 148} />
        {!!context &&
          (onContextPress ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Change location, ${context}`}
              hitSlop={4}
              onPress={onContextPress}
              style={[styles.contextButton, compact && styles.compactContext]}
              activeOpacity={0.65}
            >
              {contextContent}
            </TouchableOpacity>
          ) : (
            <View
              style={[styles.contextButton, compact && styles.compactContext]}
            >
              {contextContent}
            </View>
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
  compactHeader: { paddingTop: 4, paddingBottom: 4 },
  compactContext: {
    backgroundColor: "transparent",
    marginTop: 0,
    paddingHorizontal: 0,
    minHeight: 44,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  identity: { flex: 1, minWidth: 0 },
  contextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    marginTop: 10,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.gold,
  },
  unreadText: {
    ...typography.caption,
    lineHeight: 16,
    color: colors.onGold,
    fontWeight: "600",
  },
  context: {
    ...typography.caption,
    fontSize: 13,
    color: colors.text,
    flexShrink: 1,
  },
});
