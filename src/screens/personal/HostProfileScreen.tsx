import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PersonalStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { BackButton } from "../../components/BackButton";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { PostRow } from "../../components/PostRow";
import { SafetyActions } from "../../components/SafetyActions";
import { useLiveQuery } from "../../hooks/useLiveQuery";
import { getPublicProfile } from "../../services/profile";
import { isPersonalSelfieChecked } from "../../services/selfieVerification";
import { listPosts, subscribeToPosts } from "../../services/posts";
import { useAuth } from "../../store/AuthContext";
import { colors, typography, weight } from "../../theme";

/**
 * Another person's public profile: photo, name, bio and their open plans.
 * Opened from a plan's host, or by a host from someone's join request, in
 * which case their request message is shown too.
 */
export function HostProfileScreen({
  route,
  navigation,
}: NativeStackScreenProps<PersonalStackParamList, "HostProfile">) {
  const { userId, name, requestNote } = route.params;
  const { profile: me } = useAuth();
  const { data, state, error, refresh } = useLiveQuery(
    `host:${userId}`,
    async () => {
      const [host, selfieChecked, plans] = await Promise.all([
        getPublicProfile(userId, name),
        isPersonalSelfieChecked(userId).catch(() => false),
        listPosts({ authorId: userId }).catch(() => []),
      ]);
      return { host, selfieChecked, plans };
    },
    subscribeToPosts,
  );
  const host = data?.host;
  const displayName = host?.displayName ?? name ?? "Someone";
  const firstName = displayName.split(" ")[0];
  const plans = data?.plans ?? [];
  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <BackButton onPress={() => navigation.goBack()} />
        {state === "loading" && !data ? (
          <LoadingState label="Opening profile…" layout="inline" />
        ) : state === "error" && !data ? (
          <View style={styles.gap}>
            <EmptyState
              title="Could not open this profile"
              hint={error || "Please try again."}
            />
            <Button title="Retry" onPress={() => void refresh()} />
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Avatar name={displayName} uri={host?.avatarUrl} size={88} />
              <Text accessibilityRole="header" style={styles.name}>
                {displayName}
              </Text>
              {data?.selfieChecked && (
                <Badge label="Selfie checked" tone="green" />
              )}
              {host?.bio ? (
                <Text style={styles.bio}>{host.bio}</Text>
              ) : (
                <Text style={styles.noBio}>
                  {firstName} hasn’t written a bio yet.
                </Text>
              )}
            </View>
            {!!requestNote && (
              <View style={styles.note}>
                <Text style={styles.noteLabel}>
                  {firstName}’s message with the request
                </Text>
                <Text style={styles.noteText}>“{requestNote}”</Text>
              </View>
            )}
            <Text accessibilityRole="header" style={styles.section}>
              Open plans by {firstName}
            </Text>
            {plans.length ? (
              plans.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  onPress={() =>
                    navigation.push("PostDetails", { postId: post.id })
                  }
                />
              ))
            ) : (
              <EmptyState
                title="No other open plans right now"
                hint={`New plans from ${firstName} will show up here.`}
              />
            )}
            {me?.id !== userId && (
              <SafetyActions
                target={{
                  kind: "user",
                  id: userId,
                  userId,
                  name: displayName,
                }}
                onReport={() =>
                  navigation.navigate("Report", {
                    target: { kind: "user", id: userId, name: displayName },
                  })
                }
                onBlocked={() => navigation.goBack()}
              />
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  gap: { gap: 12 },
  header: { alignItems: "center", gap: 10, paddingVertical: 8 },
  name: {
    ...typography.heading,
    fontSize: 24,
    lineHeight: 30,
    ...weight("800"),
    color: colors.text,
    textAlign: "center",
  },
  bio: {
    ...typography.body,
    color: colors.text,
    textAlign: "center",
    maxWidth: 320,
  },
  noBio: {
    ...typography.bodySmall,
    color: colors.textDim,
    textAlign: "center",
  },
  note: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.amberSoft,
    gap: 4,
  },
  noteLabel: {
    ...typography.caption,
    color: colors.amberDeep,
    ...weight("700"),
  },
  noteText: { ...typography.body, color: colors.ink },
  section: {
    ...typography.heading,
    color: colors.text,
    marginTop: 24,
    marginBottom: 12,
  },
});
