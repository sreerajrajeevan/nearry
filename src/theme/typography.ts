import { TextStyle } from 'react-native';

/**
 * Quiet minimal typography: bold system sans for headlines
 * ("What are you up for?"), regular sans for body. Sentence case
 * throughout — no shouty uppercase labels.
 */
export const fontFamily = {
  sans: 'System',
  mono: 'monospace',
} as const;

export const typography: Record<string, TextStyle> = {
  display: {
    fontFamily: 'System',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  title: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  heading: {
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  label: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    lineHeight: 16,
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
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.5,
    lineHeight: 18,
  },
  caption: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 15,
  },
};

export type Typography = typeof typography;
