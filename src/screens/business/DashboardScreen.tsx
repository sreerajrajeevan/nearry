import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { BrandHeader } from "../../components/BrandHeader";
import { PageHeading } from "../../components/PageHeading";
import { Icon } from "../../components/Icon";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing } from "../../theme";
import { BusinessTabParamList } from "../../navigation/types";
import { useAuth } from "../../store/AuthContext";
import { listMyOffers } from "../../services/offers";
import {
  listBookingsForBusiness,
  subscribeToBookings,
  confirmBooking,
} from "../../services/bookings";
import { Offer, Booking, isHoldExpired } from "../../services/mappers";
import { formatTime } from "../../utils/format";
import { businessDay } from "../../utils/businessDay";

type Props = {
  navigation: { navigate: (screen: keyof BusinessTabParamList) => void };
};
export function DashboardScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    if (!profile) return;
    const version = ++request.current;
    try {
      const [o, b] = await Promise.all([
        listMyOffers(profile.id),
        listBookingsForBusiness(profile.id),
      ]);
      if (request.current !== version) return;
      setOffers(o);
      setBookings(b);
      setState("ready");
    } catch {
      if (request.current === version) setState("error");
    }
  }, [profile]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        request.current++;
      };
    }, [load]),
  );
  useEffect(() => subscribeToBookings(() => void load()), [load]);
  const { today, liveOffers, drafts } = businessDay(bookings, offers);
  const name = profile?.businessName || profile?.displayName || "your business";
  const verified = profile?.verificationStatus === "verified";
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
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <BrandHeader context={name} />
        <PageHeading
          greeting={`Hello, ${name}.`}
          title={"Make room\nfor a new face."}
        />
        {state === "loading" ? (
          <Text style={styles.status}>Getting your day ready…</Text>
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
              <View style={styles.stat}>
                <Text style={styles.value}>
                  {String(today.length).padStart(2, "0")}
                </Text>
                <Text style={styles.statLabel}>Bookings today</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.value}>
                  {String(liveOffers.length).padStart(2, "0")}
                </Text>
                <Text style={styles.statLabel}>Live offers</Text>
              </View>
            </View>
            <View style={styles.nudge}>
              <Text style={styles.nudgeTitle}>
                {verified
                  ? drafts.length
                    ? "Your next hello is almost ready."
                    : "Someone nearby could use that slot."
                  : "Let’s introduce your business."}
              </Text>
              <Text style={styles.nudgeDescription}>
                {verified
                  ? drafts.length
                    ? `You have ${drafts.length} draft offer${drafts.length === 1 ? "" : "s"}. Finish an invitation for your neighbourhood.`
                    : "Invite your neighbourhood in with a last-minute offer."
                  : "Complete verification to publish your offers. You can prepare drafts while you wait."}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.textButton}
                activeOpacity={0.65}
                onPress={() =>
                  navigation.navigate(verified ? "CreateOffer" : "Business")
                }
              >
                <Text style={styles.link}>
                  {verified
                    ? "Say hello with an offer"
                    : "View business verification"}
                </Text>
                <Icon name="arrow-up-right" size={15} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Coming through your door</Text>
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
                  <Text style={styles.time}>{formatTime(booking.slot)}</Text>
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
                  ) : isHoldExpired(booking) ? (
                    <Text style={styles.expired}>Expired</Text>
                  ) : (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Confirm ${booking.customerName} at ${formatTime(booking.slot)}`}
                      disabled={confirming !== null}
                      onPress={() => void onConfirm(booking.id)}
                      style={styles.confirmButton}
                    >
                      <Text style={styles.link}>
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
  statsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stat: { flex: 1 },
  value: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 38,
    color: colors.text,
  },
  statLabel: { ...typography.bodySmall, color: colors.textDim, marginTop: 3 },
  nudge: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  nudgeTitle: {
    ...typography.title,
    fontSize: 21,
    lineHeight: 27,
    color: colors.text,
  },
  nudgeDescription: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
  textButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
    alignSelf: "flex-start",
    paddingTop: 8,
  },
  link: { ...typography.bodySmall, color: colors.accent },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: { ...typography.bodySmall, color: colors.text, flex: 1 },
  sectionMeta: { ...typography.caption, color: colors.textDim },
  appointment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 17,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  time: { ...typography.bodySmall, color: colors.textDim, width: 57 },
  customer: { flex: 1 },
  name: { ...typography.bodySmall, color: colors.text },
  detail: { ...typography.caption, color: colors.textDim, marginTop: 3 },
  confirmed: { ...typography.caption, color: colors.textDim, flexShrink: 1 },
  expired: {
    ...typography.caption,
    color: colors.textFaint,
    fontStyle: "italic",
    flexShrink: 1,
  },
  confirmButton: { minHeight: 44, justifyContent: "center", paddingLeft: 4 },
  allBookings: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 48,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
});
