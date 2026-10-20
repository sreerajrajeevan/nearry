import { LoadingImage } from "./LoadingImage";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../theme";
import { Icon, IconName } from "./Icon";
import { MotionPressable } from "./Motion";
import { ActivityArt } from "./ActivityArt";
import { ActivityArtwork } from "../utils/activityArtwork";

type Props = {
  kind: "Plan" | "Place" | "Offer";
  icon: IconName;
  title: string;
  meta: string;
  detail?: string;
  action: string;
  onPress: () => void;
  imageUrl?: string;
  artwork?: ActivityArtwork;
};

/** One generous tap target; the text action opens the existing details flow. */
export function DiscoveryCard({
  kind,
  icon,
  title,
  meta,
  detail,
  action,
  onPress,
  imageUrl,
  artwork,
}: Props) {
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [imageUrl]);
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={[`${kind}: ${title}`, meta, detail, action]
        .filter(Boolean)
        .join(". ")}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.thumbnail}>
        {imageUrl && !photoFailed ? (
          <LoadingImage
            source={{ uri: imageUrl }}
            resizeMode="cover"
            style={styles.photo}
            onError={() => setPhotoFailed(true)}
          />
        ) : artwork ? (
          <ActivityArt artwork={artwork} size={76} />
        ) : (
          <Icon name={icon} size={27} color={colors.accent} />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.kind}>{kind}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{meta}</Text>
        <View style={styles.bottom}>
          {!!detail && <Text style={styles.detail}>{detail}</Text>}
          <View style={styles.link}>
            <Text style={styles.action}>{action}</Text>
            <Icon name="arrow-up-right" size={13} color={colors.accent} />
          </View>
        </View>
      </View>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: colors.onAccent,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 22,
    marginBottom: 12,
  },
  thumbnail: {
    width: 80,
    minHeight: 86,
    borderRadius: 15,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  copy: { flex: 1, minWidth: 0 },
  photo: { width: "100%", height: "100%", position: "absolute" },
  kind: {
    ...typography.caption,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
    marginBottom: 5,
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 5,
  },
  meta: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textDim,
  },
  bottom: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    marginTop: spacing.sm,
  },
  detail: { ...typography.caption, color: colors.text },
  link: { flexDirection: "row", alignItems: "center", gap: 3, minHeight: 32 },
  action: {
    ...typography.caption,
    fontSize: 12,
    color: colors.accent,
    fontWeight: "600",
    flexShrink: 1,
  },
});
