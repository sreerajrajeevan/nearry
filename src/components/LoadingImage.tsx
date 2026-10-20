import React, { useRef, useState } from "react";
import {
  Image,
  ImageProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { LoadingDots } from "./LoadingDots";
import { colors } from "../theme";

/** Keep a reserved photo area visible while bytes arrive; callers retain their error fallback. */
export function LoadingImage({ style, onLoad, onError, ...props }: ImageProps) {
  const source = props.source;
  const uri =
    source && !Array.isArray(source) && typeof source !== "number"
      ? source.uri
      : undefined;
  const currentUri = useRef(uri);
  currentUri.current = uri;
  const [settledUri, setSettledUri] = useState<string>();
  const waiting = !!uri && settledUri !== uri;
  return (
    <View style={[style as StyleProp<ViewStyle>, styles.frame]}>
      <Image
        {...props}
        key={uri}
        style={StyleSheet.absoluteFill}
        fadeDuration={0}
        onLoad={(event) => {
          if (currentUri.current !== uri) return;
          setSettledUri(uri);
          onLoad?.(event);
        }}
        onError={(event) => {
          if (currentUri.current !== uri) return;
          setSettledUri(uri);
          onError?.(event);
        }}
      />
      {waiting && (
        <View
          pointerEvents="none"
          style={styles.placeholder}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <LoadingDots size={4} />
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { overflow: "hidden" },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
});
