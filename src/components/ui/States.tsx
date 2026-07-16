import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { Button } from './Button';

// ─── Empty State ─────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ emoji, icon, title, description, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.md }}>
      {emoji && (
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 36 }}>{emoji}</Text>
        </View>
      )}
      {icon}
      <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], color: colors.foreground, textAlign: 'center' }}>
        {title}
      </Text>
      {description && (
        <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.mutedForeground, textAlign: 'center', lineHeight: 22 }}>
          {description}
        </Text>
      )}
      {action && (
        <Button onPress={action.onPress} style={{ marginTop: spacing.sm }}>
          {action.label}
        </Button>
      )}
    </View>
  );
}

// ─── Error State ─────────────────────────────────────────────
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'حدث خطأ، يرجى المحاولة مجدداً', onRetry }: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.md }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.destructiveSubtle, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 36 }}>⚠️</Text>
      </View>
      <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground, textAlign: 'center' }}>
        حدث خطأ
      </Text>
      <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.mutedForeground, textAlign: 'center' }}>
        {message}
      </Text>
      {onRetry && (
        <Button onPress={onRetry} variant="outline">
          حاول مجدداً
        </Button>
      )}
    </View>
  );
}

// ─── Loading Full Screen ──────────────────────────────────────
export function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 28 }}>🍽️</Text>
      </View>
    </View>
  );
}
