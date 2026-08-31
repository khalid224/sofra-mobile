import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowRight, Moon, Search, ShoppingBag, Sun, UserRound } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, shadow, spacing } from '@/theme/tokens';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { QUERY_KEYS } from '@/constants';
import { PressableScale } from '@/components/ui/PressableScale';

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

export function ScreenHeader({
  title,
  showBack = false,
  showLogo = false,
  showSearch = false,
  showThemeToggle = true,
  showActions = false,
  onSearchPress,
  rightElement,
}: ScreenHeaderProps) {
  const { colors, isDark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { totalItems } = useCart();
  const { profile, user } = useAuth();

  const brandQuery = useQuery({
    queryKey: [QUERY_KEYS.BRAND_SETTINGS],
    queryFn: async () => {
      const { data } = await supabase.from('brand_settings').select('key, value').in('key', ['logo_url', 'home_title']);
      const map: Record<string, string> = {};
      (data ?? []).forEach((row) => { map[row.key] = row.value ?? ''; });
      return map;
    },
    staleTime: 5 * 60_000,
  });

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const logoUrl = brandQuery.data?.logo_url ?? '';
  const displayName = profile?.full_name?.split(' ')[0] ?? '';

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
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={{ width: 42, height: 42, borderRadius: 14 }} contentFit="cover" />
            ) : (
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.extrabold, fontSize: fontSize.lg }}>S</Text>
              </View>
            )}
            <View>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize.xl, color: colors.foreground, textAlign: 'right' }}>sofra</Text>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: 10, color: colors.mutedForeground, textAlign: 'right' }}>
                {displayName ? `أهلًا، ${displayName}` : 'كل اللي تحبه لحد بابك'}
              </Text>
            </View>
          </View>
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
            <PressableScale
              onPress={() => user ? router.navigate('/(tabs)/account') : router.push('/auth')}
              style={{ width: 42, height: 42 }}
              contentStyle={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: 42, height: 42, borderRadius: 14 }} contentFit="cover" />
              ) : (
                <UserRound size={20} color={colors.primary} />
              )}
            </PressableScale>
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
