import { LoadingState } from "../../components/LoadingState";
import { haptic } from "../../services/haptics";
import { useToast } from "../../store/ToastContext";
import { SafetyActions } from "../../components/SafetyActions";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { bookingState } from "../../utils/flowState";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing, weight } from "../../theme";
import { PersonalStackParamList } from "../../navigation/types";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../store/AuthContext";
import { getOffer } from "../../services/offers";
import {
  listOfferSlots,
  AvailableSlot,
  bookOffer,
  cancelBooking,
  listMyBookings,
  MAX_PARTY_SIZE,
  subscribeToBookings,
} from "../../services/bookings";
import { Alert } from "../../services/appAlert";
import { useMyRequests } from "../../store/MyRequestsContext";
import { Offer } from "../../services/mappers";
import { Icon } from "../../components/Icon";
import { LoadingImage } from "../../components/LoadingImage";
import { ActivityArt } from "../../components/ActivityArt";
import { activityArtwork } from "../../utils/activityArtwork";
import { formatTime, formatWhen } from "../../utils/format";

type Props = NativeStackScreenProps<PersonalStackParamList, "OfferDetails">;

function fmtINR(cents?: number): string {
  if (cents === undefined) return "";
  return `₹${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Offer details + booking. Capacity enforced atomically server-side. */
export function OfferDetailsScreen({ route, navigation }: Props) {
  const { offerId } = route.params;
  const { profile } = useAuth();
  const [daySel, setDaySel] = useState("");
  const [slotId, setSlotId] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [formError, setFormError] = useState("");
  const [booking, setBooking] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const refreshMine = useMyRequests()?.refresh;
  const toast = useToast();
  const [photoFailed, setPhotoFailed] = useState(false);
  const {
    data,
    state,
    refresh: load,
  } = useLiveQuery(
    `offer:${offerId}:${profile?.id}`,
    async () => {
      const [offer, slots, bookings] = await Promise.all([
        getOffer(offerId),
        listOfferSlots(offerId),
        profile ? listMyBookings(profile.id) : Promise.resolve([]),
      ]);
      if (!offer) throw new Error("Offer not found.");
      return { offer, slots, bookings };
    },
    subscribeToBookings,
  );
  const offer = data?.offer,
    slots = data?.slots ?? [];
  // My upcoming, still-active bookings for this offer (one per day at most).
  const mine = useMemo(
    () =>
      (data?.bookings ?? [])
        .filter((b) => b.offerId === offerId && bookingState(b).canCancel)
        .sort((a, b) => Date.parse(a.slot) - Date.parse(b.slot)),
    [data, offerId],
  );

  const dayKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  /** Slots grouped by local calendar day, earliest first. */
  const days = useMemo(() => {
    const map = new Map<
      string,
      { key: string; date: Date; slots: AvailableSlot[] }
    >();
    for (const s of [...slots].sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )) {
      const k = dayKey(s.starts_at);
      let g = map.get(k);
      if (!g) {
        const d = new Date(s.starts_at);
        g = {
          key: k,
          date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
          slots: [],
        };
        map.set(k, g);
      }
      g.slots.push(s);
    }
    return [...map.values()];
  }, [slots]);

  const bookedDays = useMemo(
    () => new Set(mine.map((b) => dayKey(b.slot))),
    [mine],
  );
  // Days I can still book: not already booked by me.
  const bookableDays = days.filter((d) => !bookedDays.has(d.key));
  const activeDay =
    days.find((d) => d.key === daySel && !bookedDays.has(d.key)) ??
    days.find((d) => !bookedDays.has(d.key));

  const onSelectDay = (key: string) => {
    setDaySel(key);
    const g = days.find((d) => d.key === key);
    setSlotId(g?.slots.find((s) => s.seats_left > 0)?.id ?? "");
    setPartySize(1);
  };

  useEffect(() => {
    setPartySize(1);
    setSlotId("");
    setDaySel("");
  }, [offerId]);
  useEffect(() => {
    if (!data) return;
    const open = (s: AvailableSlot) =>
      s.seats_left > 0 && !bookedDays.has(dayKey(s.starts_at));
    const selected =
      data.slots.find((s) => s.id === slotId && open(s)) ??
      data.slots.find(open);
    setSlotId(selected?.id ?? "");
    if (selected) {
      setDaySel(dayKey(selected.starts_at));
      setPartySize((size) =>
        Math.max(1, Math.min(size, selected.seats_left, MAX_PARTY_SIZE)),
      );
    }
  }, [data, bookedDays]);

  const onBook = async () => {
    if (booking) return;
    setFormError("");
    if (!profile) {
      setFormError("Sign in to book.");
      return;
    }
    const slot = slots.find((s) => s.id === slotId);
    if (!slot || slot.seats_left < partySize) {
      setFormError("Choose an available slot with enough seats.");
      return;
    }
    setBooking(true);
    try {
      await bookOffer(offerId, slot.id, partySize);
      haptic("success");
      void refreshMine?.();
      toast(
        `Booking requested · ${offer?.businessName ?? "The business"} will confirm`,
        "clock",
      );
      await load(true);
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Could not book. Please try again.",
      );
      await load(true);
    } finally {
      setBooking(false);
    }
  };

  const onCancel = (bookingId: string) =>
    Alert.alert("Cancel this booking?", "Your place will be released.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel booking",
        style: "destructive",
        onPress: () => {
          setCancelling(bookingId);
          void cancelBooking(bookingId)
            .then(() => {
              void refreshMine?.();
              toast("Booking cancelled", "x");
              return load(true);
            })
            .catch((e) =>
              setFormError(
                e instanceof Error ? e.message : "Could not cancel. Try again.",
              ),
            )
            .finally(() => setCancelling(null));
        },
      },
    ]);

  if (state === "loading") {
    return (
      <Screen padded>
        <LoadingState label="Loading this offer…" layout="detail" />
      </Screen>
    );
  }
  if (state === "error" || !offer) {
    return (
      <Screen padded>
        <EmptyState
          title="Couldn't load this offer"
          hint="It may have ended."
        />
        <Button title="Retry" onPress={() => void load()} />
        <Button
          title="Go back"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const ends = new Date(offer.endsAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  const headline =
    typeof offer.discountPct === "number" && offer.discountPct > 0
      ? `${offer.discountPct}% OFF`
      : offer.priceCents === 0
        ? "FREE"
        : null;
  return (
    <Screen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          {offer.coverPhotoUrl && !photoFailed ? (
            <LoadingImage
              source={{ uri: offer.coverPhotoUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <View style={styles.heroArt}>
              <ActivityArt
                artwork={activityArtwork({
                  title: offer.title,
                  description: `${offer.description} ${offer.businessName}`,
                })}
                size={120}
              />
            </View>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            style={styles.back}
          >
            <Icon name="arrow-left" size={20} color={colors.ink} />
          </TouchableOpacity>
          {headline && (
            <View style={styles.discount}>
              <Text style={styles.discountText}>{headline}</Text>
            </View>
          )}
        </View>
        <View style={styles.sheet}>
          <View style={styles.businessRow}>
            <View style={styles.businessMark}>
              <Text style={styles.businessInitials}>
                {offer.businessName
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase()}
              </Text>
            </View>
            <Text style={styles.business} numberOfLines={2}>
              {offer.businessName}
            </Text>
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {offer.title}
          </Text>
          {!!offer.description && (
            <Text style={styles.desc}>{offer.description}</Text>
          )}
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Icon name="calendar" size={14} color={colors.amberDeep} />
              <Text style={styles.metaChipText}>Till {ends}</Text>
            </View>
            {offer.priceCents !== undefined && (
              <View style={styles.metaChip}>
                <Icon name="tag" size={14} color={colors.amberDeep} />
                <Text style={styles.metaChipText}>
                  {offer.priceCents === 0 ? "Free" : fmtINR(offer.priceCents)}
                </Text>
              </View>
            )}
            <View style={styles.metaChip}>
              <Icon name="users" size={14} color={colors.amberDeep} />
              <Text style={styles.metaChipText}>
                {offer.slotCapacity}{" "}
                {offer.slotCapacity === 1 ? "place" : "places"} per slot
              </Text>
            </View>
          </View>

          {mine.length > 0 && (
            <View style={styles.mineBox}>
              <Text style={styles.sectionTitle}>
                {mine.length === 1 ? "YOUR BOOKING" : "YOUR BOOKINGS"}
              </Text>
              {mine.map((b) => (
                <View key={b.id} style={styles.mineRow}>
                  <View style={styles.mineIcon}>
                    <Icon
                      name={b.status === "confirmed" ? "check" : "clock"}
                      size={18}
                      color={
                        b.status === "confirmed"
                          ? colors.success
                          : colors.amberDeep
                      }
                    />
                  </View>
                  <View style={styles.mineCopy}>
                    <Text style={styles.mineWhen}>
                      {formatWhen(b.slot)} · {b.partySize}{" "}
                      {b.partySize === 1 ? "person" : "people"}
                    </Text>
                    <Text style={styles.mineStatus}>
                      {b.status === "confirmed"
                        ? "Confirmed by the business"
                        : `Waiting for ${offer.businessName} to confirm${
                            b.holdExpiresAt
                              ? ` · held till ${formatTime(b.holdExpiresAt)}`
                              : ""
                          }`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel booking for ${formatWhen(b.slot)}`}
                    disabled={cancelling !== null}
                    onPress={() => onCancel(b.id)}
                    hitSlop={8}
                  >
                    <Text style={styles.mineCancel}>
                      {cancelling === b.id ? "…" : "Cancel"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={styles.mineNote}>
                {bookableDays.length
                  ? "One booking per day for this offer. Pick another day below, or cancel to change your time."
                  : "One booking per day for this offer. To change your time, cancel and pick another slot."}
              </Text>
            </View>
          )}
          {offer.status !== "live" ||
          new Date(offer.endsAt).getTime() <= Date.now() ? (
            <EmptyState
              title="This offer isn't live"
              hint="Check back for the next one."
            />
          ) : mine.length > 0 && bookableDays.length === 0 ? null : (
            <View style={styles.bookBox}>
              <Text style={styles.sectionTitle}>
                {mine.length ? "BOOK ANOTHER DAY" : "CHOOSE A DAY"}
              </Text>
              {days.length === 0 && (
                <Text style={{ color: colors.textDim }}>
                  No upcoming slots are available.
                </Text>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayStrip}
              >
                {days.map((d) => {
                  const sel = d.key === activeDay?.key;
                  const booked = bookedDays.has(d.key);
                  const open = !booked && d.slots.some((s) => s.seats_left > 0);
                  return (
                    <TouchableOpacity
                      key={d.key}
                      activeOpacity={0.8}
                      disabled={booked}
                      onPress={() => onSelectDay(d.key)}
                      style={[styles.dayPill, sel && styles.dayPillSel]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sel, disabled: booked }}
                    >
                      <Text style={[styles.dayDow, sel && styles.dayDowSel]}>
                        {d.date.toLocaleDateString("en-US", {
                          weekday: "short",
                        })}
                      </Text>
                      <Text style={[styles.dayNum, sel && styles.dayTextSel]}>
                        {d.date.getDate()}
                      </Text>
                      <Text
                        style={[
                          styles.daySub,
                          sel && styles.dayTextSel,
                          !open && styles.dayFull,
                        ]}
                      >
                        {booked ? "Booked" : open ? "" : "Full"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.sectionTitle}>CHOOSE A TIME</Text>
              <View style={styles.slotGrid}>
                {(activeDay?.slots ?? []).map((slot) => {
                  const sel = slot.id === slotId;
                  const out = slot.seats_left < 1;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      disabled={out}
                      onPress={() => {
                        setSlotId(slot.id);
                        setPartySize(1);
                      }}
                      style={[
                        styles.slotChip,
                        sel && styles.slotChipSel,
                        out && styles.slotChipOut,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sel, disabled: out }}
                    >
                      <Text
                        style={[
                          styles.slotTime,
                          sel && styles.slotTextSel,
                          out && styles.slotTextOut,
                        ]}
                      >
                        {formatTime(slot.starts_at)}
                      </Text>
                      <Text
                        style={[
                          styles.slotSeats,
                          sel && styles.slotTextSel,
                          out && styles.slotTextOut,
                        ]}
                      >
                        {out ? "Full" : `${slot.seats_left} left`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.sectionTitle}>PEOPLE</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Fewer people"
                  style={styles.stepBtn}
                  activeOpacity={0.8}
                  onPress={() => setPartySize((v) => Math.max(1, v - 1))}
                >
                  <Icon name="minus" size={18} color={colors.ink} />
                </TouchableOpacity>
                <Text style={styles.stepValue}>{partySize}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="More people"
                  style={[styles.stepBtn, styles.stepBtnPlus]}
                  activeOpacity={0.8}
                  onPress={() =>
                    setPartySize((v) =>
                      Math.min(
                        MAX_PARTY_SIZE,
                        slots.find((s) => s.id === slotId)?.seats_left ??
                          offer.slotCapacity,
                        v + 1,
                      ),
                    )
                  }
                >
                  <Icon name="plus" size={18} color={colors.onAccent} />
                </TouchableOpacity>
              </View>
              {formError ? (
                <Text style={styles.formError}>{formError}</Text>
              ) : null}
              <Button
                title="Request this slot"
                disabled={
                  !slotId ||
                  !slots.some(
                    (s) => s.id === slotId && s.seats_left >= partySize,
                  )
                }
                onPress={onBook}
                loading={booking}
                style={styles.bookBtn}
              />
              <Text style={styles.note}>
                Up to {MAX_PARTY_SIZE} people per booking. Your place is held
                for up to 30 minutes while the business confirms. No payment is
                collected here.
              </Text>
            </View>
          )}
          <View style={styles.safety}>
            <SafetyActions
              target={{
                kind: "offer",
                id: offer.id,
                userId: offer.businessId,
                name: offer.businessName,
              }}
              onReport={() =>
                navigation.navigate("Report", {
                  target: { kind: "offer", id: offer.id, name: offer.title },
                })
              }
              onBlocked={() => navigation.goBack()}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl * 2 },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  hero: { height: 250, backgroundColor: "#1F2937", overflow: "hidden" },
  heroArt: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    position: "absolute",
    top: 14,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  discount: {
    position: "absolute",
    left: 20,
    bottom: 42,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.amberBright,
  },
  discountText: {
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.4,
    color: colors.onAmber,
    ...weight("800"),
  },
  sheet: {
    marginTop: -28,
    paddingHorizontal: 20,
    paddingTop: 22,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.background,
  },
  businessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  businessMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.night,
    alignItems: "center",
    justifyContent: "center",
  },
  businessInitials: {
    fontSize: 14,
    color: colors.amberBright,
    ...weight("800"),
  },
  business: { ...typography.heading, fontSize: 16, color: colors.ink, flex: 1 },
  title: { ...typography.title, color: colors.ink },
  desc: {
    ...typography.body,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
  },
  metaChipText: { ...typography.label, fontSize: 12, color: colors.ink },
  safety: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bookBox: { marginTop: spacing.xl },
  sectionTitle: {
    ...typography.label,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.faint,
    ...weight("800"),
    marginBottom: 10,
  },
  dayStrip: { gap: spacing.sm, paddingBottom: spacing.md },
  dayPill: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  dayPillSel: { backgroundColor: colors.night, borderColor: colors.night },
  dayDow: { ...typography.caption, color: colors.textDim },
  dayNum: { ...typography.title, color: colors.text },
  daySub: { ...typography.caption, color: colors.textFaint, minHeight: 14 },
  dayTextSel: { color: colors.onAccent },
  dayDowSel: { color: colors.amberBright },
  dayFull: { color: colors.textFaint },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  slotChip: {
    minWidth: "30%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  slotChipSel: {
    backgroundColor: colors.amberBright,
    borderColor: colors.amberBright,
  },
  slotChipOut: { opacity: 0.45 },
  slotTime: { ...typography.body, ...weight("600"), color: colors.text },
  slotSeats: { ...typography.caption, color: colors.textDim },
  slotTextSel: { color: colors.onAmber },
  slotTextOut: { color: colors.textFaint },
  row: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
  fieldLabel: {
    ...typography.label,
    color: colors.textDim,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnPlus: { backgroundColor: colors.night, borderColor: colors.night },
  stepText: { ...typography.title, color: colors.text },
  stepValue: {
    ...typography.title,
    color: colors.text,
    minWidth: 36,
    textAlign: "center",
  },
  formError: {
    ...typography.body,
    color: colors.red,
    marginVertical: spacing.sm,
  },
  bookBtn: { marginTop: spacing.lg },
  note: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: spacing.md,
    textAlign: "center",
  },
  mineBox: { marginTop: spacing.xl },
  mineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  mineIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
  },
  mineCopy: { flex: 1, minWidth: 0, gap: 2 },
  mineWhen: { ...typography.body, color: colors.text, ...weight("700") },
  mineStatus: { ...typography.caption, color: colors.textDim },
  mineCancel: { ...typography.label, color: colors.red, ...weight("700") },
  mineNote: { ...typography.caption, color: colors.textDim, marginTop: 4 },
});
