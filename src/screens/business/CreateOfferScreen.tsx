import { parseDateTime } from "../../utils/dateTime";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { PageHeading } from "../../components/PageHeading";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import {
  createDraft,
  publishOffer,
  NewOfferInput,
  getOffer,
  updateOffer,
} from "../../services/offers";
import { validateOfferInput } from "../../utils/validation";
import { BusinessStackParamList, BusinessTabNav } from "../../navigation/types";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

type Props = { navigation: BusinessTabNav };

/**
 * Create an offer: save as draft, then publish. Publishing is gated
 * server-side — only verified businesses go live.
 */
export function CreateOfferScreen({ navigation }: Props) {
  return <OfferForm onDone={() => navigation.navigate("MyOffers")} />;
}

export function EditOfferScreen({
  route,
  navigation,
}: NativeStackScreenProps<BusinessStackParamList, "EditOffer">) {
  return (
    <OfferForm
      key={route.params.offerId}
      offerId={route.params.offerId}
      onDone={() => navigation.goBack()}
      onBack={() => navigation.goBack()}
    />
  );
}

function OfferForm({
  offerId,
  onDone,
  onBack,
}: {
  offerId?: string;
  onDone: () => void;
  onBack?: () => void;
}) {
  const { profile, demoMode } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discount, setDiscount] = useState("");
  const [price, setPrice] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState("10");
  const [duration, setDuration] = useState("60");
  const [resource, setResource] = useState("Main");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const savedDraftId = useRef<string | undefined>(offerId);
  const savingRef = useRef(false);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(!!offerId);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!offerId) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    void getOffer(offerId)
      .then((offer) => {
        if (!active) return;
        if (
          !offer ||
          (offer.businessId !== profile?.id &&
            !(demoMode && offer.businessId === "b1"))
        )
          throw new Error("Offer not found.");
        if (
          !["draft", "live"].includes(offer.status) ||
          (offer.status === "live" &&
            new Date(offer.endsAt).getTime() <= Date.now())
        )
          throw new Error("This offer has ended and can no longer be edited.");
        setTitle(offer.title);
        setDescription(offer.description);
        setDiscount(offer.discountPct == null ? "" : String(offer.discountPct));
        setPrice(
          offer.priceCents == null ? "" : String(offer.priceCents / 100),
        );
        const fields = (iso: string) => {
          const d = new Date(iso),
            pad = (n: number) => String(n).padStart(2, "0");
          return [
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
            `${pad(d.getHours())}:${pad(d.getMinutes())}`,
          ];
        };
        const start = fields(offer.startsAt),
          end = fields(offer.endsAt);
        setStartDate(start[0]);
        setStartTime(start[1]);
        setEndDate(end[0]);
        setEndTime(end[1]);
        setCapacity(String(offer.slotCapacity));
        setDuration(String(offer.slotMinutes ?? 60));
        setResource(offer.resourceKey ?? "default");
        setLive(offer.status === "live");
        savedDraftId.current = offer.id;
      })
      .catch((e) => {
        if (active)
          setLoadError(
            e instanceof Error ? e.message : "Could not load offer.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [offerId, profile?.id, retry, demoMode]);
  const reset = () => {
    if (offerId) return;
    savedDraftId.current = undefined;
    setTitle("");
    setDescription("");
    setDiscount("");
    setPrice("");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setCapacity("10");
    setDuration("60");
    setResource("Main");
  };
  const verified = profile?.verificationStatus === "verified";

  if (!profile) {
    return (
      <Screen keyboard>
        <EmptyState
          title="Sign in required"
          hint="Log in as a business to create offers."
        />
      </Screen>
    );
  }

  if (loading || loadError)
    return (
      <Screen scroll>
        {loading ? (
          <Text style={styles.note}>Loading offer…</Text>
        ) : (
          <>
            <EmptyState title="Couldn’t open this offer" hint={loadError} />
            <Button title="Retry" onPress={() => setRetry((n) => n + 1)} />
          </>
        )}
        {onBack && <Button title="Go back" variant="ghost" onPress={onBack} />}
      </Screen>
    );

  const buildInput = (): NewOfferInput | null => {
    setFormError("");
    const startsAt = parseDateTime(startDate, startTime);
    const endsAt = parseDateTime(endDate, endTime);
    if (!startsAt || !endsAt) {
      setFormError("Enter dates as YYYY-MM-DD and times as HH:MM (24h).");
      return null;
    }
    const discountPct = discount.trim() ? Number(discount.trim()) : undefined;
    const priceCents = price.trim()
      ? Math.round(Number(price.trim()) * 100)
      : undefined;
    const input: NewOfferInput = {
      title,
      description,
      discountPct,
      priceCents,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      slotCapacity: Number(capacity),
      slotMinutes: Number(duration),
      resourceKey: resource.trim(),
    };
    const err = validateOfferInput(input, { allowStarted: live });
    if (err) {
      setFormError(err);
      return null;
    }
    return input;
  };

  const persist = async (input: NewOfferInput) => {
    if (savedDraftId.current)
      return updateOffer(
        savedDraftId.current,
        live
          ? {
              title: input.title,
              description: input.description,
              discountPct: input.discountPct ?? null,
              priceCents: input.priceCents ?? null,
            }
          : {
              ...input,
              discountPct: input.discountPct ?? null,
              priceCents: input.priceCents ?? null,
            },
      );
    const draft = await createDraft(profile.id, input);
    // Retain this ID if publishing fails, so retry updates the same draft.
    savedDraftId.current = draft.id;
    return draft;
  };
  const save = async (publish: boolean) => {
    if (savingRef.current) return;
    const input = buildInput();
    if (!input) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const draft = await persist(input);
      if (publish) await publishOffer(draft.id);
      reset();
      onDone();
    } catch (e) {
      setFormError(
        (e instanceof Error ? e.message : "Please try again.") +
          (publish && savedDraftId.current
            ? " Your draft is saved; retry here or open My offers."
            : ""),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen keyboard>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {onBack && <Button title="← Back" variant="ghost" onPress={onBack} />}
        <PageHeading
          greeting="A hello from your business."
          title={offerId ? "Edit offer" : "A good offer.\nA new face."}
        />
        <View style={styles.statusRow}>
          <Badge
            label={
              verified ? "VERIFIED — CAN PUBLISH" : "UNVERIFIED — DRAFTS ONLY"
            }
            tone={verified ? "green" : "red"}
          />
        </View>

        <Input
          label="Title"
          placeholder="A fresh haircut, just around the corner"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Description"
          placeholder="What's included, fine print, how to redeem"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Discount (%)"
              placeholder="20"
              value={discount}
              onChangeText={(t: string) =>
                setDiscount(t.replace(/[^0-9]/g, ""))
              }
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Price (₹)"
              placeholder="499"
              value={price}
              onChangeText={(t: string) => setPrice(t.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Text style={styles.fieldLabel}>Booking window</Text>
        {live && (
          <Text style={styles.note}>
            This offer is live. Its time slots and capacity stay fixed; you can
            update the title, description and price.
          </Text>
        )}
        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Start date"
              placeholder="YYYY-MM-DD"
              value={startDate}
              editable={!live && !saving}
              onChangeText={setStartDate}
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Start time"
              placeholder="HH:MM"
              value={startTime}
              editable={!live && !saving}
              onChangeText={setStartTime}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="End date"
              placeholder="YYYY-MM-DD"
              value={endDate}
              editable={!live && !saving}
              onChangeText={setEndDate}
            />
          </View>
          <View style={styles.half}>
            <Input
              label="End time"
              placeholder="HH:MM"
              value={endTime}
              editable={!live && !saving}
              onChangeText={setEndTime}
            />
          </View>
        </View>
        <Input
          label="Places per slot"
          placeholder="10"
          value={capacity}
          editable={!live && !saving}
          onChangeText={(t: string) => setCapacity(t.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
        />

        <Input
          label="Slot duration (minutes)"
          value={duration}
          editable={!live && !saving}
          onChangeText={setDuration}
          keyboardType="number-pad"
        />
        <Input
          label="Staff member or space"
          value={resource}
          editable={!live && !saving}
          onChangeText={setResource}
        />
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Button
          title={
            live
              ? "Save changes"
              : offerId
                ? "Save draft changes"
                : "Save draft"
          }
          variant="secondary"
          onPress={() => void save(false)}
          loading={saving}
          style={styles.btn}
        />
        {!live && (
          <Button
            title="Publish now"
            onPress={() => void save(true)}
            loading={saving}
            disabled={!verified}
            style={styles.btn}
          />
        )}
        {!verified && (
          <Text style={styles.note}>
            Publishing needs a verified business. Drafts are safe to create
            anytime — submit your documents from the Business tab.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  statusRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  multiline: { height: 110, textAlignVertical: "top", paddingTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
  fieldLabel: {
    ...typography.label,
    color: colors.textDim,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  formError: {
    ...typography.body,
    color: colors.red,
    marginVertical: spacing.sm,
  },
  btn: { marginTop: spacing.md },
  note: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.lg,
    textAlign: "center",
  },
});
