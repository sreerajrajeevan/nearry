import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  PlanOfferBundle,
  bundleStatus,
  rupees,
} from "../utils/planOfferBundle";
import { colors, weight } from "../theme";
import { formatWhen, formatTime } from "../utils/format";

export function PlanBundleCard({ bundle }: { bundle: PlanOfferBundle }) {
  const status = bundleStatus(bundle);
  const label = {
    pending: "Awaiting venue confirmation",
    confirmed: "Venue booking confirmed",
    cancelled: "Venue reservation cancelled",
    expired: "Venue hold expired",
  }[status];
  return (
    <View style={styles.card}>
      <Text style={styles.status}>{label}</Text>
      <Text style={styles.title}>{bundle.offerTitle}</Text>
      <Text style={styles.text}>
        {bundle.businessName} · {bundle.venueName}
      </Text>
      <Text style={styles.text}>
        {formatWhen(bundle.startsAt)} – {formatTime(bundle.endsAt)}
      </Text>
      <Text style={styles.title}>{rupees(bundle.priceCents)}/person</Text>
      <Text style={styles.text}>
        {rupees(bundle.priceCents * bundle.partySize)} for {bundle.partySize}{" "}
        reserved places, including the host. Pay at the venue.
      </Text>
      <Text style={styles.text}>
        The host is responsible for the full group total, even if spots remain
        empty. Leaving opens a plan spot for a replacement.
      </Text>
      {status === "pending" && bundle.holdExpiresAt && (
        <Text style={styles.text}>
          The venue must confirm by {formatTime(bundle.holdExpiresAt)}. Joining
          this plan does not confirm the venue booking.
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    marginBottom: 20,
    gap: 7,
  },
  status: { color: colors.accent, ...weight("bold"), fontSize: 14 },
  title: { color: colors.text, ...weight("bold"), fontSize: 17 },
  text: { color: colors.textDim, fontSize: 14, lineHeight: 21 },
});
