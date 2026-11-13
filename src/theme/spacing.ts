import { Platform, ViewStyle } from "react-native";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  none: 0,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

export const borderWidth = {
  hairline: 1,
  thin: 1.5,
} as const;

/** Soft, diffuse elevation instead of hard outlines. */
export const shadows = {
  none: {},
  sm: Platform.select<ViewStyle>({
    web: { boxShadow: "0 1px 3px rgba(15,23,42,0.06)" } as ViewStyle,
    default: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
  }) as ViewStyle,
  md: Platform.select<ViewStyle>({
    web: { boxShadow: "0 6px 20px rgba(15,23,42,0.08)" } as ViewStyle,
    default: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  }) as ViewStyle,
  accent: Platform.select<ViewStyle>({
    web: { boxShadow: "0 8px 20px rgba(79,70,229,0.32)" } as ViewStyle,
    default: {
      shadowColor: "#4F46E5",
      shadowOpacity: 0.32,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },
  }) as ViewStyle,
} as const;

export type Spacing = typeof spacing;
