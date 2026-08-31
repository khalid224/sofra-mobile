import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { ChevronLeft, ShoppingBag } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/contexts/CartContext';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import { formatEGP } from '@/utils';

export function MiniCart() {
  const { colors } = useTheme();
  const { isReady, subtotal, totalItems } = useCart();
  const router = useRouter();
  const segments = useSegments();
  const routeSegments = segments as string[];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const previousTotal = useRef(totalItems);
  const hydrated = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateY = useSharedValue(90);
  const opacity = useSharedValue(0);
  const badgeScale = useSharedValue(1);

  useEffect(() => {
    if (!isReady) return;
    if (!hydrated.current) {
      hydrated.current = true;
      previousTotal.current = totalItems;
      return;
    }

    if (totalItems > previousTotal.current) {
      setVisible(true);
      translateY.value = withSpring(0, { damping: 20, stiffness: 260 });
      opacity.value = withTiming(1, { duration: reduceMotion ? 0 : 180 });
      badgeScale.value = reduceMotion
        ? 1
        : withSequence(withSpring(1.28, { damping: 10 }), withSpring(1, { damping: 14 }));
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        translateY.value = withTiming(90, { duration: reduceMotion ? 0 : 190 });
        opacity.value = withTiming(0, { duration: reduceMotion ? 0 : 160 });
        setTimeout(() => setVisible(false), reduceMotion ? 0 : 200);
      }, 4200);
    }

    if (totalItems === 0) setVisible(false);
    previousTotal.current = totalItems;
  }, [badgeScale, isReady, opacity, reduceMotion, totalItems, translateY]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

  const onTabs = routeSegments[0] === '(tabs)';
  const onCart = onTabs && routeSegments[1] === 'cart';
  const onQuickView = routeSegments[0] === 'food' && routeSegments[1] === 'quick';
  const shouldHide = onCart || onQuickView || routeSegments[0] === 'checkout' || routeSegments[0] === 'auth' || routeSegments[0] === 'onboarding';

  if (!visible || totalItems === 0 || shouldHide) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: onTabs ? 86 : Math.max(insets.bottom, spacing.compact),
        zIndex: 50,
        alignItems: 'center',
        paddingHorizontal: spacing.md,
      }}
    >
      <Animated.View style={[{ width: '100%', maxWidth: Math.min(560, width - spacing.md * 2) }, cardStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`عرض السلة، ${totalItems} أصناف بقيمة ${formatEGP(subtotal)}`}
          onPress={() => {
            setVisible(false);
            router.navigate('/(tabs)/cart');
          }}
          style={{
            minHeight: 62,
            borderRadius: radius.xl,
            backgroundColor: colors.primaryDark,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            gap: spacing.compact,
            ...shadow.lg,
          }}
        >
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
            <Animated.View
              style={[
                {
                  minWidth: 34,
                  height: 34,
                  paddingHorizontal: 8,
                  borderRadius: 17,
                  backgroundColor: colors.primaryForeground,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                badgeStyle,
              ]}
            >
              <Text style={{ color: colors.primaryDark, fontFamily: fontFamily.extrabold, fontSize: fontSize.sm }}>{totalItems}</Text>
            </Animated.View>
            <View>
              <Text style={{ color: colors.primaryForeground, fontFamily: fontFamily.bold, fontSize: fontSize.md, textAlign: 'right' }}>عرض السلة</Text>
              <Text style={{ color: colors.primaryForeground, opacity: 0.78, fontFamily: fontFamily.regular, fontSize: fontSize.xs, textAlign: 'right' }}>تمت إضافة الصنف بنجاح</Text>
            </View>
          </View>
          <View style={{ marginLeft: 0, marginRight: 'auto', flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
            <ShoppingBag size={17} color={colors.primaryForeground} />
            <Text style={{ color: colors.primaryForeground, fontFamily: fontFamily.extrabold, fontSize: fontSize.md }}>{formatEGP(subtotal)}</Text>
            <ChevronLeft size={17} color={colors.primaryForeground} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
