import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "./Icon";
import { colors, typography } from "../theme";
export function audienceLabel(value?: "female" | "male" | "any") {
  return value === "female"
    ? "Females only"
    : value === "male"
      ? "Males only"
      : "Anyone can join";
}
export function AudienceBadge({
  preference,
}: {
  preference?: "female" | "male" | "any";
}) {
  const restricted = preference === "female" || preference === "male";
  const color =
    preference === "female"
      ? "#8A2754"
      : preference === "male"
        ? "#205A91"
        : colors.sageDeep;
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor:
            preference === "female"
              ? "#FCE8F1"
              : preference === "male"
                ? "#E6F0FC"
                : colors.sageSoft,
        },
      ]}
    >
      {restricted ? (
        <Text accessible={false} style={[styles.symbol, { color }]}>
          {preference === "female" ? "♀" : "♂"}
        </Text>
      ) : (
        <Icon name="users" size={13} color={color} />
      )}
      <Text style={[styles.label, { color }]}>{audienceLabel(preference)}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  symbol: { fontSize: 16, fontWeight: "700" },
  label: { ...typography.caption, fontWeight: "600" },
});
