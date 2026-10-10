import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { PostDetailsProps } from '../../navigation/types';
import { getPost, updatePost } from '../../services/posts';
import { NeedPost } from '../../services/mappers';
import { validatePostDraft } from '../../utils/validation';

const TAG_OPTIONS = ['sports', 'music', 'food', 'games', 'outdoors', 'social', 'movies', 'culture'];

function toDateInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function toTimeInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const t = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!d || !t) return null;
  const dt = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Host edit. Server rules (guard_post_edit): open posts only, vacancies
 * never below approved count, start stays in the future.
 */
export function EditPostScreen({ route, navigation }: PostDetailsProps) {
  const { postId } = route.params;
  const [post, setPost] = useState<NeedPost | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [vacancies, setVacancies] = useState(2);
  const [cost, setCost] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPost(postId)
      .then((p) => {
        if (!p) throw new Error('Post not found.');
        setPost(p);
        setTitle(p.title);
        setDescription(p.description);
        setDateStr(toDateInput(p.startsAt));
        setTimeStr(toTimeInput(p.startsAt));
        setVacancies(p.vacancies);
        setCost(p.costCents ? String(p.costCents / 100) : '');
        setTags(p.tags);
      })
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) {
    return (
      <Screen padded>
        <Text style={styles.status}>LOADING…</Text>
      </Screen>
    );
  }
  if (!post) {
    return (
      <Screen padded>
        <EmptyState title="Couldn't load this post" hint="It may have been removed." />
        <Button title="GO BACK" variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const save = async () => {
    setFormError('');
    const startsAt = parseDateTime(dateStr, timeStr);
    if (!startsAt) {
      setFormError('Enter date as YYYY-MM-DD and time as HH:MM (24h).');
      return;
    }
    const costCents = cost.trim() ? Math.round(Number(cost.trim()) * 100) : undefined;
    const err = validatePostDraft({ title, description, startsAt, vacancies, costCents });
    if (err) {
      setFormError(err);
      return;
    }
    if (vacancies < post.joinedCount) {
      setFormError(`Vacancies cannot go below the ${post.joinedCount} approved join(s).`);
      return;
    }
    setSaving(true);
    try {
      await updatePost(postId, {
        title: title.trim(),
        description: description.trim(),
        startsAt: startsAt.toISOString(),
        vacancies,
        costCents,
        tags,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.back}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.header}>EDIT POST</Text>
        {post.joinedCount > 0 && (
          <Text style={styles.note}>
            {post.joinedCount} {post.joinedCount === 1 ? 'person has' : 'people have'} already joined —
            vacancies can't go below that.
          </Text>
        )}
        <Input label="TITLE" value={title} onChangeText={setTitle} />
        <Input label="DESCRIPTION" value={description} onChangeText={setDescription} multiline numberOfLines={4} style={styles.multiline} />
        <View style={styles.row}>
          <View style={styles.half}>
            <Input label="DATE (YYYY-MM-DD)" value={dateStr} onChangeText={setDateStr} />
          </View>
          <View style={styles.half}>
            <Input label="TIME (HH:MM)" value={timeStr} onChangeText={setTimeStr} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Input label="COST (OPTIONAL)" value={cost} onChangeText={(t: string) => setCost(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
          </View>
          <View style={styles.half}>
            <Text style={styles.fieldLabel}>VACANCIES</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} activeOpacity={0.8} onPress={() => setVacancies((v) => Math.max(1, v - 1))}>
                <Text style={styles.stepText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{vacancies}</Text>
              <TouchableOpacity style={styles.stepBtn} activeOpacity={0.8} onPress={() => setVacancies((v) => Math.min(100, v + 1))}>
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Text style={styles.fieldLabel}>TAGS</Text>
        <View style={styles.chips}>
          {TAG_OPTIONS.map((tag) => {
            const selected = tags.includes(tag);
            return (
              <TouchableOpacity key={tag} onPress={() => toggleTag(tag)} activeOpacity={0.8} style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>#{tag.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Button title="SAVE CHANGES" onPress={save} loading={saving} style={styles.save} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  back: { marginBottom: spacing.md, alignSelf: 'flex-start' },
  backText: { ...typography.label, color: colors.textDim },
  header: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
  note: { ...typography.caption, color: colors.red, marginBottom: spacing.md },
  multiline: { height: 110, textAlignVertical: 'top', paddingTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  fieldLabel: { ...typography.label, color: colors.textDim, marginBottom: spacing.sm, marginTop: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { width: 44, height: 44, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  stepText: { ...typography.title, color: colors.text },
  stepValue: { ...typography.title, color: colors.text, minWidth: 36, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipSelected: { borderColor: colors.red },
  chipText: { ...typography.caption, color: colors.textDim },
  chipTextSelected: { color: colors.red },
  formError: { ...typography.body, color: colors.red, marginVertical: spacing.sm },
  save: { marginTop: spacing.md },
});
