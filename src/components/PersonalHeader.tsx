import React, { useContext } from "react";
import { Keyboard } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PersonalTabNav } from "../navigation/types";
import { PersonalMessagesContext } from "../store/PersonalMessagesContext";
import { BrandHeader } from "./BrandHeader";

type Props = Pick<
  React.ComponentProps<typeof BrandHeader>,
  "context" | "location" | "onContextPress"
>;

export function PersonalHeader(props: Props) {
  const navigation = useNavigation<PersonalTabNav>();
  const unreadMessages = useContext(PersonalMessagesContext);
  return (
    <BrandHeader
      {...props}
      unreadMessages={unreadMessages}
      onMessagesPress={() => {
        Keyboard.dismiss();
        navigation.navigate("Messages");
      }}
    />
  );
}
