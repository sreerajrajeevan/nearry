import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "./Icon";
import { colors, typography } from "../theme";

/** The requester's note, shown on a join request card. Not part of chat. */
export function RequestNote({
  note,
  mine = false,
}: {
  note?: string;
  mine?: boolean;
}) {
  if (!note) return null;
  return (
    <View
      style={styles.note}
      accessible
      accessibilityLabel={`${mine ? "Your note" : "Note"}: ${note}`}
    >
      <Icon name="message-square" size={14} color={colors.amberDeep} />
      <Text style={styles.text}>
        {mine && <Text style={styles.mine}>Your note: </Text>}
        {note}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  note: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.amberSoft,
  },
  text: { ...typography.bodySmall, color: colors.text, flex: 1 },
  mine: { color: colors.textDim },
});
