import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { GestureResponderEvent } from "react-native";
import Slider from "@react-native-community/slider";
import { SafeAreaView } from "react-native-safe-area-context";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { colors, spacing, typography } from "../theme";
import { cropGeometry, Offset } from "../utils/photoCrop";
import {
  beginCropGesture,
  moveCropGesture,
  CropGesture,
} from "../utils/cropGesture";

type Source = { uri: string; width: number; height: number };
/** App-owned controls stay inside safe areas, independent of OEM crop activities. */
export function PhotoCropper({
  uri,
  onCancel,
  onDone,
  variant = "post",
}: {
  uri: string;
  onCancel: () => void;
  onDone: (uri: string) => void;
  variant?: "post" | "avatar";
}) {
  const avatar = variant === "avatar";
  const [source, setSource] = useState<Source | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [ratio, setRatio] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const gestureStart = useRef<CropGesture | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
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
  const frameWidth = Math.max(
    1,
    Math.min(area.width, area.height * ratio, avatar ? 340 : Infinity),
  );
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
  const frameRef = useRef({ width: frameWidth, height: frameHeight });
  frameRef.current = { width: frameWidth, height: frameHeight };
  const points = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;
    return touches?.length
      ? touches.map((t) => ({ x: t.pageX, y: t.pageY }))
      : [{ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }];
  };
  const remember = (event: GestureResponderEvent) => {
    const g = geometryRef.current;
    if (!g) return;
    gestureStart.current = beginCropGesture(
      points(event),
      zoomRef.current,
      { x: g.x, y: g.y },
      {
        x: event.nativeEvent.pageX - event.nativeEvent.locationX,
        y: event.nativeEvent.pageY - event.nativeEvent.locationY,
      },
      frameRef.current,
    );
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !lock.current,
      onMoveShouldSetPanResponder: () => !lock.current,
      onPanResponderGrant: remember,
      onPanResponderStart: remember,
      onPanResponderMove: (event) => {
        if (lock.current) return;
        const start = gestureStart.current;
        const next = start && moveCropGesture(start, points(event));
        // Rebase when a finger is added/lifted so the photo never jumps.
        if (!next) {
          remember(event);
          return;
        }
        zoomRef.current = next.zoom;
        setZoom(next.zoom);
        setOffset(next.offset);
      },
      onPanResponderEnd: (event) => {
        if (event.nativeEvent.touches?.length) remember(event);
      },
      onPanResponderRelease: () => {
        gestureStart.current = null;
        const g = geometryRef.current;
        if (g) setOffset({ x: g.x, y: g.y });
      },
      onPanResponderTerminate: () => {
        gestureStart.current = null;
      },
      onPanResponderTerminationRequest: () => false,
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
      const outputMax = avatar ? 1024 : 1600;
      if (Math.max(geometry.crop.width, geometry.crop.height) > outputMax)
        context.resize(
          geometry.crop.width >= geometry.crop.height
            ? { width: outputMax }
            : { height: outputMax },
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
  const reset = () => {
    zoomRef.current = 1;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const changeZoom = (value: number) => {
    if (lock.current) return;
    const next = Math.min(4, Math.max(1, value));
    const g = geometryRef.current;
    const factor = next / zoomRef.current;
    if (g) setOffset({ x: g.x * factor, y: g.y * factor });
    zoomRef.current = next;
    setZoom(next);
  };
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (!lock.current) onCancel();
      }}
    >
      <SafeAreaView style={[styles.screen, avatar && styles.avatarScreen]}>
        {avatar && (
          <StatusBar barStyle="light-content" backgroundColor={colors.night} />
        )}
        {avatar ? (
          <View style={styles.avatarToolbar}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cancel photo editing"
              disabled={busy}
              onPress={onCancel}
              style={styles.iconButton}
            >
              <Icon name="x" color={colors.white} size={24} />
            </TouchableOpacity>
            <Text accessibilityRole="header" style={styles.avatarTitle}>
              Profile photo
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Reset photo position and zoom"
              disabled={busy || !source}
              onPress={reset}
              style={styles.iconButton}
            >
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
        )}
        <Text style={[styles.hint, avatar && styles.avatarHint]}>
          {avatar
            ? "Drag to move. Pinch or use the slider to zoom."
            : "Drag to frame your photo. Use − and + to zoom."}
        </Text>
        <View
          style={[styles.area, avatar && styles.avatarArea]}
          onLayout={(e) => setArea(e.nativeEvent.layout)}
        >
          {geometry && source ? (
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={
                avatar
                  ? "Circular profile photo preview. Drag to reposition."
                  : "Photo crop preview"
              }
              {...responder.panHandlers}
              style={{
                width: frameWidth,
                height: frameHeight,
                overflow: "hidden",
                backgroundColor: colors.ink,
                borderRadius: avatar ? frameWidth / 2 : 0,
              }}
            >
              <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
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
              </View>
              <View
                pointerEvents="none"
                style={[
                  styles.frame,
                  avatar && { borderRadius: frameWidth / 2 },
                ]}
              />
            </View>
          ) : (
            !error && (
              <ActivityIndicator
                color={avatar ? colors.amber : colors.accent}
              />
            )
          )}
        </View>
        <View style={[styles.controls, avatar && styles.avatarControls]}>
          {avatar ? (
            <>
              <Text style={styles.previewHint}>
                Your profile photo will look like this.
              </Text>
              <View style={styles.row}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Zoom out"
                  disabled={busy || !source || zoom <= 1}
                  onPress={() => changeZoom(zoomRef.current - 0.25)}
                  style={styles.iconButton}
                >
                  <Icon name="minus" color={colors.white} />
                </TouchableOpacity>
                <Slider
                  style={styles.slider}
                  accessibilityLabel="Photo zoom"
                  accessibilityValue={{
                    min: 1,
                    max: 4,
                    now: zoom,
                    text: `${zoom.toFixed(2)} times`,
                  }}
                  accessibilityActions={[
                    { name: "increment", label: "Zoom in" },
                    { name: "decrement", label: "Zoom out" },
                  ]}
                  onAccessibilityAction={(event) =>
                    changeZoom(
                      zoomRef.current +
                        (event.nativeEvent.actionName === "increment"
                          ? 0.25
                          : -0.25),
                    )
                  }
                  minimumValue={1}
                  maximumValue={4}
                  value={zoom}
                  disabled={busy || !source}
                  onValueChange={changeZoom}
                  minimumTrackTintColor={colors.amber}
                  maximumTrackTintColor="#64748B"
                  thumbTintColor={colors.amber}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Zoom in"
                  disabled={busy || !source || zoom >= 4}
                  onPress={() => changeZoom(zoomRef.current + 0.25)}
                  style={styles.iconButton}
                >
                  <Icon name="plus" color={colors.white} />
                </TouchableOpacity>
              </View>
              <Button
                title="Set photo"
                loading={busy}
                disabled={!geometry}
                onPress={() => void done()}
              />
            </>
          ) : (
            <>
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
                  onPress={() => changeZoom(zoomRef.current - 0.25)}
                />
                <Text accessibilityLiveRegion="polite" style={styles.hint}>
                  {zoom.toFixed(2)}×
                </Text>
                <Button
                  title="+"
                  disabled={busy || zoom >= 4}
                  onPress={() => changeZoom(zoomRef.current + 0.25)}
                />
                <Button
                  title="Reset"
                  variant="ghost"
                  disabled={busy}
                  onPress={reset}
                />
              </View>
            </>
          )}
          {!!error && (
            <Text
              accessibilityRole="alert"
              numberOfLines={2}
              style={[styles.error, avatar && { color: "#FECACA" }]}
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
  avatarScreen: { backgroundColor: colors.night },
  avatarToolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    minHeight: 60,
  },
  avatarTitle: {
    ...typography.heading,
    fontSize: 19,
    flex: 1,
    textAlign: "center",
    color: colors.white,
  },
  iconButton: {
    minWidth: 52,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: { ...typography.bodySmall, color: colors.white },
  avatarHint: { color: "#CBD5E1", textAlign: "center", marginTop: 12 },
  avatarArea: { margin: 24 },
  avatarControls: { paddingHorizontal: 24, paddingBottom: 20, gap: 16 },
  previewHint: {
    ...typography.bodySmall,
    color: "#CBD5E1",
    textAlign: "center",
  },
  slider: { flex: 1, height: 48 },
});
