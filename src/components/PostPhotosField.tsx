import React, { useRef, useState } from "react";
import { Alert, Image, StyleSheet, Text, View, Keyboard } from "react-native";
import { PhotoCropper } from "./PhotoCropper";
import { Button } from "./Button";
import { pickPhoto } from "../services/photos";
import { EditablePostPhoto, MAX_POST_PHOTOS } from "../services/postPhotos";
import { colors, typography } from "../theme";

export function PostPhotosField({
  photos,
  onChange,
  disabled = false,
}: {
  photos: EditablePostPhoto[];
  onChange: (photos: EditablePostPhoto[]) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState<{
    uri: string;
    index?: number;
  } | null>(null);
  const picking = useRef(false);
  const pick = async (index?: number) => {
    if (picking.current || disabled) return;
    picking.current = true;
    Keyboard.dismiss();
    try {
      const uri = await pickPhoto({ allowsEditing: false });
      if (uri) setEditing({ uri, index });
    } catch (e) {
      Alert.alert(
        "Could not open photo",
        e instanceof Error ? e.message : "Please retry.",
      );
    } finally {
      picking.current = false;
    }
  };
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Photos (optional)</Text>
      <View style={styles.row}>
        {photos.map((photo, index) => (
          <View key={`${index}:${photo.uri}`} style={styles.tile}>
            <Image source={{ uri: photo.uri }} style={styles.image} />
            <Button
              title={`Replace photo ${index + 1}`}
              variant="ghost"
              disabled={disabled}
              onPress={() => void pick(index)}
            />
            <Button
              title={`Remove photo ${index + 1}`}
              variant="ghost"
              disabled={disabled}
              onPress={() => onChange(photos.filter((_, i) => i !== index))}
            />
          </View>
        ))}
      </View>
      <Button
        title="Add post photo"
        variant="secondary"
        disabled={disabled || photos.length >= MAX_POST_PHOTOS}
        onPress={() => void pick()}
      />
      <Text style={styles.hint}>
        Up to 5 photos. Crop each photo, then tap Done. The first photo is your
        cover.
      </Text>
      {editing && (
        <PhotoCropper
          key={editing.uri}
          uri={editing.uri}
          onCancel={() => setEditing(null)}
          onDone={(uri) => {
            const next = [...photos];
            if (editing.index == null) {
              if (next.length < MAX_POST_PHOTOS) next.push({ uri });
            } else next[editing.index] = { uri };
            onChange(next);
            setEditing(null);
          }}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: 8, marginVertical: 12 },
  label: { ...typography.body, color: colors.textDim },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: 140 },
  image: { width: 140, height: 120, borderRadius: 12 },
  hint: { ...typography.caption, color: colors.textDim },
});
