import React, { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PersonalStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { PageHeading } from "../../components/PageHeading";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { PostRow } from "../../components/PostRow";
import { getPost } from "../../services/posts";
import { NeedPost } from "../../services/mappers";
import { useSavedPlans } from "../../store/SavedPlansContext";
import { colors, typography } from "../../theme";
export function SavedPlansScreen({
  navigation,
}: NativeStackScreenProps<PersonalStackParamList, "SavedPlans">) {
  const saved = useSavedPlans();
  const ids = saved?.ids;
  const [posts, setPosts] = useState<NeedPost[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPosts([]);
      if (saved?.status !== "ready")
        return () => {
          active = false;
        };
      setState("loading");
      void Promise.all((ids ?? []).map((id) => getPost(id)))
        .then((rows) => {
          if (active) {
            setPosts(rows.filter((post): post is NeedPost => post !== null));
            setState("ready");
          }
        })
        .catch(() => {
          if (active) setState("error");
        });
      return () => {
        active = false;
      };
    }, [ids, saved?.status, retry]),
  );
  const error = saved?.status === "error" || state === "error";
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Button
          title="Back"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
        <PageHeading compact title="Saved plans" greeting="Your shortlist" />
        <Text
          style={{
            ...typography.bodySmall,
            color: colors.textDim,
            marginBottom: 18,
          }}
        >
          Saved on this device. Plans that are no longer available are hidden.
        </Text>
        {error ? (
          <View>
            <EmptyState
              title="Couldn’t load saved plans"
              hint="Your saved list hasn’t been changed."
            />
            <Button
              title="Try again"
              onPress={() => {
                void saved?.reload().catch(() => {});
                setRetry((v) => v + 1);
              }}
            />
          </View>
        ) : saved?.status !== "ready" || state === "loading" ? (
          <LoadingState label="Loading saved plans…" layout="list" />
        ) : posts.length === 0 ? (
          <EmptyState
            title="Your shortlist starts here"
            hint="Tap the bookmark on a plan to find it here later."
          />
        ) : (
          posts.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              onPress={() =>
                navigation.navigate("PostDetails", { postId: post.id })
              }
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
