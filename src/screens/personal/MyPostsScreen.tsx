import { PlanListSkeleton } from "../../components/Skeletons";
import { AudienceBadge } from "../../components/AudienceBadge";
import { BackButton } from "../../components/BackButton";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PersonalStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { PageHeading } from "../../components/PageHeading";
import { FilterTabs } from "../../components/FilterTabs";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../store/AuthContext";
import { usePagedQuery } from "../../hooks/usePagedQuery";
import { listPostsPage, subscribeToPosts } from "../../services/posts";
import { NeedPost } from "../../services/mappers";
import { formatWhen } from "../../utils/format";
import { colors, typography, spacing, surfaces } from "../../theme";

type Props = NativeStackScreenProps<PersonalStackParamList, "MyPosts">;
type Filter = "all" | "upcoming" | "past" | "cancelled";
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

function statusLabel(post: NeedPost, now: number) {
  if (post.status === "cancelled") return "Cancelled";
  if (new Date(post.startsAt).getTime() <= now) return "Past";
  if (post.spotsLeft <= 0) return "Full";
  if (
    post.status === "closed" ||
    (post.expiresAt && new Date(post.expiresAt).getTime() <= now)
  )
    return "Requests closed";
  return "Open";
}

/** All of the signed-in host's posts, including posts with no requests. */
export function MyPostsScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const myId = profile?.id;
  const [filter, setFilter] = useState<Filter>("all"),
    [now, setNow] = useState(Date.now);
  const {
    items: posts,
    state,
    refreshing,
    refresh: load,
    cursor,
    loadMore,
    loadingMore,
    moreError,
  } = usePagedQuery(
    `my-posts:${myId}:${filter}`,
    (cursor) =>
      myId
        ? listPostsPage(
            {
              authorId: myId,
              status: filter === "cancelled" ? "cancelled" : "all",
              sort: "newest",
              ...(filter === "upcoming"
                ? { from: new Date().toISOString(), excludeCancelled: true }
                : filter === "past"
                  ? { until: new Date().toISOString(), excludeCancelled: true }
                  : {}),
            },
            cursor,
          )
        : Promise.resolve({ items: [], cursor: null }),
    subscribeToPosts,
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const visible = posts.filter((post) => {
    if (filter === "all") return true;
    if (filter === "cancelled") return post.status === "cancelled";
    if (post.status === "cancelled") return false;
    const upcoming = new Date(post.startsAt).getTime() > now;
    return filter === "upcoming" ? upcoming : !upcoming;
  });

  return (
    <Screen>
      <FlatList
        data={state === "ready" ? visible : []}
        keyExtractor={(post) => post.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        ListHeaderComponent={
          <>
            <BackButton onPress={() => navigation.goBack()} />
            <PageHeading
              greeting="The hellos you started."
              title="My posts"
              subtitle="Manage your plans and the people joining them."
            />
            <Button
              title="Create a post"
              variant="secondary"
              onPress={() =>
                navigation.navigate("PersonalTabs", { screen: "CreatePost" })
              }
              style={styles.create}
            />
            <FilterTabs
              options={filters}
              selected={filter}
              onSelect={setFilter}
              label="Filter my posts"
            />
          </>
        }
        ListEmptyComponent={
          state === "loading" ? (
            <PlanListSkeleton label="Loading your posts" />
          ) : state === "error" ? (
            <>
              <EmptyState
                title="Couldn’t load your posts"
                hint="Check your connection and retry."
              />
              <Button title="Retry" onPress={() => void load()} />
            </>
          ) : (
            <EmptyState
              title={
                posts.length
                  ? "No posts in this view"
                  : "Your first hello starts here"
              }
              hint={
                posts.length
                  ? "Try another filter to see your other posts."
                  : "Create a plan. It will appear here, even before anyone joins."
              }
            />
          )
        }
        ListFooterComponent={
          <>
            {moreError ? (
              <Text style={{ color: colors.textDim }}>{moreError}</Text>
            ) : null}
            {cursor && (
              <Button
                title="More posts"
                loading={loadingMore}
                onPress={() => void loadMore()}
              />
            )}
          </>
        }
        renderItem={({ item: post }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${post.title}. ${statusLabel(post, now)}. Manage post`}
            activeOpacity={0.65}
            style={styles.row}
            onPress={() =>
              navigation.navigate("PostDetails", { postId: post.id })
            }
          >
            <View style={styles.rowTop}>
              <Text style={styles.title}>{post.title}</Text>
              <Badge
                label={statusLabel(post, now)}
                tone={post.status === "cancelled" ? "red" : "neutral"}
              />
            </View>
            <AudienceBadge preference={post.genderPreference} />
            <Text style={styles.meta}>{formatWhen(post.startsAt)}</Text>
            {!!post.venueName && (
              <Text style={styles.meta}>{post.venueName}</Text>
            )}
            <View style={styles.rowBottom}>
              <Text style={styles.meta}>
                {post.joinedCount} joined · {post.vacancies} spots total
              </Text>
              <View style={styles.link}>
                <Text style={styles.linkText}>Manage post</Text>
                <Icon name="arrow-up-right" size={15} color={colors.accent} />
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  create: { marginBottom: spacing.md },
  loading: {
    ...typography.bodySmall,
    color: colors.textDim,
    paddingVertical: spacing.lg,
  },
  row: {
    ...surfaces.card,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    flexGrow: 1,
    flexShrink: 1,
  },
  meta: { ...typography.bodySmall, color: colors.textDim },
  rowBottom: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  link: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { ...typography.bodySmall, color: colors.accent },
});
