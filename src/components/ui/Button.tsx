import React, { Children } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  disabled,
  children,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = async (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    if (disabled || loading) return;
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 14, gap: 5 },
    md: { paddingVertical: 13, paddingHorizontal: 20, gap: 6 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, gap: 8 },
    xl: { paddingVertical: 19, paddingHorizontal: 36, gap: 8 },
    icon: { width: 44, height: 44, padding: 0 },
  };

  const textSize = { sm: fontSize.sm, md: fontSize.md, lg: fontSize.lg, xl: fontSize.xl, icon: fontSize.md };

  const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.primary, text: colors.primaryForeground },
    secondary: { bg: colors.muted, text: colors.foreground },
    outline: { bg: 'transparent', text: colors.foreground, border: colors.border },
    ghost: { bg: 'transparent', text: colors.foreground },
    destructive: { bg: colors.destructive, text: colors.destructiveForeground },
  };

  const v = variantStyles[variant];

  const textStyle = {
    color: v.text,
    fontFamily: fontFamily.semibold,
    fontSize: textSize[size],
    letterSpacing: 0.3,
  };

  const renderChildren = () => {
    const childrenArray = Children.toArray(children).filter((child) => {
      if (typeof child === 'string') {
        return child.trim().length > 0;
      }
      return child !== null && child !== undefined;
    });

    if (childrenArray.length === 0) {
      return null;
    }

    const onlyText = childrenArray.every(
      (child) => typeof child === 'string' || typeof child === 'number'
    );

    if (onlyText) {
      return (
        <Text style={textStyle}>
          {childrenArray.map(String).join('')}
        </Text>
      );
    }

    return childrenArray.map((child, index) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return (
          <Text key={index} style={textStyle}>
            {child}
          </Text>
        );
      }
      return child;
    });
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        animStyle,
        {
          backgroundColor: v.bg,
          borderRadius: radius.lg,
          borderWidth: v.border ? 1.5 : 0,
          borderColor: v.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
          ...(fullWidth ? { width: '100%' } : {}),
          ...(size === 'icon' ? sizeStyles.icon : sizeStyles[size]),
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {leftIcon}
          {renderChildren()}
          {rightIcon}
        </>
      )}
    </AnimatedPressable>
  );
}
