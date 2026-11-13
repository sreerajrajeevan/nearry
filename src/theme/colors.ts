/**
 * Modern light theme: cool neutral surfaces, one indigo accent and a single
 * rose highlight for alerts. Legacy token names (forest, sage, gold, clay, …)
 * are kept as aliases so existing screens pick up the new look without edits.
 */
export const palette = {
  indigo: "#4F46E5",
  indigoDeep: "#3730A3",
  indigoSoft: "#EEF0FF",
  ink: "#0F172A",
  rose: "#E11D48",
  amber: "#F59E0B",
  mist: "#F6F7FB",
  white: "#FFFFFF",
} as const;

export const colors = {
  // Core surfaces and text
  background: palette.mist,
  paper: palette.mist,
  surface: palette.white,
  card: palette.white,
  surfaceRaised: "#EEF0F6",
  border: "#E6E9F0",
  hairline: "#E6E9F0",
  borderStrong: "#8892A4",
  lineStrong: "#8892A4",
  text: palette.ink,
  ink: palette.ink,
  textDim: "#475569",
  muted: "#475569",
  textFaint: "#526173",
  faint: "#526173",

  // Accent
  accent: palette.indigo,
  accentSoft: palette.indigoSoft,
  accentDeep: palette.indigoDeep,
  onAccent: palette.white,
  /** Warm highlight for small text/icons that sit on an accent-coloured panel. */
  onAccentHighlight: "#FDE68A",

  // Status
  red: "#C81E3A",
  redDim: "#9F1239",
  dangerSoft: "#FDECEF",
  success: "#166534",
  successSoft: "#E7F6EC",
  warning: "#B45309",
  scrim: "rgba(15,23,42,0.6)",

  black: palette.ink,
  white: palette.white,

  // ---- Legacy aliases (older components still reference these names) ----
  forest: palette.indigo,
  sage: palette.indigo,
  sageSoft: palette.indigoSoft,
  sageDeep: palette.indigoDeep,
  onSage: palette.white,
  sand: palette.amber,
  sandSoft: "#FFF4DB",
  gold: palette.rose,
  goldSoft: palette.indigoSoft,
  goldDeep: palette.indigoDeep,
  onGold: palette.white,
  cream: palette.mist,
  clay: palette.indigo,
  clayDeep: palette.indigoDeep,
  claySoft: palette.indigoSoft,
  gray950: palette.ink,
  gray900: "#1E293B",
  gray850: "#273449",
  gray800: "#334155",
  gray700: "#475569",
  gray600: "#526173",
  gray500: "#8892A4",
  gray400: "#A9B2C1",
  gray300: "#CBD2DD",
  gray200: "#E6E9F0",
} as const;
export type Colors = typeof colors;
