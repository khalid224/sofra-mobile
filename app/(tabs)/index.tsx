import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ChefHat,
  Clock,
  ShieldCheck,
  Star,
  Truck,
  Flame,
  Zap,
  Tag,
} from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FoodCard } from '@/components/shared/FoodCard';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import {
  fetchCategories,
  fetchMeals,
  fetchAvailableToday,
} from '@/features/menu/api/meals.api';
import { fetchApprovedReviews } from '@/features/reviews/api/reviews.api';
import { FloatingButtons } from '@/components/shared/FloatingButtons';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { QUERY_KEYS } from '@/constants';
import type { AvailableToday, Category, Review } from '@/types';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Hero banners data ───────────────────────────────────────
const HERO_BANNERS = [
  {
    id: '1',
    gradient: ['#FF6B35', '#F7C59F'],
    title: 'طعم البيت\nيوصلك لبيتك',
    subtitle: 'أكل بيتي مصري أصيل، محضّر بحب',
    emoji: '🍛',
    cta: 'اطلب الآن',
  },
  {
    id: '2',
    gradient: ['#6C63FF', '#A78BFA'],
    title: 'عروض اليوم\nلا تفوتها',
    subtitle: 'أسعار خاصة على أشهر الأكلات',
    emoji: '🔥',
    cta: 'شوف العروض',
  },
  {
    id: '3',
    gradient: ['#059669', '#34D399'],
    title: 'طازة دائماً\nجودة مضمونة',
    subtitle: 'نضمن لك أعلى معايير الجودة والنظافة',
    emoji: '✨',
    cta: 'تعرف أكتر',
  },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const { addItem } = useCart();
  const [refreshing, setRefreshing] = useState(false);
  const [heroBanner, setHeroBanner] = useState(0);
  const heroScrollRef = useRef<ScrollView>(null);
  const heroAutoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Queries ──────────────────────────────────────────────
  const categories = useQuery({
    queryKey: [QUERY_KEYS.CATEGORIES],
    queryFn: fetchCategories,
    staleTime: 60_000,
  });
  const featured = useQuery({
    queryKey: [QUERY_KEYS.FEATURED_MEALS],
    queryFn: () => fetchMeals({ featured: true, pageSize: 8 }),
  });
  const popular = useQuery({
    queryKey: [QUERY_KEYS.POPULAR_MEALS],
    queryFn: () => fetchMeals({ popular: true, pageSize: 8 }),
  });
  const newest = useQuery({
    queryKey: [QUERY_KEYS.MEALS, 'newest'],
    queryFn: () => fetchMeals({ sort: 'newest', pageSize: 8 }),
  });
  const todaySpecials = useQuery({
    queryKey: [QUERY_KEYS.AVAILABLE_TODAY],
    queryFn: fetchAvailableToday,
    staleTime: 60_000,
  });
  const approvedReviews = useQuery({
    queryKey: [QUERY_KEYS.APPROVED_REVIEWS],
    queryFn: () => fetchApprovedReviews(8),
    staleTime: 60_000,
  });
  const restaurantStatus = useQuery({
    queryKey: [QUERY_KEYS.RESTAURANT_STATUS],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'restaurant_is_open',
          'restaurant_open_time',
          'restaurant_close_time',
          'restaurant_closed_msg',
          'whatsapp_number',
        ]);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r) => {
        map[r.key] = String(r.value).replace(/^"|"$/g, '');
      });
      return map;
    },
    staleTime: 60_000,
  });

  const isOpen = restaurantStatus.data?.restaurant_is_open !== 'false';
  const openTime = restaurantStatus.data?.restaurant_open_time ?? '09:00';
  const closeTime = restaurantStatus.data?.restaurant_close_time ?? '22:00';
  const closedMsg =
    restaurantStatus.data?.restaurant_closed_msg ??
    `مغلق حالياً. يفتح الساعة ${openTime}`;

  // ── Hero auto-scroll ──────────────────────────────────────
  useEffect(() => {
    heroAutoRef.current = setInterval(() => {
      setHeroBanner((prev) => {
        const next = (prev + 1) % HERO_BANNERS.length;
        heroScrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
        return next;
      });
    }, 4000);
    return () => {
      if (heroAutoRef.current) clearInterval(heroAutoRef.current);
    };
  }, []);

  const onHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setHeroBanner(idx);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      categories.refetch(),
      featured.refetch(),
      popular.refetch(),
      newest.refetch(),
      todaySpecials.refetch(),
      approvedReviews.refetch(),
      restaurantStatus.refetch(),
    ]);
    setRefreshing(false);
  }, [categories, featured, popular, newest, todaySpecials, approvedReviews, restaurantStatus]);

  if (categories.isError || featured.isError) {
    return <ErrorState onRetry={onRefresh} />;
  }

  const greeting = profile?.full_name
    ? `أهلاً، ${profile.full_name.split(' ')[0]} 👋`
    : 'أهلاً بك 👋';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        showLogo
        showSearch
        showActions
        showThemeToggle
        onSearchPress={() => router.push('/search')}
      />

      {/* Restaurant Status Banner */}
      {!isOpen && (
        <View
          style={{
            backgroundColor: '#7f1d1d',
            paddingVertical: 10,
            paddingHorizontal: spacing.md,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <AlertTriangle size={16} color='#fca5a5' />
          <Text
            style={{
              color: '#fca5a5',
              fontFamily: fontFamily.semibold,
              fontSize: fontSize.sm,
              flex: 1,
              textAlign: 'right',
            }}
          >
            {closedMsg}
          </Text>
        </View>
      )}
      {isOpen && (
        <View
          style={{
            backgroundColor: colors.primarySubtle,
            paddingVertical: 8,
            paddingHorizontal: spacing.md,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#22c55e',
            }}
          />
          <Text
            style={{
              color: colors.primary,
              fontFamily: fontFamily.semibold,
              fontSize: fontSize.sm,
            }}
          >
            مفتوح الآن · يغلق {closeTime}
          </Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Hero Carousel ── */}
        <View>
          <ScrollView
            ref={heroScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onHeroScroll}
            scrollEventThrottle={16}
          >
            {HERO_BANNERS.map((banner) => (
              <View
                key={banner.id}
                style={{
                  width: SCREEN_W,
                  height: 200,
                  backgroundColor: banner.gradient[0],
                  justifyContent: 'center',
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.lg,
                }}
              >
                {/* Background circle decoration */}
                <View
                  style={{
                    position: 'absolute',
                    right: -30,
                    top: -30,
                    width: 180,
                    height: 180,
                    borderRadius: 90,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    right: 40,
                    bottom: -20,
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                  }}
                />

                <Text
                  style={{
                    fontSize: 52,
                    position: 'absolute',
                    right: spacing.xl,
                    bottom: spacing.md,
                  }}
                >
                  {banner.emoji}
                </Text>

                <Text
                  style={{
                    fontFamily: fontFamily.extrabold,
                    fontSize: 26,
                    color: '#fff',
                    textAlign: 'right',
                    lineHeight: 34,
                  }}
                >
                  {banner.title}
                </Text>
                <Text
                  style={{
                    fontFamily: fontFamily.regular,
                    fontSize: fontSize.sm,
                    color: 'rgba(255,255,255,0.85)',
                    textAlign: 'right',
                    marginTop: 6,
                  }}
                >
                  {banner.subtitle}
                </Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/menu')}
                  style={{
                    marginTop: 14,
                    alignSelf: 'flex-end',
                    backgroundColor: 'rgba(255,255,255,0.22)',
                    borderRadius: radius.full,
                    paddingHorizontal: 18,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.35)',
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontFamily: fontFamily.bold,
                      fontSize: fontSize.sm,
                    }}
                  >
                    {banner.cta}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          {/* Dots */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
            }}
          >
            {HERO_BANNERS.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === heroBanner ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor:
                    i === heroBanner ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>
        </View>

        {/* ── Greeting + Search ── */}
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamily.bold,
              fontSize: fontSize.lg,
              color: colors.mutedForeground,
              textAlign: 'right',
            }}
          >
            {greeting}
          </Text>
          <Pressable
            onPress={() => router.push('/search')}
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              backgroundColor: colors.input,
              borderRadius: radius['2xl'],
              paddingHorizontal: spacing.md,
              paddingVertical: 13,
              marginTop: 10,
              gap: spacing.sm,
              borderWidth: 1.5,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamily.regular,
                fontSize: fontSize.md,
                color: colors.mutedForeground,
                flex: 1,
                textAlign: 'right',
              }}
            >
              ابحث عن أكلة...
            </Text>
          </Pressable>
        </View>

        {/* ── Why Us chips ── */}
        <WhyUsSection colors={colors} />

        {/* ── Categories ── */}
        <SectionHeader
          title='تصفّح الأقسام'
          icon={<Tag size={16} color={colors.primary} />}
          onSeeAll={() => router.push('/(tabs)/menu')}
          colors={colors}
        />
        {categories.isLoading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.md,
              gap: spacing.sm,
              paddingBottom: spacing.md,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} width={72} height={92} borderRadius={16} />
            ))}
          </ScrollView>
        ) : (
          <CategoryRow
            categories={categories.data ?? []}
            router={router}
            colors={colors}
          />
        )}

        {/* ── Available Today / Made To Order ── */}
        {(todaySpecials.isLoading ||
          (todaySpecials.data?.length ?? 0) > 0) && (
          <>
            <SectionHeader
              title='👨‍🍳 يُحضَّر عند الطلب'
              icon={<ChefHat size={18} color={colors.primary} />}
              onSeeAll={undefined}
              colors={colors}
            />
            <View style={{ paddingHorizontal: spacing.md, marginTop: -4, marginBottom: spacing.sm, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: colors.mutedForeground }}>
                يبدأ التحضير بعد تأكيد الطلب · حوالي ساعة
              </Text>
            </View>
            {todaySpecials.isLoading ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: spacing.md,
                  gap: spacing.sm,
                }}
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} width={200} height={200} borderRadius={16} />
                ))}
              </ScrollView>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: spacing.md,
                  gap: spacing.sm,
                  paddingBottom: spacing.sm,
                }}
              >
                {(todaySpecials.data ?? []).map((special) => (
                  <TodaySpecialCard
                    key={special.id}
                    item={special}
                    colors={colors}
                    isOpen={isOpen}
                    onPress={() =>
                      router.push({
                        pathname: '/food/[id]',
                        params: {
                          id: special.meal_id ?? special.id,
                          todaySpecialId: special.id,
                        },
                      })
                    }
                    onAdd={() => {
                      if (!isOpen || special.status !== 'available') return;
                      addItem({
                        meal_id: special.meal_id ?? special.id,
                        name: special.title,
                        image_url: special.image_url,
                        price: special.price,
                        quantity: 1,
                        notes: '',
                        is_today_special: true,
                        today_special_id: special.id,
                      });
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* ── Featured ── */}
        {(featured.isLoading || (featured.data?.data?.length ?? 0) > 0) && (
          <>
            <SectionHeader
              title='مختاراتنا المميزة ✨'
              icon={<Star size={16} color='#f59e0b' />}
              onSeeAll={() => router.push('/(tabs)/menu')}
              colors={colors}
            />
            {featured.isLoading ? (
              <View
                style={{ flexDirection: 'row', paddingHorizontal: spacing.md }}
              >
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ) : (
              <FlatList
                data={featured.data?.data}
                keyExtractor={(m) => m.id}
                numColumns={2}
                scrollEnabled={false}
                contentContainerStyle={{ paddingHorizontal: spacing.sm }}
                renderItem={({ item }) => <FoodCard meal={item} />}
              />
            )}
          </>
        )}

        {/* ── Popular / Best Sellers ── */}
        {(popular.isLoading || (popular.data?.data?.length ?? 0) > 0) && (
          <>
            <SectionHeader
              title='الأكثر طلباً 🔥'
              icon={<Flame size={16} color='#ef4444' />}
              onSeeAll={() => router.push('/(tabs)/menu')}
              colors={colors}
              accent='#ef4444'
            />
            {popular.isLoading ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: spacing.sm,
                  gap: spacing.sm,
                }}
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </ScrollView>
            ) : (
              <FlatList
                data={popular.data?.data}
                keyExtractor={(m) => m.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: spacing.sm,
                }}
                renderItem={({ item }) => (
                  <View style={{ width: 200 }}>
                    <FoodCard meal={item} size='sm' />
                  </View>
                )}
              />
            )}
          </>
        )}

        {/* ── Recently Added ── */}
        {(newest.isLoading || (newest.data?.data?.length ?? 0) > 0) && (
          <>
            <SectionHeader
              title='أحدث الإضافات 🆕'
              icon={<Zap size={16} color={colors.primary} />}
              onSeeAll={() => router.push('/(tabs)/menu')}
              colors={colors}
            />
            {newest.isLoading ? (
              <View
                style={{ flexDirection: 'row', paddingHorizontal: spacing.md }}
              >
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ) : (
              <FlatList
                data={newest.data?.data}
                keyExtractor={(m) => m.id}
                numColumns={2}
                scrollEnabled={false}
                contentContainerStyle={{ paddingHorizontal: spacing.sm }}
                renderItem={({ item }) => <FoodCard meal={item} />}
              />
            )}
          </>
        )}

        {/* ── Customer Reviews Section ── */}
        {(approvedReviews.data?.length ?? 0) > 0 && (
          <>
            <SectionHeader
              title='آراء العملاء ⭐'
              icon={<Star size={16} color='#f59e0b' />}
              onSeeAll={() => router.push('/reviews')}
              colors={colors}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing.md,
                gap: spacing.sm,
                paddingBottom: spacing.sm,
              }}
            >
              {approvedReviews.data?.map((rev) => (
                <View
                  key={rev.id}
                  style={{
                    width: 240,
                    backgroundColor: colors.card,
                    borderRadius: radius.xl,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: rev.is_pinned ? '#f59e0b' : colors.border,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} color='#f59e0b' fill={i < rev.rating ? '#f59e0b' : 'transparent'} />
                      ))}
                    </View>
                    {rev.is_pinned && (
                      <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontFamily: fontFamily.bold, color: '#b45309' }}>مميز ⭐</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.foreground, textAlign: 'right' }}>
                    {rev.customer?.full_name ?? 'عميل سفرة'}
                  </Text>
                  {rev.meal && (
                    <Text style={{ fontFamily: fontFamily.medium, fontSize: 10, color: colors.primary, textAlign: 'right' }}>
                      على صنف: {rev.meal.name}
                    </Text>
                  )}
                  {rev.comment && (
                    <Text numberOfLines={3} style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: 'right', lineHeight: 18 }}>
                      "{rev.comment}"
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Footer ── */}
        <FooterSection colors={colors} />

        <View style={{ height: spacing['2xl'] }} />
      </ScrollView>

      {/* ── Floating WhatsApp & Chat Action Buttons ── */}
      <FloatingButtons whatsappNumber={restaurantStatus.data?.whatsapp_number} />
    </View>
  );
}

