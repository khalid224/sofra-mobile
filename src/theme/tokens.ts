// SOFRA ENTERPRISE — Design Tokens
// Palette: Warm Orange / Cream / Deep Mocha — Premium Mediterranean
// Converted from oklch in src/styles.css

export const lightColors = {
  // Background
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Card
  card: '#FFFFFF',
  cardForeground: '#1A0A05',

  // Primary — Terracotta / Warm Orange
  primary: '#CA4B20',
  primaryLight: '#E8734A',
  primaryDark: '#A33A16',
  primaryForeground: '#FFFFFF',
  primarySubtle: '#FDF0EB',

  // Accent — Saffron
  accent: '#CB9317',
  accentForeground: '#1A0A05',
  accentSubtle: '#FEF9EC',

  // Foreground
  foreground: '#1A0A05',
  foregroundSecondary: '#4A2E22',
  foregroundTertiary: '#71574B',

  // Muted
  muted: '#F5EDE5',
  mutedForeground: '#71574B',

  // Border & Input
  border: '#E8DDD6',
  borderLight: '#F0E8E2',
  input: '#EDE4DC',
  inputFocus: '#CA4B20',

  // Semantic
  success: '#22C55E',
  successForeground: '#FFFFFF',
  successSubtle: '#F0FDF4',

  warning: '#F59E0B',
  warningForeground: '#FFFFFF',
  warningSubtle: '#FFFBEB',

  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
  destructiveSubtle: '#FEF2F2',

  info: '#3B82F6',
  infoForeground: '#FFFFFF',
  infoSubtle: '#EFF6FF',

  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.3)',

  // Skeleton
  skeleton: '#F0E8E2',
  skeletonHighlight: '#FAF5F2',

  // Rating
  star: '#F59E0B',
};

export const darkColors: typeof lightColors = {
  background: '#0F0805',
  surface: '#1C110C',
  surfaceElevated: '#261812',

  card: '#1C110C',
  cardForeground: '#F5EDE5',

  primary: '#E8734A',
  primaryLight: '#F09070',
  primaryDark: '#CA4B20',
  primaryForeground: '#FFFFFF',
  primarySubtle: '#2A150D',

  accent: '#D4A832',
  accentForeground: '#0F0805',
  accentSubtle: '#241A06',

  foreground: '#F5EDE5',
  foregroundSecondary: '#D4C4BA',
  foregroundTertiary: '#A08070',

  muted: '#261812',
  mutedForeground: '#A08070',

  border: '#2E1A12',
  borderLight: '#261812',
  input: '#2E1A12',
  inputFocus: '#E8734A',

  success: '#4ADE80',
  successForeground: '#0F0805',
  successSubtle: '#052E16',

  warning: '#FCD34D',
  warningForeground: '#0F0805',
  warningSubtle: '#1C1505',

  destructive: '#F87171',
  destructiveForeground: '#0F0805',
  destructiveSubtle: '#2C0A0A',

  info: '#60A5FA',
  infoForeground: '#0F0805',
  infoSubtle: '#0C1A2E',

  overlay: 'rgba(0,0,0,0.7)',
  overlayLight: 'rgba(0,0,0,0.5)',

  skeleton: '#261812',
  skeletonHighlight: '#2E1A12',

  star: '#FCD34D',
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

// ─── Border Radius (per 09_UI_UX_REDESIGN_SPEC) ──────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 9999,
} as const;

// ─── Typography ──────────────────────────────────────────────
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

// ─── Shadows (soft elevation per spec) ───────────────────────
export const shadow = {
  sm: {
    shadowColor: '#CA4B20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#CA4B20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: '#CA4B20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;

export const gradients = {
  primary: ['#CA4B20', '#E8734A'] as const,
  warm: ['#CA4B20', '#CB9317'] as const,
  hero: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)'] as const,
  card: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)'] as const,
};
