import { parseDateTime } from "../../utils/dateTime";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { Screen } from "../../components/Screen";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing } from "../../theme";
import { EditPostProps } from "../../navigation/types";
import { getPost, updatePost } from "../../services/posts";
import { NeedPost } from "../../services/mappers";
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

function toDateInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function toTimeInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Host edit. Server rules (guard_post_edit): open posts only, vacancies
 * never below approved count, start stays in the future.
 */
export function EditPostScreen({ route, navigation }: EditPostProps) {
  const { postId } = route.params;
  const [post, setPost] = useState<NeedPost | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryTime, setExpiryTime] = useState("");
  const [retry, setRetry] = useState(0);
  const [vacancies, setVacancies] = useState(2);
  const [cost, setCost] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPost(postId)
      .then((p) => {
        if (!active) return;
        if (!p) throw new Error("Post not found.");
        setPost(p);
        setTitle(p.title);
        setDescription(p.description);
        setDateStr(toDateInput(p.startsAt));
        setTimeStr(toTimeInput(p.startsAt));
        setExpiryDate(p.expiresAt ? toDateInput(p.expiresAt) : "");
        setExpiryTime(p.expiresAt ? toTimeInput(p.expiresAt) : "");
        setVacancies(p.vacancies);
        setCost(p.costCents !== undefined ? String(p.costCents / 100) : "");
        setTags(p.tags);
      })
      .catch(() => {
        if (active) setPost(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [postId, retry]);

  if (loading) {
    return (
      <Screen padded>
        <Text style={styles.status}>Loading…</Text>
      </Screen>
    );
  }
  if (!post) {
    return (
      <Screen padded>
        <EmptyState
          title="Couldn't load this post"
          hint="It may have been removed."
        />
        <Button title="Retry" onPress={() => setRetry((n) => n + 1)} />
        <Button
          title="Go back"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const toggleTag = (tag: string) =>
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const save = async () => {
    if (saving) return;
    setFormError("");
    const startsAt = parseDateTime(dateStr, timeStr);
    if (!startsAt) {
      setFormError("Enter date as YYYY-MM-DD and time as HH:MM (24h).");
      return;
    }
    const expiresAt =
      expiryDate.trim() || expiryTime.trim()
        ? parseDateTime(expiryDate, expiryTime)
        : null;
    if ((expiryDate.trim() || expiryTime.trim()) && !expiresAt) {
      setFormError("Enter both an expiry date and time, or clear both.");
      return;
    }
    const costCents = cost.trim()
      ? Math.round(Number(cost.trim()) * 100)
      : undefined;
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
    if (vacancies < post.joinedCount) {
      setFormError(
        `Vacancies cannot go below the ${post.joinedCount} approved join(s).`,
      );
      return;
    }
    setSaving(true);
    try {
      await updatePost(postId, {
        title: title.trim(),
        description: description.trim(),
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt?.toISOString() ?? null,
        vacancies,
        costCents: costCents ?? null,
        tags,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        "Could not save",
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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.back}
        >
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Edit post</Text>
        {post.joinedCount > 0 && (
          <Text style={styles.note}>
            {post.joinedCount}{" "}
            {post.joinedCount === 1 ? "person has" : "people have"} already
            joined — vacancies can't go below that.
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
              label="Date (yyyy-mm-dd)"
              value={dateStr}
              onChangeText={setDateStr}
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Time (hh:mm)"
              value={timeStr}
              onChangeText={setTimeStr}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Cost (optional)"
              value={cost}
              onChangeText={(t: string) => setCost(t.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.fieldLabel}>Vacancies</Text>
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
        <Text style={styles.fieldLabel}>Requests close (optional)</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Expiry date"
              placeholder="YYYY-MM-DD"
              value={expiryDate}
              onChangeText={setExpiryDate}
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Expiry time"
              placeholder="HH:MM"
              value={expiryTime}
              onChangeText={setExpiryTime}
            />
          </View>
        </View>
        {expiryDate || expiryTime ? (
          <Button
            title="Clear closing time"
            variant="ghost"
            onPress={() => {
              setExpiryDate("");
              setExpiryTime("");
            }}
          />
        ) : null}
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
                  #{tag.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Button
          title="Save changes"
          onPress={save}
          loading={saving}
          style={styles.save}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  back: { marginBottom: spacing.md, alignSelf: "flex-start" },
  backText: { ...typography.label, color: colors.textDim },
  header: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
  note: { ...typography.caption, color: colors.red, marginBottom: spacing.md },
  multiline: { height: 110, textAlignVertical: "top", paddingTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
  fieldLabel: {
    ...typography.label,
    color: colors.textDim,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepBtn: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { ...typography.title, color: colors.text },
  stepValue: {
    ...typography.title,
    color: colors.text,
    minWidth: 36,
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
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { borderColor: colors.red },
  chipText: { ...typography.caption, color: colors.textDim },
  chipTextSelected: { color: colors.red },
  formError: {
    ...typography.body,
    color: colors.red,
    marginVertical: spacing.sm,
  },
  save: { marginTop: spacing.md },
});
