import {
  hasPostMeetingPlace,
  requiredMeetingPlaceMessage,
} from "../../utils/postLocation";
import { Alert } from "../../services/appAlert";
import React, { useEffect, useRef, useState } from "react";
import { DateSheet, TimeSheet } from "../../components/DateTimeSheets";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { PostPhotosField } from "../../components/PostPhotosField";
import { LoadingState } from "../../components/LoadingState";
import { postState } from "../../utils/flowState";
import { PageHeading } from "../../components/PageHeading";
import { Screen } from "../../components/Screen";
import { PersonalHeader } from "../../components/PersonalHeader";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing, surfaces } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { createPost, getPost, updatePost } from "../../services/posts";
import {
  PostLocationField,
  PostMeetingSpot,
} from "../../components/PostLocationField";
import { NeedPost } from "../../services/mappers";
import { validatePostDraft } from "../../utils/validation";
import { uploadPhoto } from "../../services/photos";
import {
  EditablePostPhoto,
  listPostPhotos,
  savePhotoSelection,
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
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
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

export function PostEditor({
  postId,
  onSaved,
  onCancel,
}: {
  postId?: string;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const { profile, demoMode } = useAuth();
  const [original, setOriginal] = useState<NeedPost | null>(null);
  const [loading, setLoading] = useState(!!postId);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState<PostMeetingSpot | null>(null);
  const [unfinishedLocation, setUnfinishedLocation] = useState(false);
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
  >("any");
  const [photos, setPhotos] = useState<EditablePostPhoto[]>([]);
  const [savedPostId, setSavedPostId] = useState<string | null>(null);
  const publishLock = useRef(false);

  const [tags, setTags] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!postId) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    void Promise.all([getPost(postId), listPostPhotos(postId)])
      .then(([post, savedPhotos]) => {
        if (!active) return;
        if (!post) throw new Error("Post not found.");
        if (!profile || post.authorId !== profile.id)
          throw new Error("Only the host can edit this post.");
        if (!postState(post).canEdit)
          throw new Error("Only upcoming, open posts can be edited.");
        setOriginal(post);
        setTitle(post.title);
        setDescription(post.description);
        setStartsAtDate(new Date(post.startsAt));
        setExpiresAtDate(post.expiresAt ? new Date(post.expiresAt) : null);
        setVacancies(post.vacancies);
        setCost(post.costCents == null ? "" : String(post.costCents / 100));
        setTags(post.tags);
        setGenderPref(post.genderPreference ?? "any");
        if (post.venueId || post.venueName || post.location)
          setVenue({
            venueId: post.venueId,
            name: post.venueName ?? "",
            location: post.location,
          });
        setPhotos(
          savedPhotos.map((photo) => ({
            uri: photo.photo_url,
            uploadedUrl: photo.photo_url,
          })),
        );
      })
      .catch((e) => {
        if (active)
          setLoadError(
            e instanceof Error
              ? e.message
              : "Could not load the post and photos.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [postId, retry, profile?.id]);

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

  const openSavedPost = (id: string) => {
    if (!postId) {
      setTitle("");
      setDescription("");
      setVenue(null);
      setUnfinishedLocation(false);
      setStartsAtDate(null);
      setExpiresAtDate(null);
      setVacancies(2);
      setCost("");
      setTags([]);
      setGenderPref("any");
      setPhotos([]);
      setSavedPostId(null);
      setFormError("");
    }
    onSaved(id);
  };

  const handlePublish = async () => {
    if (publishLock.current) return;
    setFormError("");
    if (
      !savedPostId &&
      !postId &&
      (unfinishedLocation ||
        !hasPostMeetingPlace({
          venueId: venue?.venueId,
          venueName: venue?.name,
          location: venue?.location,
        }))
    ) {
      setFormError(requiredMeetingPlaceMessage);
      return;
    }
    if (!savedPostId && (unfinishedLocation || (venue && !venue.name.trim()))) {
      setFormError(
        "Choose a meeting place or add its coordinates, or clear the field to leave it out.",
      );
      return;
    }
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
    if (original && vacancies < original.joinedCount) {
      setFormError(
        `Spots cannot be below the ${original.joinedCount} approved participants.`,
      );
      return;
    }
    publishLock.current = true;
    setPublishing(true);
    try {
      const authorId = profile?.id ?? "demo-user";
      const details = {
        title: title.trim(),
        description: description.trim(),
        venueId: venue?.venueId || undefined,
        location: venue?.location,
        venueName: venue?.name || undefined,
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt?.toISOString(),
        vacancies,
        costCents,
        tags,
        genderPreference: genderPref ?? ("any" as const),
      };
      const id =
        savedPostId ??
        (postId
          ? (
              await updatePost(postId, {
                ...details,
                venueId: venue?.venueId || null,
                location: venue?.location ?? null,
                venueName: venue?.name || null,
                expiresAt: details.expiresAt ?? null,
                costCents: costCents ?? null,
              })
            ).id
          : (await createPost(authorId, details)).id);
      setSavedPostId(id);
      const result = await savePhotoSelection(id, photos, (uri) =>
        uploadPhoto(authorId, uri, "posts"),
      );
      setPhotos(result.photos);
      if (result.error) {
        setFormError(
          `Your ${postId ? "changes are" : "post is"} saved. Photo changes still need saving. ${result.error}`,
        );
        return;
      }
      openSavedPost(id);
    } catch (e) {
      Alert.alert(
        postId ? "Could not save changes" : "Failed to publish",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      publishLock.current = false;
      setPublishing(false);
    }
  };

  if (loading)
    return (
      <Screen>
        <LoadingState label="Getting your post and photos…" layout="detail" />
      </Screen>
    );
  if (loadError)
    return (
      <Screen>
        <EmptyState title="Could not open this editor" hint={loadError} />
        <Button title="Retry" onPress={() => setRetry((n) => n + 1)} />
        {onCancel && <Button title="Back" variant="ghost" onPress={onCancel} />}
      </Screen>
    );
  if (savedPostId)
    return (
      <Screen scroll keyboard>
        <PageHeading
          title="Finish your photos"
          greeting={postId ? "Your changes are saved." : "Your plan is saved."}
        />
        <Text accessibilityRole="alert" style={styles.formError}>
          {formError}
        </Text>
        <PostPhotosField
          photos={photos}
          onChange={setPhotos}
          disabled={publishing}
        />
        <Button
          title="Retry photo changes"
          loading={publishing}
          onPress={() => void handlePublish()}
        />
        <Button
          title="Keep saved post without these photo changes"
          variant="ghost"
          disabled={publishing}
          onPress={() => openSavedPost(savedPostId)}
        />
      </Screen>
    );

  return (
    <Screen keyboard>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {postId ? (
          <Button
            title="Back"
            variant="ghost"
            disabled={publishing}
            onPress={() => onCancel?.()}
          />
        ) : (
          <PersonalHeader />
        )}
        <PageHeading
          greeting="Someone nearby might be up for it."
          title={postId ? "Edit your plan" : "Start with\na little hello."}
        />

        <Input
          editable={!publishing}
          label="What’s the plan?"
          placeholder="Anyone for badminton this evening?"
          value={title}
          onChangeText={setTitle}
        />

        <Input
          editable={!publishing}
          label="A few details"
          placeholder="What, where, level — the details people need"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />

        <PostLocationField
          required={!postId}
          value={venue}
          onChange={setVenue}
          onDraftChange={setUnfinishedLocation}
          disabled={publishing}
        />

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

        <PostPhotosField
          photos={photos}
          onChange={setPhotos}
          disabled={publishing}
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              editable={!publishing}
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
                onPress={() =>
                  setVacancies((v) =>
                    Math.max(original?.joinedCount ?? 1, 1, v - 1),
                  )
                }
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

        <Text style={styles.fieldLabel}>Who can join</Text>
        {postId && (
          <Text style={styles.photoHint}>
            Changing the audience declines pending requests that no longer
            match. Approved participants must still match.
          </Text>
        )}
        <View style={styles.chips}>
          {(
            [
              { value: "male", label: "Males only" },
              { value: "female", label: "Females only" },
              { value: "any", label: "Anyone" },
            ] as const
          ).map((g) => {
            const sel = genderPref === g.value;
            return (
              <TouchableOpacity
                key={g.value}
                activeOpacity={0.7}
                onPress={() => setGenderPref(g.value)}
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
        {!publishing && picker?.mode === "date" && (
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
        {!publishing && picker?.mode === "time" && (
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
          title={postId ? "Save changes" : "Publish"}
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
    ...surfaces.field,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
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
  chipSelected: { ...surfaces.selected },
  chipText: { ...typography.bodySmall, color: colors.textDim },
  chipTextSelected: { color: colors.onGold, fontWeight: "600" },
  formError: {
    ...typography.body,
    color: colors.red,
    marginVertical: spacing.sm,
  },
  publish: { marginTop: spacing.md },
  pickerBox: {
    ...surfaces.field,
    height: 52,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  pickerText: { color: colors.text, fontSize: 15 },
  pickerPlaceholder: { color: colors.textFaint },
  clearBtn: { ...typography.label, color: colors.red, marginLeft: spacing.md },
});
