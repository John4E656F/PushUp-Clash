// Central design tokens. Dark, neon, gamified.
export const colors = {
  bg: '#0B0B12',
  surface: '#15151F',
  surfaceAlt: '#1E1E2D',
  primary: '#7C5CFF', // electric purple
  primaryDim: '#5B43C4',
  accent: '#27E0B3', // mint
  danger: '#FF5C7C',
  warning: '#FFB35C',
  text: '#FFFFFF',
  textDim: '#9A9AB2',
  border: '#2A2A3D',
  gold: '#FFD15C',
  silver: '#C7CBD6',
  bronze: '#D08A52',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;
