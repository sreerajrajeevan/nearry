import React from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BackButton } from "../../components/BackButton";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeading } from "../../components/PageHeading";
import { QrCode } from "../../components/QrCode";
import { Screen } from "../../components/Screen";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { Alert } from "../../services/appAlert";
import { getMyBusinessVenue } from "../../services/verification";
import { colors, weight } from "../../theme";
import { newPlanShareUrl } from "../../utils/shareLink";

export const PLAYERS_CARD_TEXT =
  "Scan to post it on Nearry. Nearby players get an alert.";

/**
 * A card a venue prints or shares: players who are short of people scan it
 * and start a "Players needed now" plan at this venue.
 */
export function PlayersCardScreen() {
  const navigation = useNavigation();
  const { data, state, refresh } = useLiveQuery(
    "my-business-venue",
    getMyBusinessVenue,
  );
  const venue = data?.venue ?? null;
  const link = venue ? newPlanShareUrl(venue.id) : null;

  let body: React.ReactNode;
  if (state === "loading") body = <LoadingState label="Loading your card…" />;
  else if (state === "error")
    body = <Button title="Retry" onPress={() => void refresh()} />;
  else if (!venue)
    body = (
      <EmptyState
        title="Verify your venue to get your card"
        hint="Once your venue is approved, its card appears here."
      />
    );
  else if (!link)
    body = (
      <EmptyState
        title="Your card isn't set up yet"
        hint="This build has no share page. It will be ready in the next update."
      />
    );
  else
    body = (
      <>
        <View style={styles.card}>
          <Text style={styles.venue}>{venue.name}</Text>
          <Text style={styles.heading}>Short of players?</Text>
          <Text style={styles.copy}>{PLAYERS_CARD_TEXT}</Text>
          <View style={styles.qr}>
            <QrCode value={link} size={220} />
          </View>
          <Text style={styles.brand}>nearry</Text>
        </View>
        <Button
          title="Share card link"
          onPress={() =>
            void Share.share({
              message: `Short of players at ${venue.name}? Post it on Nearry and nearby players get an alert.\n${link}`,
            }).catch(() => Alert.alert("Could not share", "Please try again."))
          }
        />
        <Text style={styles.note}>
          Print it or screenshot it for your counter, courts or WhatsApp group.
        </Text>
      </>
    );

  return (
    <Screen scroll style={styles.page}>
      <BackButton onPress={() => navigation.goBack()} />
      <PageHeading
        greeting="Help players fill a game"
        title="Players-short card"
      />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14, paddingBottom: 32 },
  card: {
    backgroundColor: colors.night,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  venue: { fontSize: 14, color: colors.amberBright, ...weight("700") },
  heading: { fontSize: 28, lineHeight: 34, color: "#FFFFFF", ...weight("800") },
  copy: {
    fontSize: 15,
    lineHeight: 21,
    color: "#D1D5DB",
    textAlign: "center",
  },
  qr: { marginTop: 12, borderRadius: 16, overflow: "hidden" },
  brand: {
    marginTop: 10,
    fontSize: 18,
    color: colors.amber,
    ...weight("800"),
  },
  note: { fontSize: 13, lineHeight: 19, color: colors.textDim },
});
