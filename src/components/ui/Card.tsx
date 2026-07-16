import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, shadow, spacing } from '@/theme/tokens';

interface CardProps extends ViewProps {
  children?: React.ReactNode;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  padding?: number;
}

export function Card({ children, elevation = 'sm', padding = spacing.md, style, ...rest }: CardProps) {
  const { colors } = useTheme();
  const shadowStyle = elevation === 'none' ? {} : shadow[elevation];

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.borderLight,
          padding,
          ...shadowStyle,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
