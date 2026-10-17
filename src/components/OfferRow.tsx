import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../theme";
import { Offer } from "../services/mappers";
import { formatDistance, formatWhen } from "../utils/format";
import { Icon } from "./Icon";

type Props = { offer: Offer; distanceKm?: number; onPress: () => void };
export function OfferRow({ offer, distanceKm, onPress }: Props) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${offer.title}. View opening`}
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>{offer.title}</Text>
        <Text style={styles.meta}>
          {[
            offer.businessName,
            formatWhen(offer.startsAt),
            distanceKm == null ? null : formatDistance(distanceKm),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      {offer.priceCents != null && (
        <Text style={styles.price}>
          {offer.priceCents === 0
            ? "Free"
            : `₹${(offer.priceCents / 100).toFixed(0)}`}
        </Text>
      )}
      <Icon name="arrow-up-right" size={18} color={colors.accent} />
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  copy: { flex: 1 },
  title: { ...typography.body, color: colors.text },
  meta: { ...typography.caption, color: colors.textDim, marginTop: 5 },
  price: { ...typography.bodySmall, color: colors.text },
});
