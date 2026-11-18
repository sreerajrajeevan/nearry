import React, { useState } from "react";
import { photoThumbnail } from "../utils/photoRendition";
import {
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { colors } from "../theme";

/**
 * Remote photos, Instagram-style: a grey area while they load, a short fade
 * in, and a copy kept on the phone so scrolling back shows them at once.
 */
export function LoadingImage({
  source,
  style,
  resizeMode = "cover",
  onLoad,
  onError,
  accessibilityLabel,
  accessible,
  fullSize = false,
}: {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  resizeMode?: "cover" | "contain";
  onLoad?: () => void;
  onError?: () => void;
  accessibilityLabel?: string;
  accessible?: boolean;
  fullSize?: boolean;
}) {
  const uri =
    source && typeof source === "object" && "uri" in source
      ? source.uri
      : undefined;
  const [failed, setFailed] = useState<string | null>(null);
  const preview =
    uri && !fullSize && failed !== uri ? photoThumbnail(uri) : uri;
  return (
    <Image
      source={(uri ? { ...(source as object), uri: preview } : source) as never}
      style={[styles.frame, style as never]}
      contentFit={resizeMode}
      transition={180}
      cachePolicy="memory-disk"
      recyclingKey={
        source && typeof source === "object" && "uri" in source
          ? (source.uri as string)
          : undefined
      }
      onLoad={() => onLoad?.()}
      onError={() => {
        if (uri && preview !== uri) setFailed(uri);
        else onError?.();
      }}
      accessibilityLabel={accessibilityLabel}
      accessible={accessible}
    />
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: colors.surfaceRaised },
});
