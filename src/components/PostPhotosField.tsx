import { Alert } from "../services/appAlert";
import React, { useRef, useState } from "react";
import {
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PhotoCropper } from "./PhotoCropper";
import { Icon } from "./Icon";
import { pickPhoto } from "../services/photos";
import { EditablePostPhoto } from "../services/postPhotos";
import { colors, radius, typography, weight } from "../theme";

/**
 * One cover photo per plan. Older plans may still hold several photos; they are
 * kept untouched until the host changes or removes the cover.
 */
export function PostPhotosField({
  photos,
  onChange,
  disabled = false,
}: {
  photos: EditablePostPhoto[];
  onChange: (photos: EditablePostPhoto[]) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const picking = useRef(false);
  const cover = photos[0];
  const pick = async () => {
    if (picking.current || disabled) return;
    picking.current = true;
    Keyboard.dismiss();
    try {
      const uri = await pickPhoto({ allowsEditing: false });
      if (uri) setEditing(uri);
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
      <Text style={styles.label}>Cover photo (optional)</Text>
      {cover ? (
        <View style={styles.preview}>
          <Image
            source={{ uri: cover.uri }}
            style={styles.image}
            resizeMode="cover"
            accessibilityLabel="Your plan’s cover photo"
          />
          <View style={styles.actions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Change cover photo"
              disabled={disabled}
              onPress={() => void pick()}
              style={styles.action}
            >
              <Icon name="refresh-cw" size={15} color="#FFFFFF" />
              <Text style={styles.actionText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Remove cover photo"
              disabled={disabled}
              onPress={() => onChange([])}
              style={[styles.action, styles.iconAction]}
            >
              <Icon name="trash-2" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add a cover photo"
          disabled={disabled}
          onPress={() => void pick()}
          style={styles.empty}
        >
          <View style={styles.emptyIcon}>
            <Icon name="image" size={22} color={colors.amberDeep} />
          </View>
          <Text style={styles.emptyTitle}>Add a cover photo</Text>
          <Text style={styles.hint}>Plans with a photo get noticed more</Text>
        </TouchableOpacity>
      )}
      {editing && (
        <PhotoCropper
          key={editing}
          uri={editing}
          onCancel={() => setEditing(null)}
          onDone={(uri) => {
            onChange([{ uri }]);
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
  preview: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
  },
  // Same shape as the plan card cover, so the host sees what others will.
  image: { width: "100%", aspectRatio: 1.9 },
  actions: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(3,7,18,0.72)",
  },
  iconAction: { width: 44, paddingHorizontal: 0, justifyContent: "center" },
  actionText: { fontSize: 13, ...weight("700"), color: "#FFFFFF" },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 22,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, ...weight("700"), color: colors.text },
  hint: { ...typography.caption, color: colors.textDim },
});
