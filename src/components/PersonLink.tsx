import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography, weight } from "../theme";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { MotionPressable } from "./Motion";

/** Photo and name of a person that opens their profile when tapped. */
export function PersonLink({
  name,
  avatarUrl,
  subtitle,
  size = 40,
  onPress,
}: {
  name: string;
  avatarUrl?: string;
  subtitle?: string;
  size?: number;
  onPress: () => void;
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`View ${name}’s profile`}
      onPress={onPress}
      style={styles.row}
    >
      <Avatar name={name} uri={avatarUrl} size={size} tone="clay" />
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle ? `${subtitle} · ` : ""}
          <Text style={styles.view}>View profile</Text>
        </Text>
      </View>
      <Icon name="chevron-right" size={16} color={colors.textDim} />
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  copy: { flex: 1, minWidth: 0 },
  name: { ...typography.body, color: colors.ink, ...weight("700") },
  subtitle: { ...typography.caption, color: colors.textDim, marginTop: 1 },
  view: { color: colors.amberDeep, ...weight("700") },
});
