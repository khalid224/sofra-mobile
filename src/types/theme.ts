import type { ThemeColors } from '@/theme/tokens';

// Re-export for easy import throughout the app
export type { ThemeColors };

// Common prop type for components that receive colors
export interface WithColors {
  colors: ThemeColors;
}
