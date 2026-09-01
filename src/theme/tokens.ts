// SOFRA — Warm Egyptian Editorial × Premium Homemade Food.
// The tokens intentionally stay framework-agnostic so the existing app
// architecture can keep consuming them without screen-level hard-coded colors.

export const lightColors = {
  background: '#F9EEDB',
  surface: '#FFFDF8',
  surfaceElevated: '#FFFDF8',

  card: '#FFFDF8',
  cardForeground: '#3B261D',

  primary: '#4A2A1F',
  primaryLight: '#6B4A3A',
  primaryDark: '#321C15',
  primaryForeground: '#FFFFFF',
  primarySubtle: '#F0DFCA',

  // Terracotta is reserved for offers and editorial highlights.
  accent: '#A85F43',
  accentForeground: '#FFFFFF',
  accentSubtle: '#F5E4D8',

  foreground: '#3B261D',
  foregroundSecondary: '#6B4A3A',
  foregroundTertiary: '#8F796B',

  muted: '#F3E5D2',
  mutedForeground: '#8F796B',

  border: '#E4D0B5',
  borderLight: '#EEDFCB',
  input: '#FFFDF8',
  inputFocus: '#6B4A3A',

  success: '#747A52',
  successForeground: '#FFFFFF',
  successSubtle: '#EAEDD9',

  warning: '#A85F43',
  warningForeground: '#FFFFFF',
  warningSubtle: '#F5E4D8',

  destructive: '#B42318',
  destructiveForeground: '#FFFFFF',
  destructiveSubtle: '#FCE8E6',

  info: '#6B4A3A',
  infoForeground: '#FFFFFF',
  infoSubtle: '#F0DFCA',

  overlay: 'rgba(50, 28, 21, 0.64)',
  overlayLight: 'rgba(50, 28, 21, 0.32)',

  skeleton: '#E4D0B5',
  skeletonHighlight: '#FFF8EC',
  star: '#B8842F',
};

export const darkColors: typeof lightColors = {
  background: '#17100D',
  surface: '#221815',
  surfaceElevated: '#2B1E19',

  card: '#2B1E19',
  cardForeground: '#FFF8EC',

  primary: '#D6A57E',
  primaryLight: '#E5BE9E',
  primaryDark: '#B9825E',
  primaryForeground: '#24140F',
  primarySubtle: '#3A271F',

  accent: '#C47B5B',
  accentForeground: '#FFF8EC',
  accentSubtle: '#43281F',

  foreground: '#FFF8EC',
  foregroundSecondary: '#D7C4B5',
  foregroundTertiary: '#A88D7D',

  muted: '#33231D',
  mutedForeground: '#B59D8E',

  border: '#4A342B',
  borderLight: '#392720',
  input: '#221815',
  inputFocus: '#D6A57E',

  success: '#A8AF76',
  successForeground: '#17100D',
  successSubtle: '#30331F',

  warning: '#C47B5B',
  warningForeground: '#FFF8EC',
  warningSubtle: '#43281F',

  destructive: '#F28B82',
  destructiveForeground: '#2A0A07',
  destructiveSubtle: '#421B18',

  info: '#D6A57E',
  infoForeground: '#17100D',
  infoSubtle: '#3A271F',

  overlay: 'rgba(10, 6, 5, 0.82)',
  overlayLight: 'rgba(10, 6, 5, 0.56)',

  skeleton: '#3A2821',
  skeletonHighlight: '#4A342B',
  star: '#D4A44A',
};

export type ThemeColors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  compact: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  full: 9999,
} as const;

export const fontFamily = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extrabold: 'Cairo_800ExtraBold',
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
  '6xl': 40,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#4A2A1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  md: {
    shadowColor: '#4A2A1F',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  lg: {
    shadowColor: '#4A2A1F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  card: {
    shadowColor: '#4A2A1F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 2,
  },
} as const;

export const gradients = {
  primary: ['#4A2A1F', '#321C15'] as const,
  accent: ['#A85F43', '#874631'] as const,
  calm: ['#6B4A3A', '#4A2A1F'] as const,
  hero: ['rgba(50,28,21,0.08)', 'rgba(50,28,21,0.88)'] as const,
  card: ['rgba(255,253,248,0)', 'rgba(255,253,248,0.98)'] as const,
};
