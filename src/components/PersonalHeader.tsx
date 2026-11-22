import React, { useContext } from "react";
import { Keyboard } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PersonalTabNav } from "../navigation/types";
import { PersonalMessagesContext } from "../store/PersonalMessagesContext";
import { useUnreadCounts } from "../hooks/useUnreadCounts";
import { BrandHeader } from "./BrandHeader";

type Props = Pick<
  React.ComponentProps<typeof BrandHeader>,
  "context" | "location" | "onContextPress" | "compact" | "variant"
> & {
  /** Home hides this: chats live in the bottom tab bar there. */
  showMessages?: boolean;
};

export function PersonalHeader({ showMessages = true, ...props }: Props) {
  const navigation = useNavigation<PersonalTabNav>();
  const unreadMessages = useContext(PersonalMessagesContext);
  const { notifications } = useUnreadCounts();
  return (
    <BrandHeader
      {...props}
      unreadMessages={unreadMessages}
      onMessagesPress={
        showMessages
          ? () => {
              Keyboard.dismiss();
              navigation.navigate("Messages");
            }
          : undefined
      }
      unreadNotifications={notifications}
      onNotificationsPress={() => {
        Keyboard.dismiss();
        navigation.navigate("Notifications");
      }}
    />
  );
}
