import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Button } from "./Button";
import { colors, spacing, typography } from "../theme";
import { cropGeometry, Offset } from "../utils/photoCrop";

type Source = { uri: string; width: number; height: number };
/** App-owned controls stay inside safe areas, independent of OEM crop activities. */
export function PhotoCropper({
  uri,
  onCancel,
  onDone,
}: {
  uri: string;
  onCancel: () => void;
  onDone: (uri: string) => void;
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [ratio, setRatio] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    drag = useRef({ x: 0, y: 0 });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setSource(null);
    setError("");
    // Normalize EXIF orientation before calculating any crop coordinates.
    const context = ImageManipulator.manipulate(uri);
    void (async () => {
      const image = await context.renderAsync();
      try {
        const normalized = await image.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.95,
        });
        if (active) setSource(normalized);
      } finally {
        image.release();
      }
    })()
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Could not open photo.");
      })
      .finally(() => context.release());
    return () => {
      active = false;
    };
  }, [uri, retry]);
  const frameWidth = Math.max(1, Math.min(area.width, area.height * ratio));
  const frameHeight = frameWidth / ratio;
  const geometry =
    source && area.width && area.height
      ? cropGeometry(
          source,
          { width: frameWidth, height: frameHeight },
          zoom,
          offset,
        )
      : null;
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !lock.current,
      onMoveShouldSetPanResponder: () => !lock.current,
      onPanResponderGrant: () => {
        const g = geometryRef.current;
        drag.current = { x: g?.x ?? 0, y: g?.y ?? 0 };
      },
      onPanResponderMove: (_, gesture) =>
        setOffset({
          x: drag.current.x + gesture.dx,
          y: drag.current.y + gesture.dy,
        }),
      onPanResponderRelease: () => {
        const g = geometryRef.current;
        if (g) setOffset({ x: g.x, y: g.y });
      },
    }),
  ).current;
  const done = async () => {
    if (!source || !geometry || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const context = ImageManipulator.manipulate(source.uri);
    try {
      context.crop(geometry.crop);
      if (Math.max(geometry.crop.width, geometry.crop.height) > 1600)
        context.resize(
          geometry.crop.width >= geometry.crop.height
            ? { width: 1600 }
            : { height: 1600 },
        );
      const image = await context.renderAsync();
      try {
        const result = await image.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.85,
        });
        onDone(result.uri);
      } finally {
        image.release();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not crop photo. Try again.",
      );
    } finally {
      context.release();
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!lock.current) onCancel();
      }}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.toolbar}>
          <Button
            title="Cancel"
            variant="ghost"
            disabled={busy}
            onPress={onCancel}
          />
          <Text accessibilityRole="header" style={styles.title}>
            Crop photo
          </Text>
          <Button
            title="Done"
            loading={busy}
            disabled={!geometry}
            onPress={() => void done()}
          />
        </View>
        <Text style={styles.hint}>
          Drag to frame your photo. Use − and + to zoom.
        </Text>
        <View
          style={styles.area}
          onLayout={(e) => setArea(e.nativeEvent.layout)}
        >
          {geometry && source ? (
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel="Photo crop preview"
              {...responder.panHandlers}
              style={{
                width: frameWidth,
                height: frameHeight,
                overflow: "hidden",
                backgroundColor: colors.ink,
              }}
            >
              <Image
                source={{ uri: source.uri }}
                resizeMode="stretch"
                style={{
                  position: "absolute",
                  width: geometry.width,
                  height: geometry.height,
                  left: (frameWidth - geometry.width) / 2 + geometry.x,
                  top: (frameHeight - geometry.height) / 2 + geometry.y,
                }}
              />
              <View pointerEvents="none" style={styles.frame} />
            </View>
          ) : (
            !error && <ActivityIndicator color={colors.accent} />
          )}
        </View>
        <View style={styles.controls}>
          <View style={styles.row}>
            {[
              { r: 1, label: "Square" },
              { r: 4 / 5, label: "Portrait" },
              { r: 4 / 3, label: "Landscape" },
            ].map((item) => (
              <Button
                key={item.label}
                title={item.label}
                variant={ratio === item.r ? "primary" : "secondary"}
                disabled={busy || !source}
                style={styles.flex}
                onPress={() => {
                  setRatio(item.r);
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
              />
            ))}
          </View>
          <View style={styles.row}>
            <Button
              title="−"
              disabled={busy || zoom <= 1}
              onPress={() => setZoom((z) => Math.max(1, z - 0.25))}
            />
            <Text accessibilityLiveRegion="polite" style={styles.hint}>
              {zoom.toFixed(2)}×
            </Text>
            <Button
              title="+"
              disabled={busy || zoom >= 4}
              onPress={() => setZoom((z) => Math.min(4, z + 0.25))}
            />
            <Button
              title="Reset"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
            />
          </View>
          {!!error && (
            <Text
              accessibilityRole="alert"
              numberOfLines={2}
              style={styles.error}
            >
              {error}
            </Text>
          )}
          {!source && !!error ? (
            <Button
              title="Retry photo"
              onPress={() => setRetry((n) => n + 1)}
            />
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    flexShrink: 0,
  },
  title: { ...typography.heading, color: colors.text },
  hint: {
    ...typography.bodySmall,
    color: colors.textDim,
    paddingHorizontal: 16,
  },
  area: {
    flex: 1,
    minHeight: 0,
    margin: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: colors.white,
  },
  controls: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, flexShrink: 0 },
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1, minWidth: 0 },
  error: { ...typography.bodySmall, color: colors.red },
});
