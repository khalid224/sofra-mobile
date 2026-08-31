import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, spacing } from '@/theme/tokens';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onPress?: () => void;
}

export function SectionHeader({ title, subtitle, icon, actionLabel = 'عرض الكل', onPress }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.compact, flexDirection: 'row-reverse', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.bold, fontSize: fontSize.xl, textAlign: 'right' }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: fontFamily.regular, fontSize: fontSize.xs, textAlign: 'right', marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {onPress ? (
        <Pressable onPress={onPress} hitSlop={8} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3, paddingVertical: 4 }}>
          <Text style={{ color: colors.primary, fontFamily: fontFamily.semibold, fontSize: fontSize.sm }}>{actionLabel}</Text>
          <ArrowLeft size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}
