import { colors } from "./colors";
import { typography, fontFamily } from "./typography";
import { spacing, radius, borderWidth } from "./spacing";

export const theme = {
  colors,
  typography,
  fontFamily,
  spacing,
  radius,
  borderWidth,
  dark: false,
} as const;

export type Theme = typeof theme;

export { colors, typography, fontFamily, spacing, radius, borderWidth };
