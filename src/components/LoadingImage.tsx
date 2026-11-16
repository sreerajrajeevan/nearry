import React from "react";
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
}: {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  resizeMode?: "cover" | "contain";
  onLoad?: () => void;
  onError?: () => void;
  accessibilityLabel?: string;
  accessible?: boolean;
}) {
  return (
    <Image
      source={source as never}
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
      onError={() => onError?.()}
      accessibilityLabel={accessibilityLabel}
      accessible={accessible}
    />
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: colors.surfaceRaised },
});
