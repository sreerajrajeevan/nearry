import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Screen } from "../../components/Screen";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { PageHeading } from "../../components/PageHeading";
import { colors, typography, spacing } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { useUnreadCounts } from "../../hooks/useUnreadCounts";
import { enablePushNotifications } from "../../services/notifications";
import { PersonalTabNav } from "../../navigation/types";

type Props = { navigation: PersonalTabNav };
export function ProfileScreen({ navigation }: Props) {
  const { profile, session, demoMode, signOut, enterDemoMode } = useAuth();
  const { notifications } = useUnreadCounts();
  if (!profile)
    return (
      <Screen>
        <EmptyState title="Not signed in" hint="Log in to view your profile." />
      </Screen>
    );
  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {demoMode && <Badge label="Sample personal profile" />}
        <View style={styles.avatar}>
          <Avatar name={profile.displayName || "N"} size={64} />
        </View>
        <PageHeading
          greeting="A familiar face nearby."
          title={`Hello,\nI’m ${profile.displayName || "a neighbour"}.`}
        />
        {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        {!!session?.user.email && (
          <View style={styles.row}>
            <Text style={styles.label}>Your email</Text>
            <Text style={styles.value}>{session.user.email}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Your interests</Text>
          <Text style={styles.value}>
            {profile.interests.length
              ? profile.interests.join(" · ")
              : "Good company and a new plan."}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.65}
          style={styles.menuRow}
          onPress={() => navigation.navigate("EditProfile")}
        >
          <Icon name="edit" size={18} color={colors.accent} />
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>Edit profile</Text>
            <Text style={styles.menuHint}>Your name, bio and interests</Text>
          </View>
          <Icon name="arrow-up-right" size={17} color={colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.65}
          style={styles.menuRow}
          onPress={() => navigation.navigate("MyPosts")}
        >
          <Icon name="file-text" size={18} color={colors.accent} />
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>My posts</Text>
            <Text style={styles.menuHint}>
              Your plans, requests and past posts
            </Text>
          </View>
          <Icon name="arrow-up-right" size={17} color={colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.65}
          style={styles.menuRow}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Text style={styles.menuLabel}>Notifications</Text>
          {notifications > 0 && (
            <Badge label={String(notifications)} tone="red" />
          )}
          <Icon name="arrow-up-right" size={17} color={colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.65}
          style={styles.menuRow}
          onPress={() => navigation.navigate("Messages")}
        >
          <Text style={styles.menuLabel}>Your conversations</Text>
          <Icon name="arrow-up-right" size={17} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.actions}>
          <Button
            title="Enable notifications"
            variant="secondary"
            onPress={() =>
              void enablePushNotifications(profile.id)
                .then(() =>
                  Alert.alert(
                    "Notifications",
                    "Notification setup is complete.",
                  ),
                )
                .catch((error) =>
                  Alert.alert(
                    "Notifications",
                    error instanceof Error
                      ? error.message
                      : "Please try again.",
                  ),
                )
            }
          />
          {demoMode && (
            <Button
              title="Explore the business demo"
              variant="ghost"
              onPress={() => enterDemoMode("business")}
            />
          )}
          <Button
            title={demoMode ? "Leave demo" : "Log out"}
            variant="ghost"
            onPress={() =>
              void signOut().catch((error) =>
                Alert.alert(
                  "Couldn’t sign out",
                  error instanceof Error ? error.message : "Please try again.",
                ),
              )
            }
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  avatar: { marginTop: spacing.lg, marginBottom: spacing.md },
  bio: { ...typography.body, color: colors.textDim, marginBottom: spacing.lg },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { ...typography.caption, color: colors.textDim, marginBottom: 5 },
  value: { ...typography.body, color: colors.text },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuLabel: { ...typography.body, color: colors.text, flex: 1 },
  menuCopy: { flex: 1, gap: 3 },
  menuTitle: { ...typography.body, color: colors.text },
  menuHint: { ...typography.caption, color: colors.textDim },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
