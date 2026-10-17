/**
 * Nearry theme — quiet minimal (mockups v2, 2026-10-17).
 * Near-white paper, near-black ink, terracotta accent. Flat rows with
 * hairline dividers, bold sans headlines, text-link actions. No green.
 */
export const colors = {
  // Brand
  clay: '#C05B3C',
  clayDeep: '#A34A2F',
  claySoft: '#F6E3D8',
  paper: '#FCFBF8',
  card: '#FFFFFF',
  ink: '#1B1B1B',
  muted: '#6F6F6F',
  faint: '#A8A8A8',
  hairline: '#E9E6E0',
  lineStrong: '#D8D4CB',

  // Semantic
  background: '#FCFBF8',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  border: '#E9E6E0',
  borderStrong: '#D8D4CB',
  text: '#1B1B1B',
  textDim: '#6F6F6F',
  textFaint: '#A8A8A8',
  accent: '#C05B3C',
  onAccent: '#FFFFFF',
  success: '#2E7D4F',
  warning: '#C98A2C',

  // Legacy aliases (kept so existing references keep compiling;
  // prefer the brand/semantic tokens in new code)
  black: '#1B1B1B',
  white: '#FFFFFF',
  red: '#C05B3C',
  redDim: '#A34A2F',

  // Neutral ramp
  gray950: '#1B1B1B',
  gray900: '#2B2B2B',
  gray850: '#3A3A3A',
  gray800: '#4A4A4A',
  gray700: '#6F6F6F',
  gray600: '#8A8A8A',
  gray500: '#A8A8A8',
  gray400: '#C4C4C4',
  gray300: '#D8D4CB',
  gray200: '#E9E6E0',
} as const;

export type Colors = typeof colors;
