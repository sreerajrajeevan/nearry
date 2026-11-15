import { Platform, TextStyle } from "react-native";

/**
 * Plus Jakarta Sans, loaded per weight in App.tsx. Each weight is its own font
 * file, so pick the weight through the family name and leave fontWeight at
 * "normal": that renders the same on iOS, Android and web without faux bold.
 */
export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;

export type FontWeight =
  "400" | "500" | "600" | "700" | "800" | "900" | "normal" | "bold";

const byWeight: Record<FontWeight, string> = {
  "400": fonts.regular,
  normal: fonts.regular,
  "500": fonts.medium,
  "600": fonts.semibold,
  "700": fonts.bold,
  bold: fonts.bold,
  "800": fonts.extrabold,
  "900": fonts.extrabold,
};

/** Use instead of fontWeight: `...weight("700")`. */
export function weight(value: FontWeight): TextStyle {
  return { fontFamily: byWeight[value], fontWeight: "normal" };
}

export const fontFamily = {
  sans: fonts.regular,
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
} as const;

export const typography: Record<string, TextStyle> = {
  display: {
    ...weight("800"),
    fontSize: 34,
    letterSpacing: -1.2,
    lineHeight: 40,
  },
  title: {
    ...weight("800"),
    fontSize: 23,
    letterSpacing: -0.6,
    lineHeight: 29,
  },
  heading: {
    ...weight("700"),
    fontSize: 17,
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  label: {
    ...weight("600"),
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    ...weight("400"),
    fontSize: 15,
    lineHeight: 22,
  },
  bodySmall: {
    ...weight("400"),
    fontSize: 13,
    lineHeight: 19,
  },
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 19,
  },
  caption: {
    ...weight("400"),
    fontSize: 11,
    lineHeight: 16,
  },
};
export type Typography = typeof typography;
