import {
  hasPostMeetingPlace,
  requiredMeetingPlaceMessage,
} from "../../utils/postLocation";
import { Alert } from "../../services/appAlert";
import React, { useEffect, useRef, useState } from "react";
import {
  PLAN_ACTIVITIES,
  composerDays,
  samePlanDay,
  planCostCents,
  planPreferencesError,
  PlanDetails,
} from "../../utils/planComposer";
import { PlanCover } from "../../components/PlanCover";
import { Icon } from "../../components/Icon";
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
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { colors } from "../../theme";
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
  const [activity, setActivity] = useState<PlanDetails["activity"]>();
  const [duration, setDuration] =
    useState<NonNullable<PlanDetails["durationMinutes"]>>(60);
  const [level, setLevel] = useState<NonNullable<PlanDetails["level"]>>("any");
  const [venueBooked, setVenueBooked] = useState(false);
  const [costMode, setCostMode] =
    useState<NonNullable<PlanDetails["costMode"]>>("free");
  const [ageMin, setAgeMin] = useState("18"),
    [ageMax, setAgeMax] = useState("100");
  const [advanced, setAdvanced] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
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
        setActivity(post.planDetails?.activity ?? "other");
        setDuration(post.planDetails?.durationMinutes ?? 60);
        setLevel(post.planDetails?.level ?? "any");
        setVenueBooked(post.planDetails?.venueBooked ?? false);
        setCostMode(
          post.planDetails?.costMode ?? (post.costCents ? "person" : "free"),
        );
        setAgeMin(String(post.planDetails?.ageMin ?? 18));
        setAgeMax(String(post.planDetails?.ageMax ?? 100));
        setTitle(post.title);
        setDescription(post.description);
        setStartsAtDate(new Date(post.startsAt));
        setExpiresAtDate(post.expiresAt ? new Date(post.expiresAt) : null);
        setVacancies(post.vacancies);
        setCost(
          post.planDetails?.costMode === "split"
            ? String((post.planDetails.totalCostCents ?? 0) / 100)
            : post.costCents == null
              ? ""
              : String(post.costCents / 100),
        );
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
      setActivity(undefined);
      setDuration(60);
      setLevel("any");
      setVenueBooked(false);
      setCostMode("free");
      setAgeMin("18");
      setAgeMax("100");
      setAdvanced(false);
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
    if (!savedPostId && !activity) {
      setFormError("Choose what you’re planning.");
      return;
    }
    const preferences: PlanDetails = {
      activity,
      durationMinutes: duration,
      level,
      venueBooked,
      costMode,
      ageMin: Number(ageMin),
      ageMax: Number(ageMax),
      ...(costMode === "split"
        ? { totalCostCents: Math.round(Number(cost) * 100) }
        : {}),
    };
    const preferenceError = planPreferencesError(preferences);
    if (!savedPostId && preferenceError) {
      setFormError(preferenceError);
      return;
    }
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
    const costCents = planCostCents(costMode, cost, vacancies);
    if (costMode !== "free" && costCents === undefined) {
      setFormError("Enter a valid amount for this plan.");
      return;
    }
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
        planDetails: preferences,
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

  const days = composerDays();
  const missing = [
    !activity && "activity",
    title.trim().length < 4 && "title",
    description.trim().length < 10 && "details",
    !startsAtDate && "date/time",
    (!venue || unfinishedLocation) && "place",
  ].filter(Boolean);
  const preferences: PlanDetails = {
    activity,
    durationMinutes: duration,
    level,
    venueBooked,
    costMode,
    ageMin: Number(ageMin),
    ageMax: Number(ageMax),
  };
  const preview: NeedPost = {
    id: "preview",
    authorId: profile?.id ?? "",
    authorName: profile?.displayName ?? "You",
    title: title || "Your plan title",
    description,
    venueName: venue?.name,
    startsAt: startsAtDate?.toISOString() ?? new Date().toISOString(),
    vacancies,
    joinedCount: 0,
    spotsLeft: vacancies,
    tags,
    genderPreference: genderPref,
    status: "open",
    createdAt: new Date().toISOString(),
    coverPhotoUrl: photos[0]?.uri,
    costCents: planCostCents(costMode, cost, vacancies),
    planDetails: preferences,
  };
  const chooseActivity = (item: (typeof PLAN_ACTIVITIES)[number]) => {
    const previous = PLAN_ACTIVITIES.find((x) => x.id === activity);
    if (!title.trim() || title === previous?.title) setTitle(item.title);
    setActivity(item.id);
    setTags((current) => [
      ...new Set([...current.filter((t) => t !== previous?.tag), item.tag]),
    ]);
    setFormError("");
  };
  const chooseDay = (date: Date) => {
    const next = new Date(date);
    next.setHours(
      startsAtDate?.getHours() ?? 19,
      startsAtDate?.getMinutes() ?? 0,
      0,
      0,
    );
    setStartsAtDate(next);
  };
  return (
    <Screen keyboard>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {postId && (
          <Button
            title="Back"
            variant="ghost"
            disabled={publishing}
            onPress={() => onCancel?.()}
          />
        )}
        <View style={styles.pageTop}>
          <Text style={styles.eyebrow}>
            {postId ? "A FEW LITTLE CHANGES" : "GOOD COMPANY STARTS HERE"}
          </Text>
          <Text accessibilityRole="header" style={styles.pageTitle}>
            {postId ? "Edit your plan" : "What’s the plan?"}
          </Text>
          <Text style={styles.help}>
            Make it easy for someone nearby to say “I’m in”.
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`${5 - missing.length} of 5 essentials added`}
            style={styles.progress}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(0, (5 - missing.length) / 5) * 100}%` },
              ]}
            />
          </View>
        </View>
        <PlanSection number={1} title="What are you planning?">
          <View
            style={styles.activities}
            accessibilityRole="radiogroup"
            accessibilityLabel="Plan activity"
          >
            {PLAN_ACTIVITIES.map((item) => (
              <TouchableOpacity
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: activity === item.id }}
                aria-checked={activity === item.id}
                accessibilityLabel={item.label}
                disabled={publishing}
                onPress={() => chooseActivity(item)}
                style={[
                  styles.activity,
                  activity === item.id && styles.activitySelected,
                ]}
              >
                <Text style={styles.activityEmoji}>{item.emoji}</Text>
                <Text style={styles.activityText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </PlanSection>
        <PlanSection number={2} title="Give it a title">
          <Input
            label="Title"
            placeholder="Pick an activity for a suggestion"
            value={title}
            maxLength={80}
            onChangeText={setTitle}
            editable={!publishing}
          />
          <Text style={styles.counter}>{title.length}/80</Text>
          <Input
            label="Details"
            placeholder="A little about the plan, what to bring, where to meet…"
            value={description}
            maxLength={1000}
            onChangeText={setDescription}
            editable={!publishing}
            multiline
            numberOfLines={3}
            style={styles.multiline}
          />
          <Text style={styles.help}>
            At least 10 characters, so people know what to expect.
          </Text>
          <PostPhotosField
            photos={photos}
            onChange={setPhotos}
            disabled={publishing}
          />
        </PlanSection>
        <PlanSection number={3} title="When">
          <View style={styles.row}>
            {days.map((day) => (
              <TouchableOpacity
                key={day.label}
                accessibilityRole="button"
                accessibilityState={{
                  selected: samePlanDay(startsAtDate, day.date),
                }}
                disabled={publishing}
                onPress={() => chooseDay(day.date)}
                style={[
                  styles.day,
                  samePlanDay(startsAtDate, day.date) && styles.daySelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayTitle,
                    samePlanDay(startsAtDate, day.date) && styles.light,
                  ]}
                >
                  {day.label}
                </Text>
                <Text
                  style={[
                    styles.dayDate,
                    samePlanDay(startsAtDate, day.date) && styles.light,
                  ]}
                >
                  {day.date.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.row}>
            <DateTimeField
              label="Choose date"
              value={startsAtDate ? fmtDate(startsAtDate) : null}
              placeholder="More dates"
              onPress={() => setPicker({ field: "startsAt", mode: "date" })}
            />
            <DateTimeField
              label="Start time"
              value={startsAtDate ? fmtTime(startsAtDate) : null}
              placeholder="Pick a time"
              onPress={() => setPicker({ field: "startsAt", mode: "time" })}
            />
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Plan duration"
            disabled={publishing}
            style={styles.settingRow}
            onPress={() => setDurationOpen(!durationOpen)}
          >
            <View style={styles.flex}>
              <Text style={styles.label}>Duration</Text>
              <Text style={styles.help}>How much time to set aside</Text>
            </View>
            <Text style={styles.label}>
              {duration < 60
                ? `${duration} min`
                : `${duration / 60} ${duration === 60 ? "hour" : "hours"}`}
              ⌄
            </Text>
          </TouchableOpacity>
          {durationOpen && (
            <Choices
              label="Duration"
              value={String(duration)}
              onChange={(value) => {
                setDuration(Number(value) as typeof duration);
                setDurationOpen(false);
              }}
              items={[30, 60, 90, 120, 180, 240].map((n) => ({
                value: String(n),
                label: n < 60 ? `${n} min` : `${n / 60} hr`,
              }))}
              disabled={publishing}
            />
          )}
        </PlanSection>
        <PlanSection number={4} title="Where">
          <PostLocationField
            required={!postId}
            value={venue}
            onChange={setVenue}
            onDraftChange={setUnfinishedLocation}
            disabled={publishing}
          />
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel="Venue already booked"
            accessibilityState={{ checked: venueBooked }}
            aria-checked={venueBooked}
            onPress={() => setVenueBooked(!venueBooked)}
            disabled={publishing}
            style={styles.settingRow}
          >
            <View style={styles.flex}>
              <Text style={styles.label}>Venue already booked</Text>
              <Text style={styles.help}>
                Let people know if booking is still needed.
              </Text>
            </View>
            <View style={[styles.toggle, venueBooked && styles.toggleOn]}>
              <View
                style={[
                  styles.toggleThumb,
                  venueBooked && { alignSelf: "flex-end" },
                ]}
              />
            </View>
          </TouchableOpacity>
        </PlanSection>
        <PlanSection number={5} title="Who can join">
          <Text style={styles.label}>People needed</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fewer people"
              disabled={
                publishing ||
                vacancies <= Math.max(1, original?.joinedCount ?? 0)
              }
              style={styles.stepBtn}
              onPress={() =>
                setVacancies((v) =>
                  Math.max(1, original?.joinedCount ?? 0, v - 1),
                )
              }
            >
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.stepValue}>{vacancies}</Text>
              <Text style={styles.help}>
                more {vacancies === 1 ? "person" : "people"}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="More people"
              disabled={publishing || vacancies >= 100}
              style={styles.stepBtn}
              onPress={() => setVacancies((v) => Math.min(100, v + 1))}
            >
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
          </View>
          <Choices
            label="Gender"
            value={genderPref ?? "any"}
            onChange={(v) => setGenderPref(v as typeof genderPref)}
            items={[
              { value: "any", label: "Anyone" },
              { value: "female", label: "Women" },
              { value: "male", label: "Men" },
            ]}
            disabled={publishing}
          />
          <Choices
            label="Experience level"
            value={level}
            onChange={(v) => setLevel(v as typeof level)}
            items={[
              { value: "any", label: "Any" },
              { value: "beginner", label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "advanced", label: "Advanced" },
            ]}
            disabled={publishing}
          />
          <Text style={styles.help}>
            Level is a guide for the group, not a verified skill rating.
          </Text>
          <View style={styles.row}>
            <View style={styles.half}>
              <Input
                label="Minimum age"
                keyboardType="number-pad"
                value={ageMin}
                maxLength={3}
                onChangeText={(v) => setAgeMin(v.replace(/[^0-9]/g, ""))}
                editable={!publishing}
              />
            </View>
            <View style={styles.half}>
              <Input
                label="Maximum age"
                keyboardType="number-pad"
                value={ageMax}
                maxLength={3}
                onChangeText={(v) => setAgeMax(v.replace(/[^0-9]/g, ""))}
                editable={!publishing}
              />
            </View>
          </View>
          {postId && (
            <Text style={styles.help}>
              Your preferences must include the people already approved.
            </Text>
          )}
        </PlanSection>
        <PlanSection number={6} title="Cost">
          <Choices
            label="How costs work"
            value={costMode}
            onChange={(v) => setCostMode(v as typeof costMode)}
            items={[
              { value: "free", label: "Free" },
              { value: "split", label: "Split fee" },
              { value: "person", label: "Per person" },
            ]}
            disabled={publishing}
          />
          {costMode !== "free" && (
            <Input
              label={
                costMode === "split"
                  ? "Total to split (₹)"
                  : "Amount per person (₹)"
              }
              value={cost}
              onChangeText={(v) => setCost(v.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              editable={!publishing}
            />
          )}
          {costMode === "split" && (
            <Text style={styles.help}>
              About ₹
              {(
                (planCostCents(costMode, cost, vacancies) ?? 0) / 100
              ).toLocaleString("en-IN")}{" "}
              each with you + {vacancies} people. Final shares may vary if the
              group is smaller.
            </Text>
          )}
          <Text style={styles.help}>
            Arrange any payments with the group. Nearry doesn’t collect them.
          </Text>
        </PlanSection>
        <PlanSection number={7} title="A little peace of mind">
          <View style={styles.settingRow}>
            <Icon name="shield" size={22} />
            <View style={styles.flex}>
              <Text style={styles.label}>You approve each request</Text>
              <Text style={styles.help}>
                Only approved people join your private plan group.
              </Text>
            </View>
          </View>
          <View style={styles.settingRow}>
            <Icon name="message-circle" size={22} />
            <View style={styles.flex}>
              <Text style={styles.label}>A group for this plan</Text>
              <Text style={styles.help}>
                Already-in members and future approvals are added automatically.
                Leave the group to leave the plan and free your spot.
              </Text>
            </View>
          </View>
          <Text style={styles.help}>
            Your plan is visible to people discovering nearby plans.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={publishing}
            onPress={() => setAdvanced(!advanced)}
            style={styles.settingRow}
          >
            <Text style={styles.label}>Tags & request deadline</Text>
            <Icon name={advanced ? "chevron-up" : "chevron-down"} size={18} />
          </TouchableOpacity>
          {advanced && (
            <>
              <View style={styles.chips}>
                {TAG_OPTIONS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    accessibilityRole="button"
                    accessibilityState={{ selected: tags.includes(tag) }}
                    onPress={() => toggleTag(tag)}
                    style={[
                      styles.chip,
                      tags.includes(tag) && styles.chipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        tags.includes(tag) && styles.light,
                      ]}
                    >
                      #{tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.row}>
                <DateTimeField
                  label="Requests close — date"
                  value={expiresAtDate ? fmtDate(expiresAtDate) : null}
                  placeholder="Optional"
                  onPress={() =>
                    setPicker({ field: "expiresAt", mode: "date" })
                  }
                />
                <DateTimeField
                  label="Time"
                  value={expiresAtDate ? fmtTime(expiresAtDate) : null}
                  placeholder="Optional"
                  onPress={() =>
                    setPicker({ field: "expiresAt", mode: "time" })
                  }
                />
              </View>
              {expiresAtDate && (
                <Button
                  title="Clear request deadline"
                  variant="ghost"
                  onPress={() => setExpiresAtDate(null)}
                />
              )}
            </>
          )}
        </PlanSection>
        <PlanSection number={8} title="A quick preview">
          <Text style={styles.previewAuthor}>
            {profile?.displayName ?? "You"} · you’re hosting
          </Text>
          <View style={styles.previewRow}>
            <View style={styles.previewCover}>
              <PlanCover post={preview} fill artworkSize={90} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.previewTitle}>{preview.title}</Text>
              <Text style={styles.help}>
                {startsAtDate
                  ? startsAtDate.toLocaleString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Choose a date & time"}
              </Text>
              <Text style={styles.help}>
                {venue?.name || "Pick a meeting place"}
              </Text>
              <Text style={styles.previewMeta}>
                {genderPref === "female"
                  ? "Women only"
                  : genderPref === "male"
                    ? "Men only"
                    : "Anyone"}{" "}
                · {vacancies} spots
              </Text>
              <Text style={styles.previewMeta}>
                {costMode === "free"
                  ? "Free"
                  : `₹${((preview.costCents ?? 0) / 100).toLocaleString("en-IN")} each`}
              </Text>
            </View>
          </View>
        </PlanSection>
      </ScrollView>
      <View style={styles.footer}>
        {!!formError && (
          <Text accessibilityRole="alert" style={styles.formError}>
            {formError}
          </Text>
        )}
        <Text style={styles.footerHint}>
          {missing.length
            ? "Still needed: " + missing.join(", ")
            : "Looks good. Ready for a new hello?"}
        </Text>
        <Button
          title={postId ? "Save changes" : "Post plan"}
          loading={publishing}
          disabled={missing.length > 0}
          onPress={() => void handlePublish()}
        />
      </View>
      {!publishing && picker?.mode === "date" && (
        <DateSheet
          visible
          value={picker.field === "startsAt" ? startsAtDate : expiresAtDate}
          onPick={(date) => {
            applyPicked(date);
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
    </Screen>
  );
}

function PlanSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTop}>
        <Text style={styles.sectionNumber}>{number}</Text>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}
function Choices({
  label,
  value,
  onChange,
  items,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  disabled: boolean;
}) {
  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.value}
            accessibilityRole="radio"
            accessibilityLabel={item.label}
            accessibilityState={{ checked: value === item.value }}
            aria-checked={value === item.value}
            disabled={disabled}
            onPress={() => onChange(item.value)}
            style={[styles.chip, value === item.value && styles.chipSelected]}
          >
            <Text
              style={[styles.chipText, value === item.value && styles.light]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingBottom: 20 },
  pageTop: { paddingTop: 20, paddingBottom: 22 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: colors.coralDeep,
  },
  pageTitle: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 7,
  },
  help: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textDim,
    marginVertical: 3,
  },
  progress: {
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginTop: 18,
    overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: colors.coralDeep },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 17,
    marginBottom: 14,
  },
  sectionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 17,
  },
  sectionNumber: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: colors.sageSoft,
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 25,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.ink, flex: 1 },
  activities: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  activity: {
    width: "23%",
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    padding: 4,
  },
  activitySelected: {
    backgroundColor: colors.sageSoft,
    borderColor: colors.accent,
  },
  activityEmoji: { fontSize: 27, marginBottom: 6 },
  activityText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  counter: {
    textAlign: "right",
    fontSize: 11,
    color: colors.textDim,
    marginTop: -9,
    marginBottom: 12,
  },
  multiline: { height: 90, textAlignVertical: "top" },
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginVertical: 5,
  },
  half: { flex: 1, minWidth: 0 },
  day: {
    flex: 1,
    minHeight: 63,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  daySelected: { backgroundColor: colors.ink },
  dayTitle: { fontSize: 12, fontWeight: "700", color: colors.text },
  dayDate: { fontSize: 10, color: colors.textDim, marginTop: 3 },
  light: { color: colors.onAccent },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textDim,
    marginBottom: 8,
  },
  pickerBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    minHeight: 48,
    padding: 10,
    justifyContent: "center",
  },
  pickerText: { fontSize: 13, color: colors.text, fontWeight: "600" },
  pickerPlaceholder: { color: colors.textDim },
  settingRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  flex: { flex: 1, minWidth: 0 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 15,
    padding: 3,
    backgroundColor: colors.border,
  },
  toggleOn: { backgroundColor: colors.accent },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 8,
    marginVertical: 10,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 24, color: colors.text },
  stepValue: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    minHeight: 42,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 13,
    backgroundColor: colors.background,
  },
  chipSelected: { backgroundColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.text },
  previewAuthor: { fontSize: 12, color: colors.textDim, marginBottom: 12 },
  previewRow: { flexDirection: "row", gap: 12 },
  previewCover: {
    width: 92,
    minHeight: 120,
    borderRadius: 15,
    overflow: "hidden",
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 5,
  },
  previewMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
    marginTop: 5,
  },
  footer: {
    paddingTop: 9,
    paddingBottom: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  footerHint: {
    fontSize: 11,
    color: colors.textDim,
    textAlign: "center",
    marginBottom: 8,
  },
  formError: { fontSize: 12, color: colors.red, marginVertical: 5 },
  photoHint: { fontSize: 12, color: colors.textDim },
  publish: { marginTop: 12 },
  clearBtn: { fontSize: 12, color: colors.accent },
});
