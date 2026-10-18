import { formatWhen } from "../../utils/format";
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { bookingState } from "../../utils/flowState";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import {
  listBookingsForBusiness,
  confirmBooking,
  cancelBooking,
  subscribeToBookings,
} from "../../services/bookings";
import { Booking, isHoldExpired, isBookingStale } from "../../services/mappers";
import { getOrCreateConversation } from "../../services/chat";

const FILTERS = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
] as const;
type Filter = (typeof FILTERS)[number];

function statusTone(status: Booking["status"]): "neutral" | "green" | "red" {
  if (status === "confirmed") return "green";
  if (status === "cancelled") return "red";
  return "neutral";
}

type Props = {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
};

/** Business bookings view — real records, confirm/cancel, realtime-synced. */
export function BookingsScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const {
    data: bookings = [],
    state,
    refreshing,
    refresh: load,
  } = useLiveQuery(
    `business-bookings:${profile?.id}`,
    () => (profile ? listBookingsForBusiness(profile.id) : Promise.resolve([])),
    subscribeToBookings,
  );

  const visible = bookings.filter(
    (b) => filter === "ALL" || bookingState(b).label.toUpperCase() === filter,
  );

  const openChat = async (booking: Booking) => {
    setBusy(`m${booking.id}`);
    try {
      const conversationId = await getOrCreateConversation(booking.customerId, {
        bookingId: booking.id,
      });
      navigation.navigate("Conversation", {
        conversationId,
        title: booking.customerName,
      });
    } catch (e) {
      Alert.alert(
        "Could not open chat",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert(
        "Hmm",
        e instanceof Error ? e.message : "Something went wrong.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              await load(true);
            }}
          />
        }
      >
        <Text style={styles.header}>Bookings</Text>
        <Text style={styles.caption}>Manage incoming requests</Text>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
                style={[styles.chip, active && styles.chipSelected]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextSelected]}
                >
                  {f.charAt(0) + f.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {state === "loading" ? (
          <Text style={styles.status}>Loading…</Text>
        ) : state === "error" ? (
          <View>
            <EmptyState
              title="Couldn't load bookings"
              hint="Check your connection and retry."
            />
            <Button title="Retry" onPress={() => void load()} />
          </View>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No bookings"
            hint={
              filter === "ALL"
                ? "New booking requests will appear here."
                : `No ${filter.toLowerCase()} bookings.`
            }
          />
        ) : (
          visible.map((b) => (
            <View key={b.id} style={styles.row}>
              <View style={styles.topRow}>
                <Avatar name={b.customerName} size={36} />
                <View style={styles.topText}>
                  <Text style={styles.customer}>{b.customerName}</Text>
                  <Text style={styles.offer}>{b.offerTitle}</Text>
                </View>
                <Badge
                  label={bookingState(b).label}
                  tone={statusTone(b.status)}
                />
              </View>
              <Text style={styles.meta}>
                {formatWhen(b.slot)} · {b.partySize}{" "}
                {b.partySize === 1 ? "person" : "people"}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={busy === `m${b.id}`}
                  onPress={() => openChat(b)}
                >
                  <Text style={styles.actionLink}>
                    {busy === `m${b.id}` ? "…" : "Message"}
                  </Text>
                </TouchableOpacity>
                {b.status === "pending" &&
                  (isBookingStale(b) ? (
                    <Text style={styles.expiredNote}>
                      {isHoldExpired(b)
                        ? "Hold expired — seats released"
                        : "Slot passed — no longer confirmable"}
                    </Text>
                  ) : (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={busy === `x${b.id}`}
                        onPress={() =>
                          run(`x${b.id}`, () => cancelBooking(b.id))
                        }
                      >
                        <Text style={styles.actionLink}>
                          {busy === `x${b.id}` ? "…" : "Decline"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={busy === `c${b.id}`}
                        onPress={() =>
                          run(`c${b.id}`, () => confirmBooking(b.id))
                        }
                      >
                        <Text style={[styles.actionLink, styles.confirmLink]}>
                          {busy === `c${b.id}` ? "…" : "Confirm"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ))}
                {b.status === "confirmed" && bookingState(b).canCancel && (
                  <Button
                    title="Cancel booking"
                    variant="danger"
                    disabled={busy !== null}
                    onPress={() =>
                      Alert.alert(
                        "Cancel this booking?",
                        "The customer will be notified and the places released.",
                        [
                          { text: "Keep booking", style: "cancel" },
                          {
                            text: "Cancel booking",
                            style: "destructive",
                            onPress: () =>
                              void run(`x${b.id}`, () => cancelBooking(b.id)),
                          },
                        ],
                      )
                    }
                  />
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  caption: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },
  chip: {
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chipSelected: { borderBottomColor: colors.accent },
  chipText: { ...typography.caption, color: colors.textDim },
  chipTextSelected: { color: colors.accent },
  row: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  topText: { flex: 1 },
  customer: { ...typography.body, color: colors.text },
  offer: { ...typography.caption, color: colors.textDim, marginTop: 2 },
  meta: { ...typography.caption, color: colors.textDim, marginTop: spacing.sm },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  actionLink: { ...typography.bodySmall, color: colors.textDim },
  confirmLink: { color: colors.accent, fontWeight: "600" },
  gap: { width: spacing.sm },
  expiredNote: {
    ...typography.caption,
    color: colors.textFaint,
    fontStyle: "italic",
  },
});
