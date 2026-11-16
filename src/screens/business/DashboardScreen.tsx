import { Alert } from "../../services/appAlert";
import { LoadingState } from "../../components/LoadingState";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { BrandHeader } from "../../components/BrandHeader";
import { PageHeading } from "../../components/PageHeading";
import { Icon } from "../../components/Icon";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing, weight } from "../../theme";
import { MotionPressable } from "../../components/Motion";
import { BusinessTabNav } from "../../navigation/types";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { useAuth } from "../../store/AuthContext";
import { listMyOffers } from "../../services/offers";
import {
  listBookingsForBusiness,
  subscribeToBookings,
  confirmBooking,
} from "../../services/bookings";
import {
  Offer,
  Booking,
  isHoldExpired,
  isBookingStale,
} from "../../services/mappers";
import { formatTime } from "../../utils/format";
import { businessDay } from "../../utils/businessDay";

type Props = {
  navigation: BusinessTabNav;
};
export function DashboardScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [confirming, setConfirming] = useState<string | null>(null);
  const {
    data,
    state,
    refreshing,
    refresh: load,
  } = useLiveQuery(
    `dashboard:${profile?.id}`,
    async () => {
      if (!profile) return { offers: [], bookings: [] };
      const [offers, bookings] = await Promise.all([
        listMyOffers(profile.id),
        listBookingsForBusiness(profile.id),
      ]);
      return { offers, bookings };
    },
    subscribeToBookings,
  );
  const offers = data?.offers ?? [],
    bookings = data?.bookings ?? [];
  const { today, liveOffers, drafts } = businessDay(bookings, offers);
  const name = profile?.businessName || profile?.displayName || "your business";
  const verified = profile?.verificationStatus === "verified";
  const waiting = today.filter(
    (b) => b.status !== "confirmed" && !isBookingStale(b),
  ).length;
  const onConfirm = async (id: string) => {
    if (confirming) return;
    setConfirming(id);
    try {
      await confirmBooking(id);
      await load();
    } catch (error) {
      Alert.alert(
        "Couldn’t confirm booking",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setConfirming(null);
    }
  };
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            colors={[colors.accent]}
            onRefresh={async () => {
              await load(true);
            }}
          />
        }
      >
        <BrandHeader context={name} />
        <PageHeading
          tone="plain"
          greeting={`Hello, ${name}.`}
          title="Today at a glance"
        />
        {state === "loading" ? (
          <LoadingState label="Getting your day ready…" layout="list" />
        ) : state === "error" ? (
          <>
            <EmptyState
              title="Couldn’t load your day"
              hint="Check your connection and try again."
            />
            <Button
              title="Try again"
              variant="ghost"
              onPress={() => void load()}
            />
          </>
        ) : (
          <>
            <View style={styles.statsRow}>
              {[
                { value: today.length, label: "Bookings today" },
                { value: waiting, label: "To confirm" },
                { value: liveOffers.length, label: "Live offers" },
              ].map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <Text style={styles.value}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
            {!verified ? (
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Verify your business to publish offers"
                onPress={() => navigation.navigate("BusinessVerification")}
                style={styles.nudge}
              >
                <View style={styles.nudgeIcon}>
                  <Icon name="shield" size={20} color={colors.night} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.nudgeTitle}>Verify your business</Text>
                  <Text style={styles.nudgeDescription}>
                    Upload one document. Once approved you can publish offers.
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.ink} />
              </MotionPressable>
            ) : (
              drafts.length > 0 && (
                <MotionPressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate("MyOffers")}
                  style={styles.nudge}
                >
                  <View style={styles.nudgeIcon}>
                    <Icon name="edit-3" size={20} color={colors.night} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.nudgeTitle}>
                      {drafts.length} draft offer
                      {drafts.length === 1 ? "" : "s"}
                    </Text>
                    <Text style={styles.nudgeDescription}>
                      Finish and publish to fill your quiet slots.
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.ink} />
                </MotionPressable>
              )
            )}
            <View style={styles.actions}>
              {(
                [
                  {
                    icon: "plus",
                    label: "New offer",
                    go: () =>
                      navigation.navigate(
                        verified ? "CreateOffer" : "BusinessVerification",
                      ),
                  },
                  {
                    icon: "tag",
                    label: "My offers",
                    go: () => navigation.navigate("MyOffers"),
                  },
                  {
                    icon: "calendar",
                    label: "Bookings",
                    go: () => navigation.navigate("Bookings"),
                  },
                ] as const
              ).map((action) => (
                <MotionPressable
                  key={action.label}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={action.go}
                  style={styles.action}
                >
                  <View style={styles.actionIcon}>
                    <Icon name={action.icon} size={20} color={colors.ink} />
                  </View>
                  <Text style={styles.actionText}>{action.label}</Text>
                </MotionPressable>
              ))}
            </View>
            <View style={styles.sectionRow}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Coming in today
              </Text>
              <Text style={styles.sectionMeta}>Today</Text>
            </View>
            {today.length === 0 ? (
              <EmptyState
                title="A little room in your day"
                hint="New bookings will appear here."
              />
            ) : (
              today.slice(0, 8).map((booking) => (
                <View key={booking.id} style={styles.appointment}>
                  <View style={styles.timeChip}>
                    <Text style={styles.time}>{formatTime(booking.slot)}</Text>
                  </View>
                  <View style={styles.customer}>
                    <Text style={styles.name}>{booking.customerName}</Text>
                    <Text style={styles.detail}>
                      {[
                        booking.offerTitle,
                        booking.partySize > 1
                          ? `${booking.partySize} people`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  {booking.status === "confirmed" ? (
                    <Text style={styles.confirmed}>Confirmed</Text>
                  ) : isBookingStale(booking) ? (
                    <Text style={styles.stale}>
                      {isHoldExpired(booking) ? "Expired" : "Missed"}
                    </Text>
                  ) : (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Confirm ${booking.customerName} at ${formatTime(booking.slot)}`}
                      disabled={confirming !== null}
                      onPress={() => void onConfirm(booking.id)}
                      style={styles.confirmButton}
                    >
                      <Text style={styles.confirmText}>
                        {confirming === booking.id ? "Confirming…" : "Confirm"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.65}
              style={styles.allBookings}
              onPress={() => navigation.navigate("Bookings")}
            >
              <Text style={styles.link}>All bookings</Text>
              <Icon name="arrow-up-right" size={15} color={colors.accent} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  status: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: spacing.lg,
  },
  flex: { flex: 1, minWidth: 0 },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.night,
  },
  stat: { flex: 1 },
  value: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.amberBright,
  },
  statLabel: {
    ...typography.caption,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  nudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  nudgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberBright,
  },
  nudgeTitle: { ...typography.body, color: colors.ink, ...weight("800") },
  nudgeDescription: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: 2,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 22 },
  action: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
  },
  actionText: { ...typography.caption, color: colors.ink, ...weight("700") },
  link: { ...typography.bodySmall, color: colors.amberDeep, ...weight("700") },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: { ...typography.heading, color: colors.ink, flex: 1 },
  sectionMeta: { ...typography.caption, color: colors.textDim },
  appointment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 17,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  timeChip: {
    minWidth: 70,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
  },
  time: { ...typography.caption, color: colors.ink, ...weight("700") },
  customer: { flex: 1 },
  name: { ...typography.body, color: colors.ink, ...weight("700") },
  detail: { ...typography.caption, color: colors.textDim, marginTop: 3 },
  confirmed: {
    ...typography.caption,
    color: colors.success,
    ...weight("700"),
    flexShrink: 1,
  },
  stale: {
    ...typography.caption,
    color: colors.textFaint,
    fontStyle: "italic",
    flexShrink: 1,
  },
  confirmText: { ...typography.caption, color: colors.night, ...weight("800") },
  confirmButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.amberBright,
  },
  allBookings: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 48,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
});
