import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PersonalStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PostRow } from "../../components/PostRow";
import { OfferRow } from "../../components/OfferRow";
import { PlaceAttributions } from "../../components/PlaceSuggestions";
import { nearbyVenues } from "../../services/venues";
import { listPosts } from "../../services/posts";
import { listLiveOffers } from "../../services/offers";
import { NeedPost, Offer, Venue } from "../../services/mappers";
import { validPlace } from "../../services/places";
import { colors, typography, spacing } from "../../theme";
type Props = NativeStackScreenProps<PersonalStackParamList, "PlaceDetails">;
export function PlaceDetailsScreen({ route, navigation }: Props) {
  const { place } = route.params;
  const [venues, setVenues] = useState<Venue[]>([]),
    [posts, setPosts] = useState<NeedPost[]>([]),
    [offers, setOffers] = useState<Offer[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const version = useRef(0),
    focused = useRef(false);
  const load = useCallback(async () => {
    const ticket = ++version.current;
    setState("loading");
    try {
      if (!validPlace(place)) throw new Error("Invalid place");
      const venues = await nearbyVenues(place.latitude, place.longitude, 5000);
      const ids = venues.map((venue) => venue.id);
      const [posts, offers] = await Promise.all([
        listPosts({ venueIds: ids }),
        listLiveOffers(ids),
      ]);
      if (focused.current && ticket === version.current) {
        setVenues(venues);
        setPosts(posts);
        setOffers(offers);
        setState("ready");
      }
    } catch {
      if (focused.current && ticket === version.current) setState("error");
    }
  }, [place]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void load();
      return () => {
        focused.current = false;
        ++version.current;
      };
    }, [load]),
  );
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{place.name}</Text>
        <Text style={styles.meta}>{place.address}</Text>
        <PlaceAttributions places={[place]} />
        <Text style={styles.section}>
          {place.provider === "demo"
            ? "Sample area preview"
            : "Near this place · Within 5 km"}
        </Text>
        {state === "loading" ? (
          <Text style={styles.meta}>Finding nearby plans and openings…</Text>
        ) : state === "error" ? (
          <>
            <EmptyState
              title="Couldn’t load this area"
              hint="Check your connection and retry."
            />
            <Button title="Retry" onPress={() => void load()} />
          </>
        ) : (
          <>
            {!posts.length && !offers.length && (
              <EmptyState
                title="No plans here yet"
                hint="This location is searchable even when nobody has posted nearby."
              />
            )}
            {posts.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                onPress={() =>
                  navigation.navigate("PostDetails", { postId: post.id })
                }
              />
            ))}
            {offers.map((offer) => (
              <OfferRow
                key={offer.id}
                offer={offer}
                onPress={() =>
                  navigation.navigate("OfferDetails", { offerId: offer.id })
                }
              />
            ))}
            {!!venues.length && (
              <Text style={styles.section}>Places on Nearry</Text>
            )}
            {venues.slice(0, 8).map((venue) => (
              <TouchableOpacity
                key={venue.id}
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate("VenueDetails", { venueId: venue.id })
                }
                style={styles.row}
              >
                <Text style={styles.venue}>{venue.name}</Text>
                <Text style={styles.meta}>
                  {venue.category} · {venue.area}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        <View style={styles.action}>
          <Button
            title="Use this area in Nearby"
            variant="secondary"
            onPress={() =>
              navigation.navigate("PersonalTabs", {
                screen: "Nearby",
                params: { place },
              })
            }
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.md, paddingBottom: spacing.xl },
  back: {
    ...typography.label,
    color: colors.textDim,
    marginBottom: spacing.lg,
  },
  title: { ...typography.title, color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textDim, marginTop: 4 },
  section: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  venue: { ...typography.heading, color: colors.text },
  action: { marginTop: spacing.xl },
});
