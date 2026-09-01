import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Bell, Moon, Search, ShoppingBag, Sun } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, shadow, spacing } from '@/theme/tokens';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { PressableScale } from '@/components/ui/PressableScale';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants';
import { fetchUnreadCount } from '@/features/notifications/api/notifications.api';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';

interface ScreenHeaderProps {
  title?: string;
  showBack?: boolean;
  showLogo?: boolean;
  showSearch?: boolean;
  showThemeToggle?: boolean;
  showActions?: boolean;
  onSearchPress?: () => void;
  rightElement?: React.ReactNode;
}

function CartAction({ count, onPress }: { count: number; onPress: () => void }) {
  const { colors } = useTheme();
  const badgeScale = useSharedValue(1);

  useEffect(() => {
    if (count > 0) badgeScale.value = withSequence(withSpring(1.28), withSpring(1));
  }, [badgeScale, count]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

  return (
    <PressableScale
      onPress={onPress}
      style={{ width: 42, height: 42 }}
      contentStyle={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
    >
      <ShoppingBag size={20} color={count ? colors.primary : colors.foregroundSecondary} />
      {count > 0 ? (
        <Animated.View style={[badgeStyle, { position: 'absolute', top: -4, right: -4, minWidth: 19, height: 19, paddingHorizontal: 4, borderRadius: 10, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 9 }}>{count > 99 ? '99+' : count}</Text>
        </Animated.View>
      ) : null}
    </PressableScale>
  );
}

function NotificationAction({ userId, onPress }: { userId?: string; onPress: () => void }) {
  const { colors } = useTheme();
  useRealtimeInvalidate('notifications', [QUERY_KEYS.NOTIFICATIONS], !!userId);
  const unreadQuery = useQuery({
    queryKey: [QUERY_KEYS.NOTIFICATIONS, 'unread', userId],
    queryFn: () => fetchUnreadCount(userId!),
    enabled: !!userId,
  });
  const unread = unreadQuery.data ?? 0;

  return (
    <PressableScale
      onPress={onPress}
      style={{ width: 42, height: 42 }}
      contentStyle={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
    >
      <Bell size={20} color={unread ? colors.primary : colors.foregroundSecondary} />
      {unread > 0 ? (
        <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 19, height: 19, paddingHorizontal: 4, borderRadius: 10, backgroundColor: colors.destructive, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 9 }}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

export function ScreenHeader({
  title,
  showBack = false,
  showLogo = false,
  showSearch = false,
  showThemeToggle = false,
  showActions = false,
  onSearchPress,
  rightElement,
}: ScreenHeaderProps) {
  const { colors, isDark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { totalItems } = useCart();
  const { user } = useAuth();

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.compact,
        paddingHorizontal: spacing.md,
        minHeight: insets.top + 68,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
        ...shadow.sm,
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
        {showLogo ? (
          <Text
            accessibilityRole="header"
            style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize['3xl'], lineHeight: 38, color: colors.primary, textAlign: 'right' }}
          >
            سفرة
          </Text>
        ) : null}

        {showBack ? (
          <Pressable onPress={handleBack} hitSlop={8} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowRight size={20} color={colors.foreground} />
          </Pressable>
        ) : null}

        {title && !showLogo ? (
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground, textAlign: 'right' }}>
            {title}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {rightElement}
        {showActions ? (
          <>
            <CartAction count={totalItems} onPress={() => router.navigate('/(tabs)/cart')} />
            <NotificationAction userId={user?.id} onPress={() => user ? router.navigate('/(tabs)/notifications') : router.push('/auth')} />
          </>
        ) : null}

        {showSearch ? (
          <PressableScale
            onPress={onSearchPress}
            style={{ width: 42, height: 42 }}
            contentStyle={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
          >
            <Search size={19} color={colors.foregroundSecondary} />
          </PressableScale>
        ) : null}

        {showThemeToggle ? (
          <PressableScale
            onPress={toggle}
            style={{ width: 42, height: 42 }}
            contentStyle={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
          >
            {isDark ? <Sun size={18} color={colors.foreground} /> : <Moon size={18} color={colors.foreground} />}
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}
