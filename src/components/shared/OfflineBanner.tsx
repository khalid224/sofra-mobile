import { View, Text } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useAppStore } from '@/store';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, spacing } from '@/theme/tokens';

export function OfflineBanner() {
  const isOffline = useAppStore((s) => s.isOffline);
  const { colors } = useTheme();

  if (!isOffline) return null;

  return (
    <View
      style={{
        backgroundColor: colors.warning,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: 6,
        paddingHorizontal: spacing.md,
      }}
    >
      <WifiOff size={14} color={colors.warningForeground} />
      <Text
        style={{
          fontFamily: fontFamily.semibold,
          fontSize: fontSize.xs,
          color: colors.warningForeground,
        }}
      >
        لا يوجد اتصال بالإنترنت — أنت في وضع عدم الاتصال
      </Text>
    </View>
  );
}
