/**
 * Nearry: white and cool grey surfaces, near-black controls, and amber for
 * offers and the main actions (Join, Request, Post, Create).
 *
 * Amber is too light for text on white, so text that needs the brand colour
 * uses amberDeep, and anything sitting on amber uses onAmber.
 */
export const palette = {
  night: "#030712",
  ink: "#111827",
  amber: "#F59E0B",
  amberBright: "#FBBF24",
  amberDeep: "#B45309",
  amberSoft: "#FEF3C7",
  cloud: "#F8FAFC",
} as const;

export const colors = {
  // Brand
  night: palette.night,
  amber: palette.amber,
  amberBright: palette.amberBright,
  amberDeep: palette.amberDeep,
  amberSoft: palette.amberSoft,
  onAmber: palette.night,

  // Surfaces and text
  paper: palette.cloud,
  ink: palette.ink,
  card: "#FFFFFF",
  muted: "#4B5563",
  faint: "#6B7280",
  hairline: "#E5E7EB",
  lineStrong: "#9CA3AF",
  background: palette.cloud,
  surface: "#FFFFFF",
  surfaceRaised: "#F1F3F6",
  border: "#E5E7EB",
  borderStrong: "#9CA3AF",
  text: palette.ink,
  textDim: "#4B5563",
  textFaint: "#6B7280",
  accent: palette.ink,
  onAccent: "#FFFFFF",
  scrim: "rgba(3,7,18,0.82)",
  black: palette.ink,
  white: "#FFFFFF",

  // Status
  success: "#047857",
  successSoft: "#D1FAE5",
  warning: "#B45309",
  red: "#B91C1C",
  redDim: "#991B1B",
  dangerSoft: "#FEE2E2",

  // Earlier names, kept so existing screens pick up the new palette.
  // Prefer the names above in new code.
  forest: palette.ink,
  coral: palette.amber,
  coralDeep: palette.amberDeep,
  coralSoft: palette.amberSoft,
  gold: palette.amberBright,
  goldSoft: palette.amberSoft,
  goldDeep: palette.amberDeep,
  onGold: palette.night,
  sage: "#D1D5DB",
  sageSoft: "#F1F3F6",
  sageDeep: "#047857",
  onSage: palette.ink,
  sand: "#9CA3AF",
  sandSoft: "#F3F4F6",
  cream: palette.cloud,
  clay: palette.ink,
  clayDeep: palette.ink,
  claySoft: "#F1F3F6",
  gray950: palette.night,
  gray900: "#111827",
  gray850: "#1F2937",
  gray800: "#374151",
  gray700: "#4B5563",
  gray600: "#4B5563",
  gray500: "#6B7280",
  gray400: "#9CA3AF",
  gray300: "#D1D5DB",
  gray200: "#E5E7EB",
} as const;
export type Colors = typeof colors;
