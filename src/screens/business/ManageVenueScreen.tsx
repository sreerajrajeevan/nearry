import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { colors, typography, spacing } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { listVenues, updateVenueAmenities } from "../../services/venues";
import {
  pickPhoto,
  uploadPhoto,
  listVenuePhotos,
  addVenuePhoto,
  deleteVenuePhoto,
  AMENITY_PRESETS,
  PhotoRef,
} from "../../services/photos";
import { Venue } from "../../services/mappers";

/** Business venue management: photo gallery + amenities. */
export function ManageVenueScreen() {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [photos, setPhotos] = useState<PhotoRef[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const venues = await listVenues();
    const mine = venues.find((v) => v.businessId === profile.id) ?? null;
    setVenue(mine);
    if (mine) {
      setAmenities(mine.amenities ?? []);
      setPhotos(await listVenuePhotos(mine.id));
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      void load().catch(() => {});
    }, [load]),
  );

  const onAddPhoto = async () => {
    if (!venue || !profile) return;
    try {
      const uri = await pickPhoto();
      if (!uri) return;
      setUploading(true);
      const url = await uploadPhoto(profile.id, uri, "venues");
      await addVenuePhoto(venue.id, url);
      setPhotos(await listVenuePhotos(venue.id));
    } catch (e) {
      Alert.alert(
        "Could not add photo",
        e instanceof Error ? e.message : "Try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const onDeletePhoto = (id: string) => {
    Alert.alert("Delete this photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteVenuePhoto(id);
            setPhotos((prev) => prev.filter((p) => p.id !== id));
          } catch {
            Alert.alert("Could not delete", "Try again.");
          }
        },
      },
    ]);
  };

  const toggleAmenity = (name: string) => {
    setAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name],
    );
  };

  const addCustomAmenity = () => {
    const name = customAmenity.trim();
    if (!name) return;
    if (!amenities.includes(name)) setAmenities((prev) => [...prev, name]);
    setCustomAmenity("");
  };

  const onSaveAmenities = async () => {
    if (!venue) return;
    setSaving(true);
    try {
      await updateVenueAmenities(venue.id, amenities);
      Alert.alert("Saved", "Amenities updated.");
    } catch {
      Alert.alert("Could not save", "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My venue</Text>
        {!venue ? (
          <EmptyState
            title="No venue linked"
            hint="Your venue is linked by the reviewer alongside your business verification."
          />
        ) : (
          <>
            <Text style={styles.venueName}>{venue.name}</Text>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photoGrid}>
              {photos.map((p) => (
                <View key={p.id} style={styles.photoWrap}>
                  <Image source={{ uri: p.photo_url }} style={styles.photo} />
                  <TouchableOpacity
                    onPress={() => onDeletePhoto(p.id)}
                    style={styles.photoDelete}
                    hitSlop={8}
                  >
                    <Text style={styles.photoDeleteText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={onAddPhoto}
                style={styles.addPhoto}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Text style={styles.addPhotoText}>+ Add</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.chipWrap}>
              {AMENITY_PRESETS.map((name) => {
                const active = amenities.includes(name);
                return (
                  <TouchableOpacity
                    key={name}
                    onPress={() => toggleAmenity(name)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.customRow}>
              <TextInput
                value={customAmenity}
                onChangeText={setCustomAmenity}
                placeholder="Custom amenity…"
                placeholderTextColor={colors.textFaint}
                style={styles.customInput}
                onSubmitEditing={addCustomAmenity}
              />
              <Button title="Add" onPress={addCustomAmenity} variant="secondary" />
            </View>
            {amenities.filter((a) => !(AMENITY_PRESETS as readonly string[]).includes(a)).length > 0 && (
              <View style={styles.chipWrap}>
                {amenities
                  .filter((a) => !(AMENITY_PRESETS as readonly string[]).includes(a))
                  .map((name) => (
                    <TouchableOpacity
                      key={name}
                      onPress={() => toggleAmenity(name)}
                      style={[styles.chip, styles.chipActive]}
                    >
                      <Text style={[styles.chipText, styles.chipTextActive]}>
                        {name} ×
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}
            <Button
              title={saving ? "Saving…" : "Save amenities"}
              onPress={onSaveAmenities}
              disabled={saving}
              style={styles.saveBtn}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { ...typography.label, color: colors.textDim, marginBottom: spacing.md },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
  venueName: { ...typography.heading, color: colors.text, marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.label,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoWrap: { position: "relative" },
  photo: { width: 100, height: 100, borderRadius: 8 },
  photoDelete: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoDeleteText: { color: "#fff", fontSize: 16, lineHeight: 20 },
  addPhoto: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoText: { ...typography.label, color: colors.accent },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...typography.label, color: colors.text },
  chipTextActive: { color: "#fff" },
  customRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  saveBtn: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
