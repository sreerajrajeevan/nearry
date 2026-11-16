import { BusinessVenueFields } from "../../components/BusinessVenueFields";
import {
  BusinessVenueSubmission,
  BusinessVenueState,
  businessVenueError,
} from "../../utils/businessVenue";
import { Alert } from "../../services/appAlert";
import { BackButton } from "../../components/BackButton";
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BusinessStackParamList } from "../../navigation/types";
import { PageHeading } from "../../components/PageHeading";
import { Screen } from "../../components/Screen";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { Avatar } from "../../components/Avatar";
import { VerifiedWelcome } from "../../components/VerifiedWelcome";
import {
  AccountMenuGroup,
  AccountMenuRow,
} from "../../components/AccountMenuRow";
import { colors, typography, spacing, surfaces } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { useUnreadCounts } from "../../hooks/useUnreadCounts";
import {
  getVerificationState,
  getMyBusinessVenue,
  submitVerificationDoc,
  VerificationState,
} from "../../services/verification";
import { getVenue } from "../../services/venues";
import { Venue } from "../../services/mappers";
import { isDemoMode } from "../../services/supabase";

const STATUS_COPY: Record<VerificationState, string> = {
  unverified:
    "Submit your business proof, address and map location for review.",
  pending: "Under review. You can publish once approved.",
  verified: "Verified. Your offers can go live.",
  rejected: "Update your business proof or location and submit again.",
};

function statusTone(s: VerificationState): "neutral" | "green" | "red" {
  if (s === "verified") return "green";
  if (s === "pending") return "neutral";
  return "red";
}

/** Business profile: verification, venue association, sign out. */
type Props = {
  navigation: Pick<
    NativeStackNavigationProp<BusinessStackParamList>,
    "navigate" | "goBack"
  >;
  verificationOnly?: boolean;
  onCreateOffer?: () => void;
};

