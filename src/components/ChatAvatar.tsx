import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { colors, weight } from "../theme";
import type { ChatKind } from "../utils/chatIdentity";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Businesses get a dark rounded square with a shop badge (like the offer
 * page); people keep the round avatar. Tells chats apart at a glance.
 */
export function ChatAvatar({
  name,
  kind,
  size = 44,
}: {
  name: string;
  kind: ChatKind;
  size?: number;
}) {
  if (kind !== "business")
    return <Avatar name={name} size={size} tone="clay" />;
  const badge = Math.round(size * 0.42);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.mark,
          { width: size, height: size, borderRadius: size * 0.3 },
        ]}
      >
        <Text style={[styles.initials, { fontSize: size * 0.34 }]}>
          {initials(name)}
        </Text>
      </View>
      <View
        style={[
          styles.badge,
          { width: badge, height: badge, borderRadius: badge / 2 },
        ]}
      >
        <Icon name="shopping-bag" size={badge * 0.58} color={colors.onAmber} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.night,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: colors.amberBright, ...weight("800") },
  badge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    backgroundColor: colors.amberBright,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
