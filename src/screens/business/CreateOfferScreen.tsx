import { DateSheet, TimeSheet } from "../../components/DateTimeSheets";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
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
} from "../../services/offers";
import { validateOfferInput } from "../../utils/validation";
import { BusinessTabParamList } from "../../navigation/types";

type Props = {
  navigation: { navigate: (screen: keyof BusinessTabParamList) => void };
};

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

/**
 * Create an offer: save as draft, then publish. Publishing is gated
 * server-side — only verified businesses go live.
 */
export function CreateOfferScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discount, setDiscount] = useState("");
  const [price, setPrice] = useState("");
  const [startsAtDate, setStartsAtDate] = useState<Date | null>(null);
  const [endsAtDate, setEndsAtDate] = useState<Date | null>(null);
  const [picker, setPicker] = useState<{
    field: "startsAt" | "endsAt";
    mode: "date" | "time";
  } | null>(null);
  const [capacity, setCapacity] = useState("10");
  const [duration, setDuration] = useState("60");
  const [resource, setResource] = useState("Main");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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

  const buildInput = (): NewOfferInput | null => {
    setFormError("");
    if (!startsAtDate || !endsAtDate) {
      setFormError("Pick a start and end for the booking window.");
      return null;
    }
    const startsAt = startsAtDate;
    const endsAt = endsAtDate;
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
    const err = validateOfferInput(input);
    if (err) {
      setFormError(err);
      return null;
    }
    return input;
  };

  const onSaveDraft = async () => {
    const input = buildInput();
    if (!input) return;
    setSaving(true);
    try {
      await createDraft(profile.id, input);
      Alert.alert(
        "Draft saved",
        "Find it under Business → My offers to publish when ready.",
      );
      navigation.navigate("Dashboard");
    } catch (e) {
      Alert.alert(
        "Could not save",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    const input = buildInput();
    if (!input) return;
    setSaving(true);
    try {
      const draft = await createDraft(profile.id, input);
      await publishOffer(draft.id);
      Alert.alert("Offer live", "Customers can now book it.");
      navigation.navigate("Dashboard");
    } catch (e) {
      Alert.alert(
        "Could not publish",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const applyPicked = (d: Date) => {
    if (!picker) return;
    if (picker.field === "startsAt") setStartsAtDate(d);
    else setEndsAtDate(d);
  };

  return (
    <Screen keyboard>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeading
          greeting="A hello from your business."
          title={"A good offer.\nA new face."}
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
        <Input
          label="Places per slot"
          placeholder="10"
          value={capacity}
          onChangeText={(t: string) => setCapacity(t.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
        />

        <Input
          label="Slot duration (minutes)"
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
        />
        <Input
          label="Staff member or space"
          value={resource}
          onChangeText={setResource}
        />
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Button
          title="Save draft"
          variant="secondary"
          onPress={onSaveDraft}
          loading={saving}
          style={styles.btn}
        />
        <Button
          title="Publish now"
          onPress={onPublish}
          loading={saving}
          disabled={!verified}
          style={styles.btn}
        />
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
  note: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.lg,
    textAlign: "center",
  },
});
