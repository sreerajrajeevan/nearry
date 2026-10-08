import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { colors, typography, spacing } from '../../theme';
import { useAuth } from '../../store/AuthContext';
import { createPost } from '../../services/posts';
import { mockVenues } from '../../data/mock';

const TAG_OPTIONS = ['sports', 'music', 'food', 'games', 'outdoors', 'social', 'movies', 'culture'];

export function CreatePostScreen() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [when, setWhen] = useState('');
  const [vacancies, setVacancies] = useState(2);
  const [tags, setTags] = useState<string[]>([]);
  const [titleError, setTitleError] = useState('');
  const [descError, setDescError] = useState('');
  const [publishing, setPublishing] = useState(false);

  if (!user) {
    return (
      <Screen>
        <EmptyState title="Sign in required" hint="Log in to create a post." />
      </Screen>
    );
  }

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const clearForm = () => {
    setTitle('');
    setDescription('');
    setVenue('');
    setWhen('');
    setVacancies(2);
    setTags([]);
    setTitleError('');
    setDescError('');
  };

  const handlePublish = async () => {
    const tErr = title.trim() ? '' : 'Title is required';
    const dErr = description.trim() ? '' : 'Description is required';
    setTitleError(tErr);
    setDescError(dErr);
    if (tErr || dErr) return;

    setPublishing(true);
    try {
      const match = venue.trim()
        ? mockVenues.find((v) => v.name.toLowerCase() === venue.trim().toLowerCase())
        : undefined;
      await createPost(user.id, {
        title: title.trim(),
        description: description.trim(),
        venueId: match?.id,
        startsAt: when.trim() || 'Flexible',
        vacancies,
        tags,
      });
      Alert.alert('Post published', 'Your post is live for people nearby.');
      clearForm();
    } catch {
      Alert.alert('Failed to publish', 'Please try again.');
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
          onChangeText={(t) => {
            setTitle(t);
            if (titleError) setTitleError('');
          }}
          error={titleError}
        />

        <Input
          label="DESCRIPTION"
          placeholder="What, where, level — the details people need"
          value={description}
          onChangeText={(t) => {
            setDescription(t);
            if (descError) setDescError('');
          }}
          error={descError}
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />

        <Input
          label="VENUE (OPTIONAL)"
          placeholder="e.g. Kochi Marine Brews"
          value={venue}
          onChangeText={setVenue}
        />

        <Input
          label="WHEN"
          placeholder="e.g. Sat · 7 PM"
          value={when}
          onChangeText={setWhen}
        />

        <Text style={styles.fieldLabel}>VACANCIES</Text>
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
            onPress={() => setVacancies((v) => Math.min(20, v + 1))}
          >
            <Text style={styles.stepText}>+</Text>
          </TouchableOpacity>
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

        <Button
          title="PUBLISH POST"
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
  header: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  caption: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs, marginBottom: spacing.md },
  multiline: { height: 120, textAlignVertical: 'top', paddingTop: spacing.md },
  fieldLabel: { ...typography.label, color: colors.textDim, marginBottom: spacing.sm, marginTop: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  stepBtn: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { ...typography.title, color: colors.text },
  stepValue: { ...typography.title, color: colors.text, minWidth: 40, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { borderColor: colors.red },
  chipText: { ...typography.caption, color: colors.textDim },
  chipTextSelected: { color: colors.red },
  publish: { marginTop: spacing.md },
});
