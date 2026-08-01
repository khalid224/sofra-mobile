import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowRight, Moon, Sun, Search, ShoppingCart, Heart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { QUERY_KEYS } from '@/constants';

interface ScreenHeaderProps {
  title?: string;
  showBack?: boolean;
  showLogo?: boolean;
  showSearch?: boolean;
  showThemeToggle?: boolean;
  showActions?: boolean; // Shows Cart + Favorites badges
  onSearchPress?: () => void;
  rightElement?: React.ReactNode;
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
  const { user } = useAuth();

  // Brand settings — logo_url from DB
  const brandQuery = useQuery({
    queryKey: [QUERY_KEYS.BRAND_SETTINGS],
    queryFn: async () => {
      const { data } = await supabase
        .from('brand_settings')
        .select('key, value')
        .in('key', ['logo_url', 'home_title']);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r) => { map[r.key] = r.value ?? ''; });
      return map;
    },
    staleTime: 5 * 60_000, // 5 min
  });
  const logoUrl = brandQuery.data?.logo_url ?? '';

  // Reactive favorites count
  const favCount = useQuery({
    queryKey: [QUERY_KEYS.FAVORITES, 'count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('favorites')
        .select('meal_id', { count: 'exact', head: true })
        .eq('customer_id', user.id);
      return count ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
  const favorites = favCount.data ?? 0;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const BadgeIcon = ({
    onPress,
    icon: Icon,
    count,
    color,
  }: {
    onPress: () => void;
    icon: typeof ShoppingCart;
    count: number;
    color?: string;
  }) => (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.muted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={20} color={color ?? colors.foreground} />
      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            backgroundColor: colors.primary,
            borderRadius: 10,
            minWidth: 18,
            height: 18,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
            borderWidth: 1.5,
            borderColor: colors.surface,
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 9,
              fontFamily: fontFamily.bold,
              lineHeight: 14,
            }}
          >
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: spacing.md,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
        ...shadow.sm,
      }}
    >
      {/* Left side: Logo / Back button / Title (RTL — visually right side) */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
        {showLogo && (
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={{ width: 36, height: 36, borderRadius: 18 }}
                contentFit="contain"
              />
            ) : (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontFamily: fontFamily.extrabold, fontSize: 16 }}>S</Text>
              </View>
            )}
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: fontSize['2xl'], color: colors.primary }}>
              sofra
            </Text>
          </View>
        )}
        {showBack && (
          <Pressable
            onPress={handleBack}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.muted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowRight size={20} color={colors.foreground} />
          </Pressable>
        )}
        {title && !showLogo && (
          <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground }}>
            {title}
          </Text>
        )}
      </View>

      {/* Center title (when logo is shown alongside title) */}
      {showLogo && title && (
        <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground }}>
          {title}
        </Text>
      )}

      {/* Right side: actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {rightElement}

        {/* Cart + Favorites badges (shown on root home screen) */}
        {showActions && (
          <>
            <BadgeIcon
              onPress={() => router.push('/cart')}
              icon={ShoppingCart}
              count={totalItems}
              color={totalItems > 0 ? colors.primary : colors.foreground}
            />
            <BadgeIcon
              onPress={() => router.push('/favorites')}
              icon={Heart}
              count={favorites}
              color={favorites > 0 ? '#e11d48' : colors.foreground}
            />
          </>
        )}

        {showSearch && (
          <Pressable
            onPress={onSearchPress}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.muted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Search size={18} color={colors.foreground} />
          </Pressable>
        )}

        {showThemeToggle && (
          <Pressable
            onPress={toggle}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.muted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isDark ? <Sun size={18} color={colors.foreground} /> : <Moon size={18} color={colors.foreground} />}
          </Pressable>
        )}
      </View>
    </View>
  );
}
