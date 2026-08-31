import type { ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

export function PressableScale({
  children,
  style,
  contentStyle,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pressIn = (event: GestureResponderEvent) => {
    scale.value = withSpring(scaleTo, { damping: 18, stiffness: 320 });
    onPressIn?.(event);
  };

  const pressOut = (event: GestureResponderEvent) => {
    scale.value = withSpring(1, { damping: 18, stiffness: 260 });
    onPressOut?.(event);
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        {...props}
        disabled={disabled}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[{ width: '100%' }, contentStyle, disabled && { opacity: 0.55 }]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
