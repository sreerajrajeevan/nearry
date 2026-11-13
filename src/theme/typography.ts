import { Platform, TextStyle } from "react-native";

/** The platform system font (SF Pro / Roboto) keeps the app crisp and modern. */
export const fontFamily = {
  sans: Platform.select({ ios: "System", default: "System" }),
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
} as const;

export const typography: Record<string, TextStyle> = {
  display: {
    fontFamily: fontFamily.sans,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 38,
  },
  title: {
    fontFamily: fontFamily.sans,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  heading: {
    fontFamily: fontFamily.sans,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 19,
  },
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 16,
  },
};
export type Typography = typeof typography;
