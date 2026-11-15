import { Alert } from "../../services/appAlert";
import { personalProfileReady } from "../../utils/profileReadiness";
import { PageHeading } from "../../components/PageHeading";

import React, { useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Screen } from "../../components/Screen";
import { PersonalHeader } from "../../components/PersonalHeader";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { AccountMenuRow } from "../../components/AccountMenuRow";
import { MotionPressable } from "../../components/Motion";
import { Icon } from "../../components/Icon";
import { colors, typography, spacing, surfaces, weight } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import {
  getMySelfieReview,
  isPersonalSelfieChecked,
  SelfieReview,
} from "../../services/selfieVerification";
import { verifyPrompt } from "../../utils/verifyPrompt";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useUnreadCounts } from "../../hooks/useUnreadCounts";
import { PersonalTabNav } from "../../navigation/types";

type Props = { navigation: PersonalTabNav };
export function ProfileScreen({ navigation }: Props) {
  const { profile, session, demoMode, signOut, enterDemoMode } = useAuth();
  const { notifications, messages } = useUnreadCounts();
  const [selfieChecked, setSelfieChecked] = useState(false);
  const [review, setReview] = useState<SelfieReview>({ status: "unverified" });
  const [reviewLoaded, setReviewLoaded] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (profile && !demoMode) {
        void isPersonalSelfieChecked(profile.id)
          .then((checked) => {
            if (alive) setSelfieChecked(checked);
          })
          .catch(() => {
            if (alive) setSelfieChecked(false);
          });
        void getMySelfieReview(profile.id)
          .then((next) => {
            if (alive) setReview(next);
          })
          .catch(() => {})
          .finally(() => {
            if (alive) setReviewLoaded(true);
          });
      } else {
        setSelfieChecked(false);
        setReview({ status: "unverified" });
        setReviewLoaded(true);
      }
      return () => {
        alive = false;
      };
    }, [profile?.id, demoMode]),
  );
  const [signingOut, setSigningOut] = useState(false);
  const signOutLock = useRef(false);
  const leave = async () => {
    if (signOutLock.current) return;
    signOutLock.current = true;
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      Alert.alert(
        "Couldn’t sign out",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      signOutLock.current = false;
      setSigningOut(false);
    }
  };
  const prompt = verifyPrompt({
    status: review.status,
    checked: selfieChecked,
    note: review.note,
  });
  if (!profile)
    return (
      <Screen>
        <EmptyState title="Not signed in" hint="Log in to view your profile." />
      </Screen>
    );
  return (
    <Screen>
      <ScrollView
        testID="profile-screen"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <PersonalHeader />
        <PageHeading
          compact
          title="Profile"
          subtitle="Your space. Everything in one place."
        />
        {demoMode && (
          <View style={styles.demo}>
            <Icon name="info" size={16} color={colors.amberDeep} />
            <Text style={styles.demoCopy}>
              Demo profile · changes stay in this preview
            </Text>
          </View>
        )}
        <View style={styles.identity}>
          <View style={styles.avatarRing}>
            <Avatar
              name={profile.displayName || "Neighbour"}
              size={92}
              uri={profile.avatarUrl}
              tone="clay"
            />
            {selfieChecked && (
              <View
                style={styles.verifiedDot}
                accessible
                accessibilityLabel="Verified: selfie checked by a reviewer"
              >
                <Icon name="check" size={14} color="#FFFFFF" />
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {profile.displayName || "Your profile"}
          </Text>
          <Text style={styles.member}>
            {selfieChecked ? "Verified · Personal account" : "Personal account"}
          </Text>
          {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          {profile.interests.length > 0 && (
            <View style={styles.interests}>
              {profile.interests.map((interest) => (
                <View key={interest} style={styles.interest}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          )}
          <MotionPressable
            style={styles.edit}
            accessibilityRole="button"
            accessibilityLabel={
              personalProfileReady(profile)
                ? "Edit profile"
                : "Complete profile"
            }
            onPress={() =>
              navigation.navigate(
                personalProfileReady(profile)
                  ? "EditProfile"
                  : "CompleteProfile",
              )
            }
          >
            <Icon name="edit-2" size={15} color={colors.ink} />
            <Text style={styles.editText}>
              {personalProfileReady(profile)
                ? "Edit profile"
                : "Complete profile to host or join"}
            </Text>
          </MotionPressable>
        </View>
        {reviewLoaded && prompt && (
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`${prompt.title}. ${prompt.body}`}
            accessibilityHint={prompt.cta}
            onPress={() => navigation.navigate("SelfieVerification")}
            style={[
              styles.verifyCard,
              prompt.tone === "waiting" && styles.verifyWaiting,
              prompt.tone === "retry" && styles.verifyRetry,
            ]}
          >
            <View
              style={[
                styles.verifyIcon,
                prompt.tone !== "invite" && styles.verifyIconLight,
              ]}
            >
              <Icon
                name={prompt.tone === "waiting" ? "clock" : "shield"}
                size={22}
                color={
                  prompt.tone === "invite" ? colors.onAmber : colors.amberDeep
                }
              />
            </View>
            <View style={styles.verifyCopy}>
              <Text
                style={[
                  styles.verifyTitle,
                  prompt.tone !== "invite" && styles.verifyTitleDark,
                ]}
              >
                {prompt.title}
              </Text>
              <Text
                style={[
                  styles.verifyBody,
                  prompt.tone !== "invite" && styles.verifyBodyDark,
                ]}
              >
                {prompt.body}
              </Text>
              {prompt.tone !== "waiting" && (
                <View style={styles.verifyCta}>
                  <Text style={styles.verifyCtaText}>{prompt.cta}</Text>
                  <Icon name="arrow-right" size={14} color={colors.onAmber} />
                </View>
              )}
            </View>
          </MotionPressable>
        )}
        <View style={styles.quick}>
          {(
            [
              {
                icon: "bookmark",
                title: "Saved",
                count: 0,
                go: () => navigation.navigate("SavedPlans"),
              },
              {
                icon: "calendar",
                title: "My activity",
                count: 0,
                go: () => navigation.navigate("Activity"),
              },
              {
                icon: "message-circle",
                title: "Messages",
                count: messages,
                go: () => navigation.navigate("Messages"),
              },
              {
                icon: "bell",
                title: "Notifications",
                count: notifications,
                go: () => navigation.navigate("Notifications"),
              },
            ] as const
          ).map((item) => (
            <MotionPressable
              key={item.title}
              accessibilityRole="button"
              accessibilityLabel={
                item.count ? `${item.title}, ${item.count} unread` : item.title
              }
              onPress={item.go}
              style={styles.quickTile}
            >
              <View style={styles.quickIcon}>
                <Icon name={item.icon} size={20} color={colors.ink} />
                {item.count > 0 && (
                  <View style={styles.quickBadge}>
                    <Text style={styles.quickBadgeText}>
                      {item.count > 99 ? "99+" : item.count}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickTitle}>{item.title}</Text>
            </MotionPressable>
          ))}
        </View>
        <Text style={styles.section} accessibilityRole="header">
          Settings & privacy
        </Text>
        <View style={styles.group}>
          <AccountMenuRow
            icon="shield"
            title="Selfie verification"
            hint={
              selfieChecked
                ? "Selfie checked by a reviewer"
                : "Optional private selfie review"
            }
            onPress={() => navigation.navigate("SelfieVerification")}
          />
          <View style={styles.divider} />
          <AccountMenuRow
            icon="shield"
            title="Safety & privacy"
            hint="Blocked people, reports and account deletion"
            onPress={() => navigation.navigate("SafetyPrivacy")}
          />
          <View style={styles.divider} />
          <AccountMenuRow
            icon="sliders"
            title="Notification preferences"
            hint="Choose which updates you receive"
            onPress={() => navigation.navigate("NotificationSettings")}
          />
          <View style={styles.divider} />
          <AccountMenuRow
            icon="book-open"
            title="Privacy policy"
            hint="How Nearry handles your information"
            onPress={() => navigation.navigate("Legal", { page: "privacy" })}
          />
        </View>
        {!!session?.user.email && (
          <View style={styles.email}>
            <Icon name="lock" size={14} />
            <View style={styles.personCopy}>
              <Text style={styles.emailLabel}>Signed in with</Text>
              <Text style={styles.emailValue} selectable>
                {session.user.email}
              </Text>
            </View>
          </View>
        )}
        {demoMode && (
          <Button
            title="Explore the business demo"
            variant="secondary"
            onPress={() => enterDemoMode("business")}
            style={styles.demoSwitch}
          />
        )}
        <Button
          title={demoMode ? "Leave demo" : "Log out"}
          variant="ghost"
          loading={signingOut}
          onPress={() => void leave()}
          style={styles.logout}
        />
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl },
  title: {
    ...typography.title,
    fontSize: 28,
    lineHeight: 35,
    color: colors.text,
    marginTop: spacing.md,
  },
  intro: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: 5,
    marginBottom: spacing.lg,
  },
  demo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.amberSoft,
    marginBottom: spacing.md,
  },
  demoCopy: { ...typography.caption, color: colors.amberDeep, flex: 1 },
  identity: {
    ...surfaces.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
  },
  avatarRing: {
    padding: 4,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: colors.amberBright,
  },
  verifiedDot: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
  },
  quick: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: spacing.md,
  },
  quickTile: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
  },
  quickBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amber,
  },
  quickBadgeText: { fontSize: 11, ...weight("800"), color: colors.night },
  quickTitle: {
    ...typography.bodySmall,
    color: colors.ink,
    ...weight("700"),
    flexShrink: 1,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  verifiedText: { fontSize: 11, color: "#FFFFFF", ...weight("800") },
  verifyCard: {
    flexDirection: "row",
    gap: 14,
    marginTop: spacing.md,
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.night,
  },
  verifyWaiting: {
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  verifyRetry: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  verifyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberBright,
  },
  verifyIconLight: { backgroundColor: colors.surface },
  verifyCopy: { flex: 1, minWidth: 0, gap: 4 },
  verifyTitle: {
    fontSize: 17,
    lineHeight: 22,
    color: "#FFFFFF",
    ...weight("800"),
  },
  verifyTitleDark: { color: colors.text },
  verifyBody: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.78)",
    ...weight("500"),
  },
  verifyBodyDark: { color: colors.textDim },
  verifyCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.amberBright,
  },
  verifyCtaText: { fontSize: 13, color: colors.onAmber, ...weight("800") },
  personCopy: { flex: 1, minWidth: 0 },
  name: {
    ...typography.title,
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    marginTop: 12,
    ...weight("800"),
    textAlign: "center",
  },
  member: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginTop: 2,
    textAlign: "center",
  },
  bio: {
    ...typography.body,
    color: colors.text,
    marginTop: 12,
    textAlign: "center",
  },
  interests: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  interest: {
    backgroundColor: colors.amberSoft,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  interestText: { ...typography.caption, color: colors.ink, ...weight("700") },
  edit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    marginTop: 16,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  editText: { ...typography.label, color: colors.ink },
  section: {
    ...typography.heading,
    color: colors.text,
    marginTop: 28,
    marginBottom: 12,
  },
  group: {
    ...surfaces.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 66,
  },
  email: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: spacing.lg,
    paddingHorizontal: 4,
  },
  emailLabel: { ...typography.caption, color: colors.textDim },
  emailValue: { ...typography.bodySmall, color: colors.text, flexShrink: 1 },
  demoSwitch: { marginTop: spacing.lg },
  logout: { marginTop: spacing.md },
});
