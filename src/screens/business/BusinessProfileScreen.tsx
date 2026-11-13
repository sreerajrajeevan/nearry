import { Alert } from "../../services/appAlert";
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
import { Icon } from "../../components/Icon";
import { colors, typography, spacing, surfaces } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { useUnreadCounts } from "../../hooks/useUnreadCounts";
import {
  getVerificationState,
  submitVerificationDoc,
  VerificationState,
} from "../../services/verification";
import { listVenues } from "../../services/venues";
import { Venue } from "../../services/mappers";
import { isDemoMode } from "../../services/supabase";

const STATUS_COPY: Record<VerificationState, string> = {
  unverified: "Not verified. Submit a business document to get reviewed.",
  pending: "Under review. You can publish once approved.",
  verified: "Verified. Your offers can go live.",
  rejected: "Not approved. Submit a clearer document to try again.",
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
      // Approval can arrive while this screen is open. Keep the Create gate in sync.
      if (latest.status !== profile.verificationStatus) await refreshProfile();
      if (!verificationOnly) {
        const venues = await listVenues();
        setVenue(venues.find((v) => v.businessId === profile.id) ?? null);
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
      await submitVerificationDoc(profile.id);
      await refreshProfile();
      await load();
      Alert.alert("Submitted", "Your documents are under review.");
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

  const verificationCard = (
    <>
      {verif.status === "verified" ? (
        <VerifiedWelcome businessName={name} />
      ) : (
        <Card style={styles.verifyCard} accent={true}>
          <View style={styles.verifyRow}>
            <Text style={styles.verifyTitle}>Business verification</Text>
            <Badge
              label={verif.status.toUpperCase()}
              tone={statusTone(verif.status)}
            />
          </View>
          <Text style={styles.verifyDesc}>{STATUS_COPY[verif.status]}</Text>
          {verif.status === "rejected" && verif.note ? (
            <Text style={styles.verifyNote}>Reason: {verif.note}</Text>
          ) : null}
          {(verif.status === "unverified" || verif.status === "rejected") &&
            !isDemoMode() && (
              <Button
                title="Submit document"
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
      <Screen>
        <ScrollView
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
          <Button
            title="Back"
            variant="ghost"
            onPress={() => navigation.goBack()}
          />
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
    <Screen>
      <ScrollView
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

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.65}
          style={styles.menuRow}
          onPress={() => navigation.navigate("EditBusinessProfile")}
        >
          <Icon name="edit" size={18} color={colors.accent} />
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>Edit profile</Text>
            <Text style={styles.menuHint}>
              Business name, category and area
            </Text>
          </View>
          <Icon name="arrow-up-right" size={17} color={colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.65}
          style={styles.menuRow}
          onPress={() => navigation.navigate("MyOffers")}
        >
          <Icon name="file-text" size={18} color={colors.accent} />
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>My offers</Text>
            <Text style={styles.menuHint}>
              Your live offers, drafts and past offers
            </Text>
          </View>
          <Icon name="arrow-up-right" size={17} color={colors.accent} />
        </TouchableOpacity>

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
            Your venue is linked by the reviewer alongside your business
            verification — nothing to do here.
          </Text>
        )}

        <Button
          title={`Notifications${notifications > 0 ? ` (${notifications})` : ""}`}
          variant="secondary"
          onPress={() => navigation.navigate("Notifications")}
          style={styles.notifBtn}
        />
        <Button
          title="Safety & privacy"
          variant="secondary"
          onPress={() => navigation.navigate("SafetyPrivacy")}
        />
        <Button
          title="Notification preferences"
          variant="secondary"
          onPress={() => navigation.navigate("NotificationSettings")}
        />
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
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuCopy: { flex: 1, gap: 3 },
  menuTitle: { ...typography.body, color: colors.text },
  menuHint: { ...typography.caption, color: colors.textDim },
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
  notifBtn: { marginTop: spacing.xl },
  logoutBtn: { marginTop: spacing.md },
});
