import { Platform, TextStyle } from "react-native";

export const fontFamily = {
  sans: Platform.select({ ios: "Avenir Next", default: "System" }),
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
} as const;

export const typography: Record<string, TextStyle> = {
  display: {
    fontFamily: fontFamily.sans,
    fontSize: 36,
    fontWeight: "500",
    letterSpacing: -1.4,
    lineHeight: 41,
  },
  title: {
    fontFamily: fontFamily.sans,
    fontSize: 23,
    fontWeight: "500",
    letterSpacing: -0.6,
    lineHeight: 29,
  },
  heading: {
    fontFamily: fontFamily.sans,
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    fontWeight: "500",
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
    fontWeight: "400",
    lineHeight: 19,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 16,
  },
};
export type Typography = typeof typography;
