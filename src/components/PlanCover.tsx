import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { NeedPost } from "../services/mappers";
import { activityArtwork } from "../utils/activityArtwork";
import { postCategory } from "../utils/discovery";
import { colors } from "../theme";
import { LoadingImage } from "./LoadingImage";
import { ActivityArt } from "./ActivityArt";

/** Only uploaded photos represent a real plan; missing photos use honest activity artwork. */
export function PlanCover({
  post,
  aspectRatio = 1.95,
  artworkSize = 112,
}: {
  post: NeedPost;
  aspectRatio?: number;
  artworkSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [post.coverPhotoUrl]);
  const category = postCategory(post);
  return (
    <View
      style={[
        styles.cover,
        { aspectRatio },
        {
          backgroundColor:
            category === "Meet"
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
      ) : (
        <ActivityArt artwork={activityArtwork(post)} size={artworkSize} />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  cover: {
    width: "100%",
    aspectRatio: 1.95,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
});
