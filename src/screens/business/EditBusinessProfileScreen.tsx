import React, { useState } from "react";
import {
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
import { Avatar } from "../../components/Avatar";
import { colors, typography, spacing } from "../../theme";
import { BusinessStackParamList } from "../../navigation/types";
import { useAuth } from "../../store/AuthContext";
import { updateProfile } from "../../services/profile";
import { pickAvatar, uploadAvatar } from "../../services/avatars";

type Props = NativeStackScreenProps<BusinessStackParamList, "EditBusinessProfile">;

/** Edit business name, category and area. */
export function EditBusinessProfileScreen({ navigation }: Props) {
  const { profile, refreshProfile } = useAuth();
  const details = (profile?.businessDetails ?? {}) as {
    category?: string;
    area?: string;
  };
  const [name, setName] = useState(
    profile?.businessName || profile?.displayName || "",
  );
  const [category, setCategory] = useState(details.category || "");
  const [area, setArea] = useState(details.area || "");
  const [avatarUri, setAvatarUri] = useState<string | undefined>(
    profile?.avatarUrl,
  );
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");

  if (!profile) {
    return (
      <Screen>
        <EmptyState title="Not signed in" hint="Log in to edit your profile." />
      </Screen>
    );
  }

  const onPickPhoto = async () => {
    try {
      const uri = await pickAvatar();
      if (uri) {
        setNewPhoto(uri);
        setAvatarUri(uri);
      }
    } catch (e) {
      Alert.alert(
        "Could not pick photo",
        e instanceof Error ? e.message : "Please try again.",
      );
    }
  };

  const onSave = async () => {
    setFormError("");
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setFormError("Give your business a name (min 2 characters).");
      return;
    }
    setSaving(true);
    try {
      let avatarUrl = profile.avatarUrl;
      if (newPhoto) {
        setUploading(true);
        avatarUrl = await uploadAvatar(profile.id, newPhoto);
        setUploading(false);
      }
      await updateProfile(profile.id, {
        businessName: trimmed,
        displayName: trimmed,
        avatarUrl,
        businessDetails: {
          ...details,
          category: category.trim(),
          area: area.trim(),
        },
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
      setUploading(false);
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

        <TouchableOpacity
          onPress={() => void onPickPhoto()}
          activeOpacity={0.7}
          style={styles.photoRow}
          accessibilityRole="button"
          accessibilityLabel="Change business photo"
        >
          <Avatar name={name || "Business"} size={72} uri={avatarUri} />
          <Text style={styles.photoLink}>
            {uploading ? "Uploading…" : "Change photo"}
          </Text>
        </TouchableOpacity>

        <Input
          label="Business name"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Category"
          value={category}
          onChangeText={setCategory}
          placeholder="Café, Salon, Turf…"
        />
        <Input
          label="Area"
          value={area}
          onChangeText={setArea}
          placeholder="Kochi, Fort Kochi…"
        />

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
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  photoLink: { ...typography.label, color: colors.accent },
  header: {
    ...typography.display,
    fontSize: 32,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  formError: {
    ...typography.body,
    color: colors.red,
    marginVertical: spacing.sm,
  },
  btn: { marginTop: spacing.lg },
});
