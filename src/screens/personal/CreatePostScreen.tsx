import React, { useEffect, useState } from "react";
import { DateSheet, TimeSheet } from "../../components/DateTimeSheets";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PageHeading } from "../../components/PageHeading";
import { Screen } from "../../components/Screen";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { PersonalTabNav } from "../../navigation/types";
import { createPost } from "../../services/posts";
import { searchVenues } from "../../services/venues";
import { Venue } from "../../services/mappers";
import { validatePostDraft } from "../../utils/validation";

const TAG_OPTIONS = [
  "sports",
  "music",
  "food",
  "games",
  "outdoors",
  "social",
  "movies",
  "culture",
];

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

export function CreatePostScreen() {
  const { profile, demoMode } = useAuth();
  const navigation = useNavigation<PersonalTabNav>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venueQuery, setVenueQuery] = useState("");
  const [venueResults, setVenueResults] = useState<Venue[]>([]);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [startsAtDate, setStartsAtDate] = useState<Date | null>(null);
  const [expiresAtDate, setExpiresAtDate] = useState<Date | null>(null);
  const [picker, setPicker] = useState<{
    field: "startsAt" | "expiresAt";
    mode: "date" | "time";
  } | null>(null);
  const [vacancies, setVacancies] = useState(2);
  const [cost, setCost] = useState("");

  const [tags, setTags] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let live = true;
    const q = venueQuery.trim();
    if (!q || venue) {
      if (live) setVenueResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await searchVenues(q);
        if (live) setVenueResults(res.slice(0, 5));
      } catch {
        if (live) setVenueResults([]);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [venueQuery, venue]);

  if (!profile && !demoMode) {
    return (
      <Screen keyboard>
        <EmptyState title="Sign in required" hint="Log in to create a post." />
      </Screen>
    );
  }

  const toggleTag = (tag: string) =>
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const applyPicked = (d: Date) => {
    if (!picker) return;
    if (picker.field === "startsAt") setStartsAtDate(d);
    else setExpiresAtDate(d);
  };

  const handlePublish = async () => {
    setFormError("");
    if (!startsAtDate) {
      setFormError("Pick a date and time for your post.");
      return;
    }
    const startsAt = startsAtDate;
    const expiresAt = expiresAtDate;
    const costCents = cost.trim()
      ? Math.round(Number(cost.trim()) * 100)
      : undefined;
    if (
      cost.trim() &&
      (!Number.isFinite(Number(cost.trim())) || Number(cost.trim()) < 0)
    ) {
      setFormError("Cost must be a non-negative number, or leave it empty.");
      return;
    }
    const err = validatePostDraft({
      title,
      description,
      startsAt,
      expiresAt,
      vacancies,
      costCents,
    });
    if (err) {
      setFormError(err);
      return;
    }
    setPublishing(true);
    try {
      const post = await createPost(profile?.id ?? "demo-user", {
        title: title.trim(),
        description: description.trim(),
        venueId: venue?.id,
        venueName: venue?.name,
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt?.toISOString(),
        vacancies,
        costCents,
        tags,
      });
      setTitle("");
      setDescription("");
      setVenue(null);
      setVenueQuery("");
      setStartsAtDate(null);
      setExpiresAtDate(null);
      setVacancies(2);
      setCost("");
      setTags([]);
      navigation.navigate("PostDetails", { postId: post.id });
    } catch (e) {
      Alert.alert(
        "Failed to publish",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setPublishing(false);
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
          greeting="Someone nearby might be up for it."
          title={"Start with\na little hello."}
        />

        <Input
          label="What’s the plan?"
          placeholder="Anyone for badminton this evening?"
          value={title}
          onChangeText={setTitle}
        />

        <Input
          label="A few details"
          placeholder="What, where, level — the details people need"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />

        <Text style={styles.fieldLabel}>Venue (optional)</Text>
        {venue ? (
          <View style={styles.venuePick}>
            <Text style={styles.venuePickText}>
              {venue.name} · {venue.area}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setVenue(null);
                setVenueQuery("");
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.venueClear}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Input
              label=""
              placeholder="Search venues…"
              value={venueQuery}
              onChangeText={setVenueQuery}
            />
            {venueResults.map((v) => (
              <TouchableOpacity
                key={v.id}
                activeOpacity={0.8}
                style={styles.venueRow}
                onPress={() => setVenue(v)}
              >
                <Text style={styles.venueName}>{v.name}</Text>
                <Text style={styles.venueMeta}>
                  {v.category} · {v.area}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={styles.row}>
          <DateTimeField
            label="Date"
            value={startsAtDate ? fmtDate(startsAtDate) : null}
            placeholder="Pick date"
            onPress={() => setPicker({ field: "startsAt", mode: "date" })}
          />
          <DateTimeField
            label="Time"
            value={startsAtDate ? fmtTime(startsAtDate) : null}
            placeholder="Pick time"
            onPress={() => setPicker({ field: "startsAt", mode: "time" })}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Cost (optional)"
              placeholder="₹ per person"
              value={cost}
              onChangeText={(t: string) => setCost(t.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.fieldLabel}>Spots</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                activeOpacity={0.8}
                onPress={() => setVacancies((v) => Math.max(1, v - 1))}
              >
                <Text style={styles.stepText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{vacancies}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                activeOpacity={0.8}
                onPress={() => setVacancies((v) => Math.min(100, v + 1))}
              >
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Requests close (optional)</Text>
          {expiresAtDate && (
            <TouchableOpacity onPress={() => setExpiresAtDate(null)}>
              <Text style={styles.clearBtn}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.row}>
          <DateTimeField
            label="Date"
            value={expiresAtDate ? fmtDate(expiresAtDate) : null}
            placeholder="Pick date"
            onPress={() => setPicker({ field: "expiresAt", mode: "date" })}
          />
          <DateTimeField
            label="Time"
            value={expiresAtDate ? fmtTime(expiresAtDate) : null}
            placeholder="Pick time"
            onPress={() => setPicker({ field: "expiresAt", mode: "time" })}
          />
        </View>
        {picker?.mode === "date" && (
          <DateSheet
            visible
            value={picker.field === "startsAt" ? startsAtDate : expiresAtDate}
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
            value={picker.field === "startsAt" ? startsAtDate : expiresAtDate}
            onPick={applyPicked}
            onClose={() => setPicker(null)}
          />
        )}

        <Text style={styles.fieldLabel}>Tags</Text>
        <View style={styles.chips}>
          {TAG_OPTIONS.map((tag) => {
            const selected = tags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => toggleTag(tag)}
                activeOpacity={0.8}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  #{tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Button
          title="Publish"
          onPress={handlePublish}
          loading={publishing}
          style={styles.publish}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: {
    ...typography.display,
    fontSize: 32,
    color: colors.text,
    marginTop: spacing.sm,
  },
  caption: {
    ...typography.body,
    color: colors.textDim,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  multiline: { height: 110, textAlignVertical: "top", paddingTop: spacing.md },
  fieldLabel: {
    ...typography.body,
    color: colors.textDim,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  half: { flex: 1 },
  venuePick: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.red,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  venuePickText: { ...typography.body, color: colors.text },
  venueClear: {
    ...typography.body,
    color: colors.textDim,
    padding: spacing.xs,
  },
  venueRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  venueName: { ...typography.body, color: colors.text },
  venueMeta: { ...typography.caption, color: colors.textDim },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
  },
  stepBtn: {
    width: 40,
    height: 44,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { ...typography.title, color: colors.text },
  stepValue: {
    ...typography.title,
    color: colors.text,
    minWidth: 24,
    textAlign: "center",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  chipSelected: { borderColor: colors.clay, backgroundColor: colors.claySoft },
  chipText: { ...typography.bodySmall, color: colors.textDim },
  chipTextSelected: { color: colors.clayDeep, fontWeight: "600" },
  formError: {
    ...typography.body,
    color: colors.red,
    marginVertical: spacing.sm,
  },
  publish: { marginTop: spacing.md },
  pickerBox: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  pickerText: { color: colors.text, fontSize: 15 },
  pickerPlaceholder: { color: colors.textFaint },
  clearBtn: { ...typography.label, color: colors.red, marginLeft: spacing.md },
});
