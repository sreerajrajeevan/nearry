/**
 * Nearry theme — Nothing-inspired.
 * Pure black / pure white / signal red. Sharp edges, thin borders,
 * uppercase micro-labels. Red is reserved for actions and live states.
 */
export const colors = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#D71920',
  redDim: '#7A0F13',

  // Grayscale ramp (warm-neutral)
  gray950: '#0A0A0A',
  gray900: '#141414',
  gray850: '#1C1C1C',
  gray800: '#242424',
  gray700: '#333333',
  gray600: '#4A4A4A',
  gray500: '#737373',
  gray400: '#A3A3A3',
  gray300: '#D4D4D4',
  gray200: '#E8E8E8',

  // Semantic
  background: '#000000',
  surface: '#0A0A0A',
  surfaceRaised: '#141414',
  border: '#2A2A2A',
  borderStrong: '#4A4A4A',
  text: '#FFFFFF',
  textDim: '#A3A3A3',
  textFaint: '#6B6B6B',
  accent: '#D71920',
  onAccent: '#FFFFFF',
  success: '#22C55E',
  warning: '#F59E0B',
} as const;

export type Colors = typeof colors;
