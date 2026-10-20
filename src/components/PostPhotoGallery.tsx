import { LoadingImage } from "./LoadingImage";
import { LoadingState } from "./LoadingState";
import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listPostPhotos } from "../services/postPhotos";
import { useLiveQuery } from "../hooks/useLiveQuery";
import { useReducedMotion } from "../store/MotionContext";
import { colors, typography } from "../theme";
import { MotionPressable } from "./Motion";
import { Button } from "./Button";
import { Icon } from "./Icon";

export function PostPhotoGallery({
  postId,
  onReportPhoto,
}: {
  postId: string;
  onReportPhoto?: (id: string) => void;
}) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const {
    data: photos,
    state,
    refresh,
  } = useLiveQuery(`post-photos:${postId}`, () => listPostPhotos(postId));
  const retry = () => {
    setFailed([]);
    void refresh();
  };
  if (state === "loading" && !photos)
    return <LoadingState label="Loading photos…" layout="compact" />;
  if (state === "error")
    return (
      <View style={styles.section}>
        <Text style={styles.note}>Couldn't load this post's photos.</Text>
        <Button title="Retry photos" variant="ghost" onPress={retry} />
      </View>
    );
  if (!photos?.length) return null;
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        A look at the plan
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {photos.map((photo, index) => (
          <MotionPressable
            key={photo.id}
            accessibilityRole="button"
            accessibilityLabel={`Open post photo ${index + 1} of ${photos.length}`}
            onPress={() => setSelected(photo.photo_url)}
            style={[styles.tile, { width: Math.min(560, width - 48) }]}
          >
            {failed.includes(photo.photo_url) ? (
              <Text style={styles.note}>Photo unavailable</Text>
            ) : (
              <LoadingImage
                source={{ uri: photo.photo_url }}
                style={styles.photo}
                resizeMode="cover"
                onError={() => setFailed((prev) => [...prev, photo.photo_url])}
              />
            )}
          </MotionPressable>
        ))}
      </ScrollView>
      <Text style={styles.note}>
        {photos.length} photo{photos.length === 1 ? "" : "s"} · Tap to view
      </Text>
      {!!failed.length && (
        <Button title="Retry photos" variant="ghost" onPress={retry} />
      )}
      <Modal
        visible={selected !== null}
        animationType={reduced ? "none" : "fade"}
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={styles.viewer}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Close post photo"
            onPress={() => setSelected(null)}
            style={styles.close}
          >
            <Icon name="x" size={24} color={colors.onAccent} />
          </MotionPressable>
          {selected && onReportPhoto && (
            <Button
              title="Report this photo"
              variant="secondary"
              onPress={() => {
                const photo = photos.find((p) => p.photo_url === selected);
                setSelected(null);
                if (photo) onReportPhoto(photo.id);
              }}
            />
          )}
          {selected &&
            (failed.includes(selected) ? (
              <Text style={styles.viewerError}>
                Photo unavailable. Close and retry.
              </Text>
            ) : (
              <LoadingImage
                source={{ uri: selected }}
                resizeMode="contain"
                style={styles.fullPhoto}
                onError={() => setFailed((prev) => [...prev, selected])}
              />
            ))}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  heading: { ...typography.heading, color: colors.text, marginBottom: 12 },
  rail: { gap: 12 },
  tile: {
    height: 220,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.claySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  photo: { width: "100%", height: "100%" },
  note: { ...typography.caption, color: colors.textDim, marginTop: 8 },
  viewer: { flex: 1, backgroundColor: colors.ink },
  close: {
    width: 48,
    height: 48,
    alignSelf: "flex-end",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fullPhoto: { flex: 1, width: "100%" },
  viewerError: { ...typography.body, color: colors.onAccent, padding: 24 },
});
