// SOFRA BRAND REFRESH — Design Tokens
// Palette: Cream (#F6EFE3), Sand (#E9DCC3), Terracotta (#C1694A / #A8563A), Olive (#71794C), Deep Brown (#4A342A)

export const lightColors = {
  // Background
  background: '#F6EFE3',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Card
  card: '#FFFFFF',
  cardForeground: '#4A342A',

  // Primary — Terracotta
  primary: '#C1694A',
  primaryLight: '#D4785A',
  primaryDark: '#A8563A',
  primaryForeground: '#FFFFFF',
  primarySubtle: '#FAF0EC',

  // Accent — Olive
  accent: '#71794C',
  accentForeground: '#FFFFFF',
  accentSubtle: '#F4F5EE',

  // Foreground — Deep Brown
  foreground: '#4A342A',
  foregroundSecondary: '#71574B',
  foregroundTertiary: '#9A8275',

  // Muted — Sand & Warm Muted
  muted: '#EDE0CC',
  mutedForeground: '#71574B',

  // Border & Input
  border: '#E9DCC3',
  borderLight: '#F3EBE0',
  input: '#FAF5EE',
  inputFocus: '#C1694A',

  // Semantic
  success: '#5A7543',
  successForeground: '#FFFFFF',
  successSubtle: '#F2F5EF',

  warning: '#D97706',
  warningForeground: '#FFFFFF',
  warningSubtle: '#FEF3C7',

  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',
  destructiveSubtle: '#FEE2E2',

  info: '#2563EB',
  infoForeground: '#FFFFFF',
  infoSubtle: '#EFF6FF',

  // Overlay
  overlay: 'rgba(74, 52, 42, 0.5)',
  overlayLight: 'rgba(74, 52, 42, 0.3)',

  // Skeleton
  skeleton: '#E9DCC3',
  skeletonHighlight: '#F6EFE3',

  // Rating
  star: '#F59E0B',
};

export const darkColors: typeof lightColors = {
  background: '#1C1008',
  surface: '#261510',
  surfaceElevated: '#331B14',

  card: '#261510',
  cardForeground: '#F6EFE3',

  primary: '#D4785A',
  primaryLight: '#E2937A',
  primaryDark: '#C1694A',
  primaryForeground: '#FFFFFF',
  primarySubtle: '#3B1F16',

  accent: '#89925E',
  accentForeground: '#FFFFFF',
  accentSubtle: '#222616',

  foreground: '#F6EFE3',
  foregroundSecondary: '#E9DCC3',
  foregroundTertiary: '#BCAFA4',

  muted: '#2E1A10',
  mutedForeground: '#BCAFA4',

  border: '#3D2416',
  borderLight: '#2E1A10',
  input: '#2E1A10',
  inputFocus: '#D4785A',

  success: '#6B8E4E',
  successForeground: '#1C1008',
  successSubtle: '#17240E',

  warning: '#F59E0B',
  warningForeground: '#1C1008',
  warningSubtle: '#291A03',

  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
  destructiveSubtle: '#360C0C',

  info: '#3B82F6',
  infoForeground: '#FFFFFF',
  infoSubtle: '#0D1E3A',

  overlay: 'rgba(0,0,0,0.7)',
  overlayLight: 'rgba(0,0,0,0.5)',

  skeleton: '#2E1A10',
  skeletonHighlight: '#3D2416',

  star: '#F59E0B',
};

export type ThemeColors = typeof lightColors;

// ─── Spacing (8pt grid) ──────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,
} as const;

// ─── Border Radius ───────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 9999,
} as const;

// ─── Typography (Tajawal) ────────────────────────────────────
export const fontFamily = {
  regular: 'Tajawal_400Regular',
  medium: 'Tajawal_500Medium',
  semibold: 'Tajawal_700Bold',
  bold: 'Tajawal_700Bold',
  extrabold: 'Tajawal_800ExtraBold',
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

// ─── Shadows ────────────────────────────────────────────────
export const shadow = {
  sm: {
    shadowColor: '#4A342A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#4A342A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: '#4A342A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  card: {
    shadowColor: '#4A342A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;

export const gradients = {
  primary: ['#C1694A', '#D4785A'] as const,
  warm: ['#C1694A', '#71794C'] as const,
  hero: ['rgba(74, 52, 42, 0)', 'rgba(74, 52, 42, 0.8)'] as const,
  card: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.98)'] as const,
};
