import React from "react";
import Feather from "@expo/vector-icons/Feather";
import { colors } from "../theme";

export type IconName = React.ComponentProps<typeof Feather>["name"];

type Props = { name: IconName; size?: number; color?: string };

/** One consistent outline icon family throughout both account experiences. */
export function Icon({ name, size = 20, color = colors.textDim }: Props) {
  return <Feather name={name} size={size} color={color} accessible={false} />;
}