export function BusinessProfileScreen({
  navigation,
  verificationOnly = false,
  onCreateOffer,
}: Props) {
  const { profile, refreshProfile, signOut } = useAuth();
  const { notifications } = useUnreadCounts();
  const [verif, setVerif] = useState<{
    status: VerificationState;
    docPath?: string;
    note?: string;
  }>({
    status: profile?.verificationStatus ?? "unverified",
  });
  const [venueState, setVenueState] = useState<BusinessVenueState | null>(null);
  const [venueLocating, setVenueLocating] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [venueDraft, setVenueDraft] = useState<BusinessVenueSubmission>({
    name: profile?.businessName || "",
    category: String(profile?.businessDetails?.category || ""),
    area: String(profile?.businessDetails?.area || ""),
    address: "",
    latitude: NaN,
    longitude: NaN,
    source: "manual",
  });
  const venueInitialized = React.useRef(false);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const submitLock = React.useRef(false);

  const load = useCallback(async () => {
    if (!profile || isDemoMode()) return;
    try {
      setVerificationError("");
      const latest = await getVerificationState(profile.id);
      setVerif(latest);
      const location = await getMyBusinessVenue();
      setVenueState(location);
      if (!venueInitialized.current && location.submission)
        setVenueDraft(location.submission);
      venueInitialized.current = true;
      // Approval can arrive while this screen is open. Keep the Create gate in sync.
      if (latest.status !== profile.verificationStatus) await refreshProfile();
      if (!verificationOnly) {
        setVenue(location.venue ? await getVenue(location.venue.id) : null);
      }
    } catch (error) {
      setVerificationError(
        error instanceof Error
          ? error.message
          : "Could not refresh verification. Please try again.",
      );
    }
  }, [profile, verificationOnly]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const name = profile?.businessName || profile?.displayName || "Your business";
  const details = (profile?.businessDetails ?? {}) as {
    category?: string;
    area?: string;
  };
  const category = details.category || "";

  const onSubmitDoc = async () => {
    if (!profile || submitLock.current) return;
    submitLock.current = true;
    setBusy("doc");
    try {
      const validation = businessVenueError(venueDraft);
      if (validation) throw new Error(validation);
      if (!locationConfirmed)
        throw new Error(
          "Confirm that the address and map pin belong to your business.",
        );
      await submitVerificationDoc(profile.id, venueDraft);
      await refreshProfile();
      await load();
      Alert.alert(
        "Submitted",
        "Your business document and venue location are under review.",
      );
    } catch (e) {
      Alert.alert(
        "Could not submit",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      submitLock.current = false;
      setBusy(null);
    }
  };

  const needsLocation =
    verif.status === "verified" && venueState !== null && !venueState.venue;
  const canSubmit =
    !!venueState &&
    (verif.status === "unverified" ||
      verif.status === "rejected" ||
      needsLocation ||
      (verif.status === "pending" && !venueState.submission));
  const verificationCard = (
    <>
      {verif.status === "verified" && !needsLocation ? (
        <VerifiedWelcome businessName={name} />
      ) : (
        <Card style={styles.verifyCard} accent={true}>
          <View style={styles.verifyRow}>
            <Text style={styles.verifyTitle}>Business verification</Text>
            <Badge
              label={needsLocation ? "ADD VENUE" : verif.status.toUpperCase()}
              tone={needsLocation ? "neutral" : statusTone(verif.status)}
            />
          </View>
          <Text style={styles.verifyDesc}>
            {needsLocation
              ? "Your account is verified. Submit your venue’s address and location so the admin can link your offers."
              : STATUS_COPY[verif.status]}
          </Text>
          {verif.status === "pending" && venueState?.submission && (
            <Text style={styles.verifyDesc}>
              {venueState.submission.name}
              {"\n"}
              {venueState.submission.address}
              {"\n"}Your submitted location is locked while under review.
            </Text>
          )}
          {canSubmit && (
            <>
              <BusinessVenueFields
                value={venueDraft}
                onChange={(v) => {
                  setVenueDraft(v);
                  setLocationConfirmed(false);
                }}
                disabled={busy === "doc"}
                onLocatingChange={(locating) => {
                  setVenueLocating(locating);
                  if (locating) setLocationConfirmed(false);
                }}
              />
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: locationConfirmed }}
                disabled={busy === "doc" || venueLocating}
                onPress={() => setLocationConfirmed(!locationConfirmed)}
                style={{ paddingVertical: spacing.md }}
              >
                <Text style={styles.verifyDesc}>
                  {locationConfirmed ? "☑" : "☐"} This is my business’s public
                  address and exact location. I checked the map pin.
                </Text>
              </TouchableOpacity>
            </>
          )}
          {verif.status === "rejected" && verif.note ? (
            <Text style={styles.verifyNote}>Reason: {verif.note}</Text>
          ) : null}
          {canSubmit && !isDemoMode() && (
            <Button
              title="Choose proof & submit for review"
              disabled={!locationConfirmed || venueLocating}
              variant="secondary"
              loading={busy === "doc"}
              onPress={onSubmitDoc}
              style={styles.verifyBtn}
            />
          )}
        </Card>
      )}
      {!!verificationError && (
        <View style={{ marginTop: spacing.md }}>
          <Text accessibilityRole="alert" style={styles.verifyNote}>
            {verificationError}
          </Text>
          <Button
            title="Retry verification status"
            variant="secondary"
            onPress={() => void load()}
          />
        </View>
      )}
    </>
  );
  if (verificationOnly) {
    return (
      <Screen keyboard>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  await load();
                } finally {
                  setRefreshing(false);
                }
              }}
            />
          }
        >
          <BackButton onPress={() => navigation.goBack()} />
          <PageHeading
            greeting={name}
            title="Business verification"
            subtitle="Get verified before creating an offer."
          />
          {verificationCard}
          {isDemoMode() ? (
            <Text style={styles.verifyDesc}>
              Preview only. Document submission needs a real business account.
            </Text>
          ) : null}
          {verif.status === "verified" &&
          !!venueState?.venue &&
          !verificationError &&
          onCreateOffer ? (
            <Button
              title="Create an offer"
              onPress={onCreateOffer}
              style={styles.verifyBtn}
            />
          ) : (
            <>
              <Text style={styles.verifyDesc}>
                {verif.status === "pending"
                  ? "Your document is with the Nearry team. You don’t need to submit it again while it’s under review."
                  : verif.status === "verified"
                    ? "Refresh to check your latest verification status."
                    : "Upload a clear image of your business licence or registration. The document is private and reviewed by the Nearry team."}
              </Text>
              <Button
                title="Refresh verification status"
                variant="secondary"
                onPress={async () => {
                  setRefreshing(true);
                  try {
                    await load();
                  } finally {
                    setRefreshing(false);
                  }
                }}
                loading={refreshing}
                style={styles.verifyBtn}
              />
            </>
          )}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={styles.headerRow}>
          <Avatar name={name} size={64} uri={profile?.avatarUrl} />
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.category}>
              {[category, details.area].filter(Boolean).join(" · ") ||
                "Business"}
            </Text>
          </View>
        </View>

        {isDemoMode() && (
          <View style={styles.demoRow}>
            <Badge label="Demo mode" />
          </View>
        )}

        <Text style={styles.sectionTitle}>Verification</Text>
        {verificationCard}

        <AccountMenuGroup>
          <AccountMenuRow
            icon="edit"
            title="Edit profile"
            hint="Business name, category and area"
            onPress={() => navigation.navigate("EditBusinessProfile")}
          />
          <AccountMenuRow
            icon="file-text"
            title="My offers"
            hint="Your live offers, drafts and past offers"
            onPress={() => navigation.navigate("MyOffers")}
          />
        </AccountMenuGroup>

        <Text style={styles.sectionTitle}>My venue</Text>
        {venue ? (
          <TouchableOpacity
            onPress={() => navigation.navigate("ManageVenue")}
            activeOpacity={0.7}
          >
            <Card>
              <Text style={styles.venueName}>{venue.name}</Text>
              <Text style={styles.venueMeta}>
                {venue.category} · {venue.area}
              </Text>
              <Text style={styles.venueManage}>
                Manage photos & amenities →
              </Text>
            </Card>
          </TouchableOpacity>
        ) : (
          <Text style={styles.venueHint}>
            Submit your venue’s address and location with your business proof
            above. Admin approval will link it to your offers automatically.
          </Text>
        )}

        <Text style={styles.sectionTitle}>Settings & privacy</Text>
        <AccountMenuGroup>
          <AccountMenuRow
            icon="bell"
            title="Notifications"
            hint="Updates about bookings and your business"
            count={notifications}
            onPress={() => navigation.navigate("Notifications")}
          />
          <AccountMenuRow
            icon="shield"
            title="Safety & privacy"
            hint="Blocked people, reports and account deletion"
            onPress={() => navigation.navigate("SafetyPrivacy")}
          />
          <AccountMenuRow
            icon="sliders"
            title="Notification preferences"
            hint="Choose which updates you receive"
            onPress={() => navigation.navigate("NotificationSettings")}
          />
        </AccountMenuGroup>
        <Button
          title="Log out"
          variant="danger"
          onPress={() => {
            void signOut().catch((e) =>
              Alert.alert(
                "Could not sign out",
                e instanceof Error ? e.message : "Please retry.",
              ),
            );
          }}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  headerRow: {
    ...surfaces.hero,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  nameBlock: { flex: 1 },
  name: { ...typography.title, color: colors.onAccent },
  category: {
    ...typography.caption,
    color: colors.goldSoft,
    marginTop: spacing.xs,
  },
  demoRow: { marginTop: spacing.md, alignItems: "flex-start" },
  sectionTitle: {
    ...typography.label,
    color: colors.textDim,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  verifyCard: {},
  verifyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  verifyTitle: { ...typography.label, color: colors.text },
  verifyDesc: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: spacing.sm,
  },
  verifyNote: { ...typography.body, color: colors.red, marginTop: spacing.xs },
  verifyBtn: { marginTop: spacing.md },
  venueHint: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginBottom: spacing.sm,
  },
  venueName: { ...typography.heading, color: colors.text },
  venueMeta: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  venueManage: {
    ...typography.label,
    color: colors.accent,
    marginTop: spacing.sm,
  },
  logoutBtn: { marginTop: spacing.md },
});
