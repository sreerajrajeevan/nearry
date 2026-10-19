import React, { useEffect, useRef, useState } from "react";
import { DateSheet, TimeSheet } from "../../components/DateTimeSheets";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PageHeading } from "../../components/PageHeading";
import { Screen } from "../../components/Screen";
import { PersonalHeader } from "../../components/PersonalHeader";
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
import { pickPhoto, uploadPhoto } from "../../services/photos";
import {
  MAX_POST_PHOTOS,
  PendingPostPhoto,
  savePostPhotos,
} from "../../services/postPhotos";

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
  const [genderPref, setGenderPref] = useState<
    "male" | "female" | "any" | undefined
  >(undefined);
  const [photos, setPhotos] = useState<PendingPostPhoto[]>([]);
  const [savedPostId, setSavedPostId] = useState<string | null>(null);
  const publishLock = useRef(false);

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

  const resetDraft = () => {
    setTitle("");
    setDescription("");
    setVenue(null);
    setVenueQuery("");
    setStartsAtDate(null);
    setExpiresAtDate(null);
    setVacancies(2);
    setCost("");
    setTags([]);
    setGenderPref(undefined);
    setPhotos([]);
    setSavedPostId(null);
    setFormError("");
  };
  const openSavedPost = (id: string) => {
    resetDraft();
    navigation.navigate("PostDetails", { postId: id });
  };

  const handlePublish = async () => {
    if (publishLock.current) return;
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
    const err = savedPostId
      ? null
      : validatePostDraft({
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
    publishLock.current = true;
    setPublishing(true);
    try {
      const authorId = profile?.id ?? "demo-user";
      const postId =
        savedPostId ??
        (
          await createPost(authorId, {
            title: title.trim(),
            description: description.trim(),
            venueId: venue?.id,
            venueName: venue?.name,
            startsAt: startsAt.toISOString(),
            expiresAt: expiresAt?.toISOString(),
            vacancies,
            costCents,
            tags,
            genderPreference: genderPref,
          })
        ).id;
      setSavedPostId(postId);
      const result = await savePostPhotos(postId, photos, (uri) =>
        uploadPhoto(authorId, uri, "posts"),
      );
      setPhotos(result.pending);
      if (result.pending.length) {
        setFormError(
          `Your post is published, but ${result.pending.length} photo${result.pending.length === 1 ? "" : "s"} still need saving. ${result.error}`,
        );
        return;
      }
      openSavedPost(postId);
    } catch (e) {
      Alert.alert(
        "Failed to publish",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      publishLock.current = false;
      setPublishing(false);
    }
  };

  if (savedPostId) {
    return (
      <Screen scroll>
        <PageHeading
          greeting="Your plan is saved."
          title="Finish your photos."
        />
        <Text style={styles.fieldLabel}>{title}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.formError}>
          {publishing ? "Saving photos…" : formError}
        </Text>
        <View style={styles.photoRow}>
          {photos.map(({ uri }, index) => (
            <View key={uri} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Remove unsaved photo ${index + 1}`}
                disabled={publishing}
                style={styles.thumbDelete}
                hitSlop={8}
                onPress={() =>
                  setPhotos((prev) => prev.filter((photo) => photo.uri !== uri))
                }
              >
                <Text style={styles.thumbDeleteText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <Button
          title={photos.length ? "Retry photos" : "View saved post"}
          loading={publishing}
          onPress={handlePublish}
        />
        <Button
          title="Skip remaining photos"
          variant="ghost"
          disabled={publishing}
          onPress={() => openSavedPost(savedPostId)}
        />
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <PersonalHeader />
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

        <Text style={styles.fieldLabel}>Photos (optional)</Text>
        <View style={styles.photoRow}>
          {photos.map(({ uri }, index) => (
            <View key={uri} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              <TouchableOpacity
                onPress={() =>
                  setPhotos((prev) => prev.filter((photo) => photo.uri !== uri))
                }
                style={styles.thumbDelete}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                disabled={publishing}
              >
                <Text style={styles.thumbDeleteText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add post photo"
            disabled={publishing || photos.length >= MAX_POST_PHOTOS}
            onPress={async () => {
              try {
                const uri = await pickPhoto();
                if (uri)
                  setPhotos((prev) =>
                    prev.some((photo) => photo.uri === uri) ||
                    prev.length >= MAX_POST_PHOTOS
                      ? prev
                      : [...prev, { uri }],
                  );
              } catch (e) {
                Alert.alert(
                  "Could not pick photo",
                  e instanceof Error ? e.message : "Try again.",
                );
              }
            }}
            style={styles.addThumb}
          >
            <Text style={styles.addThumbText}>
              {photos.length >= MAX_POST_PHOTOS ? "5 / 5" : "+ Add"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.photoHint}>
          Up to 5 photos · JPEG, PNG or WebP · 10 MB each
          {demoMode ? " · Demo photos stay in this session" : ""}
        </Text>

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

        <Text style={styles.fieldLabel}>Who can join (optional)</Text>
        <View style={styles.chips}>
          {(
            [
              { value: "male", label: "Men" },
              { value: "female", label: "Women" },
              { value: "any", label: "Anyone" },
            ] as const
          ).map((g) => {
            const sel = genderPref === g.value;
            return (
              <TouchableOpacity
                key={g.value}
                activeOpacity={0.7}
                onPress={() => setGenderPref(sel ? undefined : g.value)}
                style={[styles.chip, sel && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
              >
                <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
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
  photoHint: { ...typography.caption, color: colors.textDim, marginBottom: 16 },
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
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  photoWrap: { position: "relative" },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  thumbDelete: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbDeleteText: { color: "#fff", fontSize: 14, lineHeight: 18 },
  addThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addThumbText: { ...typography.label, color: colors.accent },
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
