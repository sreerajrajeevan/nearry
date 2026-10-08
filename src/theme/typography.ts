import { TextStyle } from 'react-native';

/**
 * Nothing-style typography: dot-matrix monospace for display + labels,
 * clean sans for body. Everything uppercase where it labels, never shouts
 * in body copy.
 */
const MONO = 'monospace';

export const fontFamily = {
  mono: MONO,
  sans: 'System',
} as const;

export const typography: Record<string, TextStyle> = {
  display: {
    fontFamily: MONO,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 1.5,
    lineHeight: 40,
  },
  title: {
    fontFamily: MONO,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
    lineHeight: 28,
  },
  heading: {
    fontFamily: MONO,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    lineHeight: 22,
  },
  label: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  mono: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.5,
    lineHeight: 18,
  },
  caption: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.5,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
};

export type Typography = typeof typography;
