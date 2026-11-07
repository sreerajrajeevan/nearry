import { colors, isDark } from "./colors";
import { typography, fontFamily } from "./typography";
import { spacing, radius, borderWidth } from "./spacing";

export const theme = {
  colors,
  typography,
  fontFamily,
  spacing,
  radius,
  borderWidth,
  dark: isDark,
} as const;

export type Theme = typeof theme;

export { colors, typography, fontFamily, spacing, radius, borderWidth };

export { surfaces } from "./surfaces";
