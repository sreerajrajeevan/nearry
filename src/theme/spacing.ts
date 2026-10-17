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
  // Quiet minimal: mostly flat, hairlines over boxes.
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const borderWidth = {
  hairline: 1,
  thin: 1.5,
} as const;

export type Spacing = typeof spacing;
