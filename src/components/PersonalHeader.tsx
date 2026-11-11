import React, { useContext } from "react";
import { Keyboard } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PersonalTabNav } from "../navigation/types";
import { PersonalMessagesContext } from "../store/PersonalMessagesContext";
import { useUnreadCounts } from "../hooks/useUnreadCounts";
import { useAuth } from "../store/AuthContext";
import { BrandHeader } from "./BrandHeader";

type Props = Pick<
  React.ComponentProps<typeof BrandHeader>,
  "context" | "location" | "onContextPress" | "compact" | "inverse"
>;

export function PersonalHeader(props: Props) {
  const { profile } = useAuth();
  const navigation = useNavigation<PersonalTabNav>();
  const messagesInTabs = useContext(PersonalMessagesContext);
  const { notifications, messages } = useUnreadCounts();
  const unreadMessages = messagesInTabs || messages;
  return (
    <BrandHeader
      {...props}
      onProfilePress={
        props.inverse ? () => navigation.navigate("Profile") : undefined
      }
      profileName={profile?.displayName}
      avatarUri={profile?.avatarUrl}
      unreadMessages={unreadMessages}
      onMessagesPress={() => {
        Keyboard.dismiss();
        navigation.navigate("Messages");
      }}
      unreadNotifications={notifications}
      onNotificationsPress={() => {
        Keyboard.dismiss();
        navigation.navigate("Notifications");
      }}
    />
  );
}
