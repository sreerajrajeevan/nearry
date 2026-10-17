import { parseDateTime } from "../../utils/dateTime";
import React, { useState } from "react";
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
} from "../../services/offers";
import { validateOfferInput } from "../../utils/validation";
import { BusinessTabParamList } from "../../navigation/types";

type Props = {
  navigation: { navigate: (screen: keyof BusinessTabParamList) => void };
};

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
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
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
      Alert.alert("Draft saved", "Publish it from the dashboard when ready.");
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
          <View style={styles.half}>
            <Input
              label="Start date"
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Start time"
              placeholder="HH:MM"
              value={startTime}
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
              onChangeText={setEndDate}
            />
          </View>
          <View style={styles.half}>
            <Input
              label="End time"
              placeholder="HH:MM"
              value={endTime}
              onChangeText={setEndTime}
            />
          </View>
        </View>
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
