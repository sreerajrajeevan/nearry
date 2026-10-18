import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { Icon, IconName } from "../../components/Icon";
import { colors, typography, spacing } from "../../theme";
import { VenueDetailsProps } from "../../navigation/types";
import { getVenue } from "../../services/venues";
import { listPosts } from "../../services/posts";
import { listVenuePhotos, PhotoRef } from "../../services/photos";
import { Venue, NeedPost } from "../../services/mappers";
import { vacanciesLeft } from "../../utils/format";

/** Map common amenity names to Feather icons; fallback to "check". */
function amenityIcon(name: string): IconName {
  const n = name.toLowerCase();
  if (n.includes("washroom") || n.includes("toilet")) return "droplet";
  if (n.includes("park")) return "map-pin";
  if (n.includes("water")) return "droplet";
  if (n.includes("chang")) return "user";
  if (n.includes("equipment") || n.includes("rental")) return "tool";
  if (n.includes("first aid") || n.includes("medical")) return "plus-circle";
  if (n.includes("cafe") || n.includes("food") || n.includes("canteen"))
    return "coffee";
  if (n.includes("locker")) return "lock";
  if (n.includes("wifi")) return "wifi";
  if (n.includes("ac") || n.includes("air")) return "wind";
  if (n.includes("power") || n.includes("backup")) return "zap";
  if (n.includes("seat")) return "users";
  return "check";
}

/** Venue details + open posts at this venue. */
export function VenueDetailsScreen({ route, navigation }: VenueDetailsProps) {
  const { venueId } = route.params;
  const [venue, setVenue] = useState<Venue | null>(null);
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [photos, setPhotos] = useState<PhotoRef[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const v = await getVenue(venueId);
      if (!v) throw new Error("Venue not found.");
      setVenue(v);
      const [all, venuePhotos] = await Promise.all([
        listPosts({ status: "open" }),
        listVenuePhotos(venueId).catch(() => [] as PhotoRef[]),
      ]);
      setPosts(
        all.filter((p) => p.venueId === venueId || p.venueName === v.name),
      );
      setPhotos(venuePhotos);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [venueId]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (state === "loading") {
    return (
      <Screen padded>
        <Text style={styles.status}>Loading…</Text>
      </Screen>
    );
  }
  if (state === "error" || !venue) {
    return (
      <Screen padded>
        <EmptyState
          title="Couldn't load this venue"
          hint="Check your connection and retry."
        />
        <Button title="Retry" onPress={load} />
        <View style={styles.gap} />
        <Button
          title="Go back"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.back}
        >
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        {photos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryRow}
          >
            {photos.map((p) => (
              <Image
                key={p.id}
                source={{ uri: p.photo_url }}
                style={styles.galleryImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}
        <View style={styles.header}>
          <Text style={styles.title}>{venue.name}</Text>
          <Badge
            label={venue.openNow ? "OPEN NOW" : "CLOSED"}
            tone={venue.openNow ? "green" : "red"}
          />
        </View>
        <Text style={styles.meta}>
          {venue.category} · {venue.area}
        </Text>
        <Text style={styles.meta}>★ {venue.rating.toFixed(1)}</Text>

        {venue.amenities.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>AMENITIES</Text>
            <View style={styles.amenityGrid}>
              {venue.amenities.map((a) => (
                <View key={a} style={styles.amenityCell}>
                  <Icon
                    name={amenityIcon(a)}
                    size={16}
                    color={colors.textDim}
                  />
                  <Text style={styles.amenityLabel} numberOfLines={1}>
                    {a}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>HAPPENING HERE · {posts.length}</Text>
        {posts.length === 0 ? (
          <EmptyState
            title="Nothing scheduled here"
            hint="Be the first to post an activity."
          />
        ) : (
          posts.map((p) => (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate("PostDetails", { postId: p.id })
              }
            >
              <Card style={styles.postCard}>
                <Text style={styles.postTitle}>{p.title}</Text>
                <Text style={styles.postMeta}>
                  {p.startsAt} · {p.authorName}
                </Text>
                <Badge
                  label={vacanciesLeft(p.vacancies, p.joinedCount)}
                  tone={p.spotsLeft > 0 ? "green" : "red"}
                />
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  status: { ...typography.label, color: colors.textDim, marginTop: spacing.xl },
  back: { marginBottom: spacing.md, alignSelf: "flex-start" },
  backText: { ...typography.label, color: colors.textDim },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.text, flex: 1 },
  meta: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
  sectionTitle: {
    ...typography.label,
    color: colors.textDim,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  postCard: { marginBottom: spacing.md },
  galleryRow: { gap: spacing.sm, marginBottom: spacing.md },
  galleryImage: {
    width: 220,
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
  },
  amenityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },
  amenityCell: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  amenityLabel: { ...typography.body, color: colors.text, flex: 1 },  postTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  postMeta: {
    ...typography.caption,
    color: colors.textDim,
    marginBottom: spacing.sm,
  },
  gap: { height: spacing.md },
});
