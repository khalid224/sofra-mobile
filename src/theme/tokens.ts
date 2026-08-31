// SOFRA DELIVERY — calm Arabic-first design system.
// The tokens intentionally stay framework-agnostic so the existing app
// architecture can keep consuming them without screen-level hard-coded colors.

export const lightColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  card: '#FFFFFF',
  cardForeground: '#1E293B',

  primary: '#0F766E',
  primaryLight: '#14B8A6',
  primaryDark: '#115E59',
  primaryForeground: '#FFFFFF',
  primarySubtle: '#ECFDF5',

  // Orange is reserved for offers, rewards and high-attention actions.
  accent: '#F97316',
  accentForeground: '#FFFFFF',
  accentSubtle: '#FFF7ED',

  foreground: '#1E293B',
  foregroundSecondary: '#475569',
  foregroundTertiary: '#94A3B8',

  muted: '#F1F5F9',
  mutedForeground: '#64748B',

  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  input: '#F8FAFC',
  inputFocus: '#0D9488',

  success: '#16A34A',
  successForeground: '#FFFFFF',
  successSubtle: '#F0FDF4',

  warning: '#F97316',
  warningForeground: '#FFFFFF',
  warningSubtle: '#FFF7ED',

  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',
  destructiveSubtle: '#FEF2F2',

  info: '#0284C7',
  infoForeground: '#FFFFFF',
  infoSubtle: '#F0F9FF',

  overlay: 'rgba(15, 23, 42, 0.58)',
  overlayLight: 'rgba(15, 23, 42, 0.28)',

  skeleton: '#E2E8F0',
  skeletonHighlight: '#F8FAFC',
  star: '#F59E0B',
};

export const darkColors: typeof lightColors = {
  background: '#071A19',
  surface: '#0B2422',
  surfaceElevated: '#10302D',

  card: '#0B2422',
  cardForeground: '#F8FAFC',

  primary: '#2DD4BF',
  primaryLight: '#5EEAD4',
  primaryDark: '#14B8A6',
  primaryForeground: '#042F2E',
  primarySubtle: '#103B36',

  accent: '#FB923C',
  accentForeground: '#431407',
  accentSubtle: '#431F0C',

  foreground: '#F8FAFC',
  foregroundSecondary: '#CBD5E1',
  foregroundTertiary: '#94A3B8',

  muted: '#12312E',
  mutedForeground: '#94A3B8',

  border: '#21433F',
  borderLight: '#153632',
  input: '#10302D',
  inputFocus: '#2DD4BF',

  success: '#4ADE80',
  successForeground: '#052E16',
  successSubtle: '#123A28',

  warning: '#FB923C',
  warningForeground: '#431407',
  warningSubtle: '#43220E',

  destructive: '#F87171',
  destructiveForeground: '#450A0A',
  destructiveSubtle: '#421616',

  info: '#38BDF8',
  infoForeground: '#082F49',
  infoSubtle: '#0C3042',

  overlay: 'rgba(2, 6, 23, 0.78)',
  overlayLight: 'rgba(2, 6, 23, 0.52)',

  skeleton: '#173936',
  skeletonHighlight: '#21433F',
  star: '#FBBF24',
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 2,
  },
} as const;

export const gradients = {
  primary: ['#0F766E', '#0D9488'] as const,
  accent: ['#F97316', '#FB923C'] as const,
  calm: ['#0F766E', '#14B8A6'] as const,
  hero: ['rgba(15,23,42,0.04)', 'rgba(15,23,42,0.82)'] as const,
  card: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.98)'] as const,
};
