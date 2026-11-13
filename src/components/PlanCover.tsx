import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { NeedPost } from "../services/mappers";
import { activityArtwork } from "../utils/activityArtwork";
import { postCategory } from "../utils/discovery";
import { colors } from "../theme";
import { LoadingImage } from "./LoadingImage";
import { ActivityArt } from "./ActivityArt";
import { DemoPhoto } from "./DemoPhoto";

/** Only uploaded photos represent a real plan; missing photos use honest activity artwork. */
export function PlanCover({
  post,
  aspectRatio = 1.95,
  artworkSize = 112,
  fill = false,
}: {
  post: NeedPost;
  aspectRatio?: number;
  artworkSize?: number;
  /** Stretch inside a side-photo row as its text grows (including system text). */
  fill?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [post.coverPhotoUrl]);
  const category = postCategory(post);
  const artwork = activityArtwork(post);
  return (
    <View
      style={[
        styles.cover,
        fill ? styles.fill : { aspectRatio },
        {
          backgroundColor:
            artwork === "fitness"
              ? "#21232C"
              : category === "Meet"
                ? colors.sandSoft
                : category === "Unwind"
                  ? colors.goldSoft
                  : colors.sageSoft,
        },
      ]}
    >
      {post.coverPhotoUrl && !failed ? (
        <LoadingImage
          source={{ uri: post.coverPhotoUrl }}
          resizeMode="cover"
          style={styles.image}
          onError={() => setFailed(true)}
        />
      ) : post.demoScene && !post.coverPhotoUrl ? (
        <DemoPhoto scene={post.demoScene} />
      ) : (
        <ActivityArt artwork={artwork} size={artworkSize} />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  cover: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fill: { flex: 1 },
  image: { width: "100%", height: "100%" },
});
