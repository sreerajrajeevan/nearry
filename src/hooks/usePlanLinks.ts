import { useEffect } from "react";
import { Linking } from "react-native";
import { navigationRef } from "../navigation/navigationRef";
import { useAuth } from "../store/AuthContext";
import { planIdFromLink } from "../utils/shareLink";

/** Opens a shared plan link (nearry://plan/<id>) on the plan's page. */
export function usePlanLinks() {
  const { profile } = useAuth();
  const ready =
    !!profile &&
    profile.accountType === "personal" &&
    profile.onboardingCompleted &&
    !profile.suspendedAt &&
    !profile.deletionRequestedAt;
  useEffect(() => {
    if (!ready) return;
    let pending: string | null = null;
    const go = () => {
      if (!pending || !navigationRef.isReady()) return;
      const postId = pending;
      pending = null;
      navigationRef.navigate("PersonalApp", {
        screen: "PostDetails",
        params: { postId },
      });
    };
    const handle = (url: string | null) => {
      const id = planIdFromLink(url);
      if (!id) return;
      pending = id;
      go();
    };
    void Linking.getInitialURL()
      .then(handle)
      .catch(() => {});
    const link = Linking.addEventListener("url", ({ url }) => handle(url));
    const navReady = navigationRef.addListener("state", go);
    return () => {
      link.remove();
      navReady();
    };
  }, [ready]);
}
