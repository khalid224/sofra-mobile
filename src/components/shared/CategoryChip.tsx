import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import { PressableScale } from '@/components/ui/PressableScale';

interface CategoryChipProps {
  label: string;
  active?: boolean;
  icon?: ReactNode;
  onPress: () => void;
}

export function CategoryChip({ label, active = false, icon, onPress }: CategoryChipProps) {
  const { colors } = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      style={{ marginLeft: spacing.sm }}
      contentStyle={{
        minHeight: 44,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: active ? colors.primary : colors.card,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        ...(active ? shadow.sm : {}),
      }}
    >
      {icon ? <View>{icon}</View> : null}
      <Text
        numberOfLines={1}
        style={{
          color: active ? colors.primaryForeground : colors.foregroundSecondary,
          fontFamily: active ? fontFamily.semibold : fontFamily.medium,
          fontSize: fontSize.sm,
        }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