// ─── Section Header ──────────────────────────────────────────
function SectionHeader({
  title,
  icon,
  onSeeAll,
  colors,
  accent,
}: {
  title: string;
  icon?: React.ReactNode;
  onSeeAll?: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  accent?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
      }}
    >
      <View
        style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}
      >
        {icon}
        <Text
          style={{
            fontFamily: fontFamily.bold,
            fontSize: fontSize['2xl'],
            color: colors.foreground,
          }}
        >
          {title}
        </Text>
      </View>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text
            style={{
              fontFamily: fontFamily.semibold,
              fontSize: fontSize.sm,
              color: accent ?? colors.primary,
            }}
          >
            الكل
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Category Row ─────────────────────────────────────────────
function CategoryRow({
  categories,
  router,
  colors,
}: {
  categories: Category[];
  router: ReturnType<typeof useRouter>;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const emojis = ['🍛', '🥗', '🍖', '🥘', '🍜', '🥙', '🍲', '🧆'];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
        paddingBottom: spacing.md,
      }}
    >
      {categories.map((cat, i) => (
        <Pressable
          key={cat.id}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/menu',
              params: { categoryId: cat.id },
            })
          }
          style={{ alignItems: 'center', gap: 6 }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.xl,
              backgroundColor: colors.primarySubtle,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: colors.border,
            }}
          >
            {cat.image_url ? (
              <Image
                source={{ uri: cat.image_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit='cover'
              />
            ) : (
              <Text style={{ fontSize: 28 }}>{emojis[i % emojis.length]}</Text>
            )}
          </View>
          <Text
            style={{
              fontFamily: fontFamily.medium,
              fontSize: fontSize.xs,
              color: colors.foreground,
              textAlign: 'center',
              maxWidth: 72,
            }}
            numberOfLines={2}
          >
            {cat.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Today Special Card ───────────────────────────────────────
function TodaySpecialCard({
  item,
  colors,
  isOpen,
  onPress,
  onAdd,
}: {
  item: AvailableToday;
  colors: ReturnType<typeof useTheme>['colors'];
  isOpen: boolean;
  onPress: () => void;
  onAdd: () => void;
}) {
  const isSoldOut = item.status === 'sold_out';
  const isExpired = item.status === 'expired';
  const disabled = isSoldOut || isExpired || !isOpen;

  const statusLabel = isExpired
    ? 'انتهى'
    : isSoldOut
    ? 'نفذت الكمية'
    : !isOpen
    ? 'المطعم مغلق'
    : null;

  const statusColor = isExpired
    ? '#9ca3af'
    : isSoldOut
    ? '#ef4444'
    : '#22c55e';

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 200,
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: disabled ? colors.border : colors.primary + '40',
        opacity: disabled ? 0.75 : 1,
      }}
    >
      {/* Image */}
      <View
        style={{
          height: 120,
          backgroundColor: colors.muted,
          position: 'relative',
        }}
      >
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit='cover'
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 40 }}>🍽️</Text>
          </View>
        )}

        {/* Status badge */}
        {statusLabel && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: statusColor,
              borderRadius: radius.full,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontFamily: fontFamily.bold,
                fontSize: 10,
              }}
            >
              {statusLabel}
            </Text>
          </View>
        )}

        {/* Today badge */}
        {!disabled && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: '#f59e0b',
              borderRadius: radius.full,
              paddingHorizontal: 8,
              paddingVertical: 3,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Zap size={10} color='#fff' />
            <Text
              style={{
                color: '#fff',
                fontFamily: fontFamily.bold,
                fontSize: 9,
              }}
            >
              اليوم
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ padding: 12, gap: 6 }}>
        <Text
          style={{
            fontFamily: fontFamily.bold,
            fontSize: fontSize.sm,
            color: colors.foreground,
            textAlign: 'right',
          }}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        <View
          style={{
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: fontFamily.extrabold,
              fontSize: fontSize.md,
              color: colors.primary,
            }}
          >
            {item.price.toFixed(0)} جنيه
          </Text>
          {item.quantity > 0 && !disabled && (
            <Text
              style={{
                fontFamily: fontFamily.medium,
                fontSize: 10,
                color: colors.mutedForeground,
              }}
            >
              متبقي {item.quantity}
            </Text>
          )}
        </View>

        <Pressable
          onPress={onAdd}
          disabled={disabled}
          style={{
            backgroundColor: disabled ? colors.muted : colors.primary,
            borderRadius: radius.lg,
            paddingVertical: 8,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: disabled ? colors.mutedForeground : '#fff',
              fontFamily: fontFamily.bold,
              fontSize: fontSize.sm,
            }}
          >
            {disabled ? (statusLabel ?? 'غير متاح') : 'أضف للسلة'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Why Us Section ───────────────────────────────────────────
function WhyUsSection({
  colors,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const features = [
    { Icon: ChefHat, text: 'أكل بيتي حقيقي' },
    { Icon: ShieldCheck, text: 'جودة مضمونة' },
    { Icon: Clock, text: 'طازة دائماً' },
    { Icon: Truck, text: 'توصيل سريع' },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
        paddingBottom: spacing.sm,
        paddingTop: spacing.sm,
      }}
    >
      {features.map((f, i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.primarySubtle,
            borderRadius: radius.xl,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <f.Icon size={16} color={colors.primary} />
          <Text
            style={{
              fontFamily: fontFamily.semibold,
              fontSize: fontSize.sm,
              color: colors.primary,
            }}
          >
            {f.text}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Footer Section ───────────────────────────────────────────
function FooterSection({
  colors,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View
      style={{
        marginTop: spacing.xl,
        marginHorizontal: spacing.md,
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamily.extrabold,
          fontSize: fontSize.xl,
          color: colors.primary,
          textAlign: 'center',
        }}
      >
        sofra 🍽️
      </Text>
      <Text
        style={{
          fontFamily: fontFamily.regular,
          fontSize: fontSize.sm,
          color: colors.mutedForeground,
          textAlign: 'center',
          lineHeight: 22,
        }}
      >
        أكل بيتي مصري أصيل · محضّر بحب · يوصلك طازة
      </Text>
      <Text
        style={{
          fontFamily: fontFamily.medium,
          fontSize: fontSize.xs,
          color: colors.mutedForeground,
          textAlign: 'center',
          marginTop: 4,
        }}
      >
        جميع الحقوق محفوظة © 2025
      </Text>
    </View>
  );
}
