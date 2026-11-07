import { Appearance } from "react-native";

/**
 * Forest & sand: natural surfaces, deep green controls and restrained gold.
 *
 * Dark theme: the palette is picked ONCE at launch from the phone's system
 * setting (Appearance.getColorScheme()). Styles are created with StyleSheet at
 * module load, so a system-theme change while the app is running applies on
 * the next cold start — there is no live switching yet. A manual Light/Dark
 * toggle would need the styles converted to a theme hook first.
 */
export const palette = {
  sage: "#6D9773",
  forest: "#0C3B2E",
  sand: "#BB8A52",
  gold: "#FFBA00",
  cream: "#F4F3EB",
} as const;

const lightColors = {
  ...palette,
  paper: palette.cream,
  ink: palette.forest,
  card: "#FFFEFA",
  muted: "#526654",
  faint: "#526654",
  hairline: "#DCE1D5",
  lineStrong: "#829784",
  background: palette.cream,
  surface: "#FFFEFA",
  surfaceRaised: "#E7EEE4",
  border: "#DCE1D5",
  borderStrong: "#829784",
  text: palette.forest,
  textDim: "#526654",
  textFaint: "#526654",
  accent: palette.forest,
  onAccent: "#FFFEFA",
  sageSoft: "#E7EEE4",
  sageDeep: "#365E40",
  sandSoft: "#F1E6D7",
  goldSoft: "#FFF0C2",
  goldDeep: "#795500",
  onGold: palette.forest,
  onSage: "#08251B",
  // Pale text for dark forest heroes — same in both modes, the hero stays dark.
  onForest: "#E7EEE4",
  onForestMuted: "#FFF0C2",
  scrim: "rgba(12,59,46,0.86)",
  dangerSoft: "#F8E6E2",
  success: "#365E40",
  warning: "#795500",
  black: palette.forest,
  white: "#FFFEFA",
  red: "#A13F3F",
  redDim: "#803131",
  // Older components use clay for primary controls and pale selected surfaces.
  clay: palette.forest,
  clayDeep: palette.forest,
  claySoft: "#E7EEE4",
  // Audience badges (pink/blue pills).
  badgePink: "#8A2754",
  badgePinkBg: "#FCE8F1",
  badgeBlue: "#205A91",
  badgeBlueBg: "#E6F0FC",
  gray950: palette.forest,
  gray900: "#234A3D",
  gray850: "#345747",
  gray800: "#45604F",
  gray700: "#526654",
  gray600: "#526654",
  gray500: "#829784",
  gray400: "#A4B4A1",
  gray300: "#C2CEC0",
  gray200: "#DCE1D5",
} as const;

const darkColors = {
  ...palette,
  paper: "#0B1F17",
  ink: palette.cream,
  card: "#12291F",
  muted: "#A4B4A1",
  faint: "#829784",
  hairline: "#24402F",
  lineStrong: "#3D5C48",
  background: "#0B1F17",
  surface: "#12291F",
  surfaceRaised: "#1B352A",
  border: "#24402F",
  borderStrong: "#3D5C48",
  text: palette.cream,
  textDim: "#A4B4A1",
  textFaint: "#829784",
  accent: "#7FA98A",
  onAccent: "#08251B",
  sageSoft: "#1B352A",
  sageDeep: "#8FB996",
  sandSoft: "#2E2113",
  goldSoft: "#3A2E14",
  goldDeep: "#D9A441",
  onGold: "#08251B",
  onSage: "#08251B",
  // Pale text for dark forest heroes — same in both modes, the hero stays dark.
  onForest: "#E7EEE4",
  onForestMuted: "#FFF0C2",
  scrim: "rgba(0,0,0,0.72)",
  dangerSoft: "#3A1F1B",
  success: "#8FB996",
  warning: "#FFBA00",
  black: palette.cream,
  white: "#12291F",
  red: "#E07878",
  redDim: "#C05A5A",
  // Older components use clay for primary controls and pale selected surfaces.
  clay: "#7FA98A",
  clayDeep: "#8FB996",
  claySoft: "#1B352A",
  // Audience badges (pink/blue pills).
  badgePink: "#E89BC0",
  badgePinkBg: "#3A1F2E",
  badgeBlue: "#8FB8E8",
  badgeBlueBg: "#1B2A3A",
  gray950: palette.cream,
  gray900: "#DCE1D5",
  gray850: "#C2CEC0",
  gray800: "#A4B4A1",
  gray700: "#829784",
  gray600: "#6E7F6C",
  gray500: "#526654",
  gray400: "#45604F",
  gray300: "#345747",
  gray200: "#24402F",
} as const;

export const colorScheme = Appearance.getColorScheme() ?? "light";
export const isDark = colorScheme === "dark";
export const colors = isDark ? darkColors : lightColors;
export type Colors = typeof lightColors;
