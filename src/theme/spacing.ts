export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  none: 0,
  sm: 2,
  md: 4,
  // Nothing-style: mostly sharp. Use sparingly.
  lg: 8,
  full: 999,
} as const;

export const borderWidth = {
  hairline: 1,
  thin: 1.5,
} as const;

export type Spacing = typeof spacing;
