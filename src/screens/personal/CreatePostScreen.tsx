import React, { useCallback, useState } from "react";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { PostEditor } from "./PostEditor";
import { ProfileRequired } from "../../components/ProfileRequired";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { PageHeading } from "../../components/PageHeading";
import { useAuth } from "../../store/AuthContext";
import { personalProfileReady } from "../../utils/profileReadiness";
import { PersonalTabNav, PersonalTabParamList } from "../../navigation/types";
export function CreatePostScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<PersonalTabNav>();
  const params =
    useRoute<RouteProp<PersonalTabParamList, "CreatePost">>().params;
  const [prompt, setPrompt] = useState(false);
  const ready = personalProfileReady(profile);
  useFocusEffect(
    useCallback(() => {
      if (!ready) setPrompt(true);
    }, [ready]),
  );
  const complete = () => {
    setPrompt(false);
    navigation.navigate("CompleteProfile");
  };
  if (!ready)
    return (
      <Screen>
        <PageHeading title="Start with a little hello" />
        <Button title="Complete my profile" onPress={complete} />
        <Button
          title="Keep browsing"
          variant="ghost"
          onPress={() => navigation.navigate("Nearby")}
        />
        <ProfileRequired
          visible={prompt}
          onComplete={complete}
          onBrowse={() => {
            setPrompt(false);
            navigation.navigate("Nearby");
          }}
        />
      </Screen>
    );
  return (
    <PostEditor
      // A new link opens a fresh editor with that venue.
      key={params?.venueId ?? "new"}
      initialVenueId={params?.venueId}
      initialUrgent={!!params?.urgent}
      onSaved={(id) => navigation.navigate("PostDetails", { postId: id })}
    />
  );
}
