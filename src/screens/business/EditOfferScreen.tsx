import { DateSheet, TimeSheet } from "../../components/DateTimeSheets";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing } from "../../theme";
import { BusinessStackParamList } from "../../navigation/types";
import { getOffer, updateOffer, publishOffer } from "../../services/offers";
import { useAuth } from "../../store/AuthContext";
import { Offer } from "../../services/mappers";
import {
  validateOfferInput,
  validateLiveOfferPatch,
} from "../../utils/validation";

type Props = NativeStackScreenProps<BusinessStackParamList, "EditOffer">;

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (d: Date) => {
  const h = d.getHours();
  const p = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(d.getMinutes())} ${p}`;
};

function DateTimeField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.half}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.pickerBox}
        activeOpacity={0.8}
        onPress={onPress}
      >
        <Text style={[styles.pickerText, !value && styles.pickerPlaceholder]}>
          {value ?? placeholder}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** Edit a draft (all fields) or a live offer (title, description, price only). */
export function EditOfferScreen({ route, navigation }: Props) {
  const { offerId } = route.params;
  const { profile, demoMode } = useAuth();
  const request = useRef(0);
  const savingLock = useRef(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discount, setDiscount] = useState("");
  const [price, setPrice] = useState("");
  const [startsAtDate, setStartsAtDate] = useState<Date | null>(null);
  const [endsAtDate, setEndsAtDate] = useState<Date | null>(null);
  const [capacity, setCapacity] = useState("10");
  const [duration, setDuration] = useState("60");
  const [resource, setResource] = useState("Main");
  const [picker, setPicker] = useState<{
    field: "startsAt" | "endsAt";
    mode: "date" | "time";
  } | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const ticket = ++request.current;
    setState("loading");
    try {
      const o = await getOffer(offerId);
      if (ticket !== request.current) return;
      if (
        o &&
        o.businessId !== profile?.id &&
        !(demoMode && o.businessId === "b1")
      )
        throw new Error("Not your offer.");
      if (
        !o ||
        (o.status !== "draft" && o.status !== "live") ||
        (o.status === "live" && new Date(o.endsAt).getTime() <= Date.now())
      )
        throw new Error("This offer can't be edited.");
      setOffer(o);
      setTitle(o.title);
      setDescription(o.description);
      setDiscount(
        typeof o.discountPct === "number" ? String(o.discountPct) : "",
      );
      setPrice(
        typeof o.priceCents === "number" ? String(o.priceCents / 100) : "",
      );
      setStartsAtDate(new Date(o.startsAt));
      setEndsAtDate(new Date(o.endsAt));
      setCapacity(String(o.slotCapacity));
      setDuration(String(o.slotMinutes ?? 60));
      setResource(o.resourceKey ?? "Main");
      setState("ready");
    } catch (e) {
      if (ticket === request.current) setState("error");
    }
  }, [offerId, profile?.id, demoMode]);

  useEffect(() => {
    void load();
    return () => {
      ++request.current;
    };
  }, [load]);

  if (state === "loading") {
    return (
      <Screen>
        <Text style={styles.status}>Loading…</Text>
      </Screen>
    );
  }
  if (state === "error" || !offer) {
    return (
      <Screen>
        <EmptyState
          title="Couldn't load this offer"
          hint="It may have been deleted."
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

  const isLive = offer.status === "live";

  const buildPatch = () => {
    const patch: {
      title: string;
      description: string;
      discountPct?: number | null;
      priceCents?: number | null;
      startsAt?: string;
      endsAt?: string;
      slotCapacity?: number;
      slotMinutes?: number;
      resourceKey?: string;
    } = { title: title.trim(), description: description.trim() };
    // Empty + previously set → null (clear). Empty + never set → skip.
    const d = discount.trim();
    patch.discountPct = d
      ? Number(d)
      : typeof offer.discountPct === "number"
        ? null
        : undefined;
    const pr = price.trim();
    patch.priceCents = pr
      ? Math.round(Number(pr) * 100)
      : typeof offer.priceCents === "number"
        ? null
        : undefined;
    if (!isLive) {
      if (!startsAtDate || !endsAtDate) {
        setFormError("Pick a start and end for the booking window.");
        return null;
      }
      patch.startsAt = startsAtDate.toISOString();
      patch.endsAt = endsAtDate.toISOString();
      patch.slotCapacity = Number(capacity) || 10;
      patch.slotMinutes = Number(duration) || 60;
      patch.resourceKey = resource.trim() || "Main";
    }
    const err = isLive
      ? validateLiveOfferPatch({
          title: patch.title,
          description: patch.description,
          discountPct: patch.discountPct,
          priceCents: patch.priceCents,
        })
      : validateOfferInput({
          title: patch.title,
          description: patch.description,
          discountPct: patch.discountPct,
          priceCents: patch.priceCents,
          startsAt: patch.startsAt ?? offer.startsAt,
          endsAt: patch.endsAt ?? offer.endsAt,
          slotCapacity: patch.slotCapacity ?? offer.slotCapacity,
          slotMinutes: patch.slotMinutes ?? offer.slotMinutes ?? 60,
          resourceKey: patch.resourceKey ?? offer.resourceKey ?? "Main",
        });
    if (err) {
      setFormError(err);
      return null;
    }
    return patch;
  };

  const applyPicked = (d: Date) => {
    if (!picker) return;
    if (picker.field === "startsAt") setStartsAtDate(d);
    else setEndsAtDate(d);
  };

  const onSave = async (andPublish: boolean) => {
    if (savingLock.current) return;
    setFormError("");
    const patch = buildPatch();
    if (!patch) return;
    if (andPublish) {
      const endsAt = patch.endsAt ?? offer.endsAt;
      if (new Date(endsAt).getTime() <= Date.now()) {
        setFormError(
          "This draft's booking window has passed. Pick new dates before publishing.",
        );
        return;
      }
    }
    savingLock.current = true;
    setSaving(true);
    try {
      await updateOffer(offer.id, patch);
      if (andPublish) await publishOffer(offer.id);
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        andPublish ? "Could not publish" : "Could not save",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      savingLock.current = false;
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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.back}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Edit offer.</Text>
        {isLive && (
          <Text style={styles.liveNote}>
            Live offers can change their title, description and price — the
            booking window stays fixed once customers can book.
          </Text>
        )}

        <Input label="Title" value={title} onChangeText={setTitle} />
        <Input
          label="Description"
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
              value={price}
              onChangeText={(t: string) => setPrice(t.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {!isLive && (
          <>
            <Text style={styles.fieldLabel}>Booking window</Text>
            <View style={styles.row}>
              <DateTimeField
                label="Start date"
                value={startsAtDate ? fmtDate(startsAtDate) : null}
                placeholder="Pick date"
                onPress={() => setPicker({ field: "startsAt", mode: "date" })}
              />
              <DateTimeField
                label="Start time"
                value={startsAtDate ? fmtTime(startsAtDate) : null}
                placeholder="Pick time"
                onPress={() => setPicker({ field: "startsAt", mode: "time" })}
              />
            </View>
            <View style={styles.row}>
              <DateTimeField
                label="End date"
                value={endsAtDate ? fmtDate(endsAtDate) : null}
                placeholder="Pick date"
                onPress={() => setPicker({ field: "endsAt", mode: "date" })}
              />
              <DateTimeField
                label="End time"
                value={endsAtDate ? fmtTime(endsAtDate) : null}
                placeholder="Pick time"
                onPress={() => setPicker({ field: "endsAt", mode: "time" })}
              />
            </View>
            <Input
              label="Places per slot"
              value={capacity}
              onChangeText={(t: string) =>
                setCapacity(t.replace(/[^0-9]/g, ""))
              }
              keyboardType="number-pad"
            />
            <Input
              label="Slot duration (minutes)"
              value={duration}
              onChangeText={(t: string) =>
                setDuration(t.replace(/[^0-9]/g, ""))
              }
              keyboardType="number-pad"
            />
            <Input
              label="Staff member or space"
              value={resource}
              onChangeText={setResource}
            />
          </>
        )}

        {picker?.mode === "date" && (
          <DateSheet
            visible
            value={picker.field === "startsAt" ? startsAtDate : endsAtDate}
            onPick={(d) => {
              applyPicked(d);
              setPicker(null);
            }}
            onClose={() => setPicker(null)}
          />
        )}
        {picker?.mode === "time" && (
          <TimeSheet
            visible
            value={picker.field === "startsAt" ? startsAtDate : endsAtDate}
            onPick={applyPicked}
            onClose={() => setPicker(null)}
          />
        )}

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Button
          title="Save changes"
          onPress={() => void onSave(false)}
          loading={saving}
          style={styles.btn}
        />
        {!isLive && (
          <Button
            title="Publish now"
            variant="secondary"
            onPress={() => void onSave(true)}
            loading={saving}
            style={styles.btn}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  back: { marginBottom: spacing.md, alignSelf: "flex-start" },
  backText: { ...typography.label, color: colors.textDim },
  header: {
    ...typography.display,
    fontSize: 32,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  liveNote: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginBottom: spacing.md,
  },
  multiline: { height: 110, textAlignVertical: "top", paddingTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
  fieldLabel: {
    ...typography.body,
    color: colors.textDim,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  pickerBox: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  pickerText: { color: colors.text, fontSize: 15 },
  pickerPlaceholder: { color: colors.textFaint },
  formError: {
    ...typography.body,
    color: colors.red,
    marginVertical: spacing.sm,
  },
  btn: { marginTop: spacing.md },
});
