import { enablePushNotifications } from "../../services/notifications";
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { Avatar } from "../../components/Avatar";
import { VerifiedWelcome } from "../../components/VerifiedWelcome";
import { Icon } from "../../components/Icon";
import { colors, typography, spacing } from "../../theme";
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
  navigation: { navigate: (screen: string) => void };
};

export function BusinessProfileScreen({ navigation }: Props) {
  const { profile, refreshProfile, signOut } = useAuth();
  const { notifications } = useUnreadCounts();
  const [verif, setVerif] = useState<{
    status: VerificationState;
    docPath?: string;
    note?: string;
  }>({
    status: "unverified",
  });
  const [venue, setVenue] = useState<Venue | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile || isDemoMode()) return;
    try {
      setVerif(await getVerificationState(profile.id));
      const venues = await listVenues();
      setVenue(venues.find((v) => v.businessId === profile.id) ?? null);
    } catch {
      /* keep last known */
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);
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
    if (!profile) return;
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
      setBusy(null);
    }
  };

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
        <Button
          title="My offers"
          variant="secondary"
          onPress={() => navigation.navigate("MyOffers")}
        />
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
            <Badge label="Demo mode" tone="red" />
          </View>
        )}

        <Text style={styles.sectionTitle}>Verification</Text>
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
          title="Enable notifications"
          variant="secondary"
          onPress={() => {
            if (profile)
              void enablePushNotifications(profile.id).catch((e) =>
                Alert.alert(
                  "Notifications",
                  e instanceof Error ? e.message : "Please retry.",
                ),
              );
          }}
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  nameBlock: { flex: 1 },
  name: { ...typography.title, color: colors.text },
  category: {
    ...typography.caption,
    color: colors.textDim,
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
