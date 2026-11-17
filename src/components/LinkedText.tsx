import React from "react";
import { Linking, StyleProp, Text, TextStyle } from "react-native";
import { messageParts } from "../utils/messageLinks";
import { Alert } from "../services/appAlert";

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
};

function open(url: string) {
  Linking.openURL(url).catch(() =>
    Alert.alert("Couldn't open link", "Copy it and open it in your browser."),
  );
}

/** Message text whose web links can be tapped. */
export function LinkedText({ children, style, linkStyle }: Props) {
  const parts = messageParts(children);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.url ? (
          <Text
            key={i}
            accessibilityRole="link"
            accessibilityHint="Opens outside Nearry"
            onPress={() => open(part.url!)}
            suppressHighlighting={false}
            style={[{ textDecorationLine: "underline" }, linkStyle]}
          >
            {part.text}
          </Text>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        ),
      )}
    </Text>
  );
}
