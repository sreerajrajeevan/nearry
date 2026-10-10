import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { PersonalTabNav } from '../../navigation/types';
import { createPost } from '../../services/posts';
import { searchVenues } from '../../services/venues';
import { Venue } from '../../services/mappers';
import { validatePostDraft } from '../../utils/validation';

const TAG_OPTIONS = ['sports', 'music', 'food', 'games', 'outdoors', 'social', 'movies', 'culture'];

function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const t = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!d || !t) return null;
  const dt = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function CreatePostScreen() {
  const { profile, demoMode } = useAuth();
  const navigation = useNavigation<PersonalTabNav>();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueQuery, setVenueQuery] = useState('');
  const [venueResults, setVenueResults] = useState<Venue[]>([]);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [vacancies, setVacancies] = useState(2);
  const [cost, setCost] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryTime, setExpiryTime] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
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
      <Screen>
        <EmptyState title="Sign in required" hint="Log in to create a post." />
      </Screen>
    );
  }

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const handlePublish = async () => {
    setFormError('');
    const startsAt = parseDateTime(dateStr, timeStr);
    const expiresAt = expiryDate.trim() || expiryTime.trim() ? parseDateTime(expiryDate || dateStr, expiryTime || '00:00') : null;
    if (!startsAt) {
      setFormError('Enter date as YYYY-MM-DD and time as HH:MM (24h).');
      return;
    }
    const costCents = cost.trim() ? Math.round(Number(cost.trim()) * 100) : undefined;
    if (cost.trim() && (!Number.isFinite(Number(cost.trim())) || Number(cost.trim()) < 0)) {
      setFormError('Cost must be a non-negative number, or leave it empty.');
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
      const post = await createPost(profile?.id ?? 'demo-user', {
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
      setTitle('');
      setDescription('');
      setVenue(null);
      setVenueQuery('');
      setDateStr('');
      setTimeStr('');
      setVacancies(2);
      setCost('');
      setExpiryDate('');
      setExpiryTime('');
      setTags([]);
      navigation.navigate('PostDetails', { postId: post.id });
    } catch (e) {
      Alert.alert('Failed to publish', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>CREATE POST</Text>
        <Text style={styles.caption}>NEED PEOPLE</Text>

        <Input
          label="TITLE"
          placeholder="e.g. Need 2 more for badminton"
          value={title}
          onChangeText={setTitle}
        />

        <Input
          label="DESCRIPTION"
          placeholder="What, where, level — the details people need"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />

        <Text style={styles.fieldLabel}>VENUE (OPTIONAL)</Text>
        {venue ? (
          <View style={styles.venuePick}>
            <Text style={styles.venuePickText}>{venue.name} · {venue.area}</Text>
            <TouchableOpacity onPress={() => { setVenue(null); setVenueQuery(''); }} activeOpacity={0.7}>
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
                <Text style={styles.venueMeta}>{v.category} · {v.area}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={styles.row}>
          <View style={styles.half}>
            <Input label="DATE (YYYY-MM-DD)" placeholder="2026-10-18" value={dateStr} onChangeText={setDateStr} />
          </View>
          <View style={styles.half}>
            <Input label="TIME (HH:MM)" placeholder="19:00" value={timeStr} onChangeText={setTimeStr} />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Input label="COST (OPTIONAL)" placeholder="₹ per person" value={cost} onChangeText={(t: string) => setCost(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
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

        <Text style={styles.fieldLabel}>REQUESTS CLOSE (OPTIONAL)</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <Input label="" placeholder="YYYY-MM-DD" value={expiryDate} onChangeText={setExpiryDate} />
          </View>
          <View style={styles.half}>
            <Input label="" placeholder="HH:MM" value={expiryTime} onChangeText={setExpiryTime} />
          </View>
        </View>

        <Text style={styles.fieldLabel}>TAGS</Text>
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
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  #{tag.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Button title="PUBLISH POST" onPress={handlePublish} loading={publishing} style={styles.publish} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  caption: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs, marginBottom: spacing.md },
  multiline: { height: 110, textAlignVertical: 'top', paddingTop: spacing.md },
  fieldLabel: { ...typography.label, color: colors.textDim, marginBottom: spacing.sm, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  venuePick: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.red,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  venuePickText: { ...typography.body, color: colors.text },
  venueClear: { ...typography.body, color: colors.textDim, padding: spacing.xs },
  venueRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  venueName: { ...typography.body, color: colors.text },
  venueMeta: { ...typography.caption, color: colors.textDim },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { ...typography.title, color: colors.text },
  stepValue: { ...typography.title, color: colors.text, minWidth: 36, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { borderColor: colors.red },
  chipText: { ...typography.caption, color: colors.textDim },
  chipTextSelected: { color: colors.red },
  formError: { ...typography.body, color: colors.red, marginVertical: spacing.sm },
  publish: { marginTop: spacing.md },
});
