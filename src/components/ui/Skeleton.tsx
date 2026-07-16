import { useEffect } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';
import { radius } from '@/theme/tokens';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = radius.md, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.4, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[animStyle, { width: width as number, height, borderRadius, backgroundColor: colors.skeleton }, style]}
    />
  );
}

export function SkeletonCard() {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', flex: 1, margin: 6 }}>
      <Skeleton width="100%" height={160} borderRadius={0} />
      <View style={{ padding: 12, gap: 8 }}>
        <Skeleton height={14} width="75%" />
        <Skeleton height={12} width="50%" />
        <Skeleton height={16} width="40%" />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12, padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ backgroundColor: colors.card, borderRadius: radius.xl, padding: 14, flexDirection: 'row', gap: 12 }}>
          <Skeleton width={64} height={64} borderRadius={radius.lg} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton height={14} width="70%" />
            <Skeleton height={12} width="50%" />
            <Skeleton height={12} width="40%" />
          </View>
        </View>
      ))}
    </View>
  );
}
