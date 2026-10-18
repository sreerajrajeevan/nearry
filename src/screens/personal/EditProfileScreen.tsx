import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing } from "../../theme";
import { PersonalStackParamList } from "../../navigation/types";
import { useAuth } from "../../store/AuthContext";
import { updateProfile } from "../../services/profile";

type Props = NativeStackScreenProps<PersonalStackParamList, "EditProfile">;

const INTERESTS = [
  "Sports",
  "Food",
  "Music",
  "Outdoors",
  "Games",
  "Culture",
  "Nightlife",
];

/** Edit display name, bio and interests. */
export function EditProfileScreen({ navigation }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  if (!profile) {
    return (
      <Screen>
        <EmptyState title="Not signed in" hint="Log in to edit your profile." />
      </Screen>
    );
  }

  const toggle = (tag: string) =>
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const onSave = async () => {
    setFormError("");
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setFormError("Give yourself a name (min 2 characters).");
      return;
    }
    if (trimmed.length > 40) {
      setFormError("Keep the name under 40 characters.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile(profile.id, {
        displayName: trimmed,
        bio: bio.trim(),
        interests,
      });
      await refreshProfile();
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
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Edit profile.</Text>

        <Input label="Your name" value={name} onChangeText={setName} />
        <Input
          label="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          style={styles.multiline}
          placeholder="A line about you"
        />

        <Text style={styles.fieldLabel}>Interests</Text>
        <View style={styles.chips}>
          {INTERESTS.map((tag) => {
            const sel = interests.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                activeOpacity={0.7}
                onPress={() => toggle(tag)}
                style={[styles.chip, sel && styles.chipSel]}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
              >
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Button
          title="Save changes"
          onPress={() => void onSave()}
          loading={saving}
          style={styles.btn}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  back: { marginBottom: spacing.md, alignSelf: "flex-start" },
  backText: { ...typography.label, color: colors.textDim },
  header: {
    ...typography.display,
    fontSize: 32,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  multiline: { height: 88, textAlignVertical: "top", paddingTop: spacing.md },
  fieldLabel: {
    ...typography.body,
    color: colors.textDim,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chipSel: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { ...typography.bodySmall, color: colors.text },
  chipTextSel: { color: colors.background },
  formError: {
    ...typography.body,
    color: colors.red,
    marginVertical: spacing.sm,
  },
  btn: { marginTop: spacing.lg },
});
