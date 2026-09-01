import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  BadgePercent,
  CheckCircle2,
  ChefHat,
  Clock3,
  Flame,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  UtensilsCrossed,
  Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, gradients, radius, shadow, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FoodCard } from '@/components/shared/FoodCard';
import { CategoryChip } from '@/components/shared/CategoryChip';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { FloatingButtons } from '@/components/shared/FloatingButtons';
import { fetchAvailableToday, fetchCategories, fetchMeals } from '@/features/menu/api/meals.api';
import { fetchApprovedReviews } from '@/features/reviews/api/reviews.api';
import { useCart } from '@/contexts/CartContext';
import { QUERY_KEYS } from '@/constants';
import { supabase } from '@/lib/supabase';
import { formatEGP } from '@/utils';
import type { AvailableToday, Meal } from '@/types';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';

const CATEGORY_ICONS = ['🍽️', '🥘', '🥐', '🍰', '🥗', '🥤'];

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addItem } = useCart();
  const [refreshing, setRefreshing] = useState(false);

  useRealtimeInvalidate('categories', [QUERY_KEYS.CATEGORIES]);
  useRealtimeInvalidate('meals', [QUERY_KEYS.MEALS]);
  useRealtimeInvalidate('meals', [QUERY_KEYS.POPULAR_MEALS]);
  useRealtimeInvalidate('meals', [QUERY_KEYS.FEATURED_MEALS]);
  useRealtimeInvalidate('available_today', [QUERY_KEYS.AVAILABLE_TODAY]);
  useRealtimeInvalidate('reviews', [QUERY_KEYS.APPROVED_REVIEWS]);
  useRealtimeInvalidate('app_settings', [QUERY_KEYS.RESTAURANT_STATUS]);
  useRealtimeInvalidate('brand_settings', [QUERY_KEYS.BRAND_SETTINGS]);

  const categories = useQuery({ queryKey: [QUERY_KEYS.CATEGORIES], queryFn: fetchCategories, staleTime: 60_000 });
  const popular = useQuery({ queryKey: [QUERY_KEYS.POPULAR_MEALS], queryFn: () => fetchMeals({ popular: true, pageSize: 8 }) });
  const featured = useQuery({ queryKey: [QUERY_KEYS.FEATURED_MEALS], queryFn: () => fetchMeals({ featured: true, pageSize: 8 }) });
  const newest = useQuery({ queryKey: [QUERY_KEYS.MEALS, 'home-newest'], queryFn: () => fetchMeals({ sort: 'newest', pageSize: 8 }) });
  const todaySpecials = useQuery({ queryKey: [QUERY_KEYS.AVAILABLE_TODAY], queryFn: fetchAvailableToday, staleTime: 60_000 });
  const approvedReviews = useQuery({
    queryKey: [QUERY_KEYS.APPROVED_REVIEWS],
    queryFn: () => fetchApprovedReviews(8),
    staleTime: 60_000,
  });
  const restaurantStatus = useQuery({
    queryKey: [QUERY_KEYS.RESTAURANT_STATUS],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', [
        'restaurant_is_open',
        'restaurant_open_time',
        'restaurant_close_time',
        'restaurant_closed_msg',
        'whatsapp_number',
      ]);
      const map: Record<string, string> = {};
      (data ?? []).forEach((row) => { map[row.key] = String(row.value).replace(/^"|"$/g, ''); });
      return map;
    },
    staleTime: 60_000,
  });
  const brandSettings = useQuery({
    queryKey: [QUERY_KEYS.BRAND_SETTINGS],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_settings')
        .select('key, value')
        .eq('key', 'hero_image_url');
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((row) => { map[row.key] = row.value ?? ''; });
      return map;
    },
    staleTime: 60_000,
  });

  const isOpen = restaurantStatus.data?.restaurant_is_open !== 'false';
  const closeTime = restaurantStatus.data?.restaurant_close_time ?? '22:00';
  const closedMessage = restaurantStatus.data?.restaurant_closed_msg ?? 'مغلق حاليًا، تقدر تتصفح القائمة وتطلب لاحقًا';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      categories.refetch(),
      popular.refetch(),
      featured.refetch(),
      newest.refetch(),
      todaySpecials.refetch(),
      approvedReviews.refetch(),
      restaurantStatus.refetch(),
      brandSettings.refetch(),
    ]);
    setRefreshing(false);
  }, [approvedReviews, brandSettings, categories, featured, newest, popular, restaurantStatus, todaySpecials]);

  if (categories.isError || popular.isError || featured.isError || newest.isError) return <ErrorState onRetry={onRefresh} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showLogo showSearch showActions showThemeToggle={false} onSearchPress={() => router.push('/search')} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        contentContainerStyle={{ paddingBottom: 104 }}
      >
        <RestaurantStatus open={isOpen} closeTime={closeTime} message={closedMessage} />

        <ManagedHero
          imageUrl={brandSettings.data?.hero_image_url || popular.data?.data[0]?.image_url}
          title="أكل البيت… من غير تعب الطبخ"
          subtitle="أكل مصري متحضّر بعناية، من البيت للبيت"
          onPress={() => router.navigate('/(tabs)/menu')}
        />

        <SectionHeader title="اختار القسم" subtitle="وصل لطلبك في أقل خطوات" icon={<UtensilsCrossed size={19} color={colors.primary} />} onPress={() => router.navigate('/(tabs)/menu')} />
        {categories.isLoading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} width={104} height={44} borderRadius={radius.full} style={{ marginLeft: spacing.sm }} />)}
          </ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
            <CategoryChip label="الكل" active icon={<Sparkles size={16} color="#FFFFFF" />} onPress={() => router.navigate('/(tabs)/menu')} />
            {(categories.data ?? []).map((category, index) => (
              <CategoryChip
                key={category.id}
                label={category.name}
                icon={<Text style={{ fontSize: 16 }}>{CATEGORY_ICONS[index % CATEGORY_ICONS.length]}</Text>}
                onPress={() => router.navigate({ pathname: '/(tabs)/menu', params: { categoryId: category.id } })}
              />
            ))}
          </ScrollView>
        )}

        {(todaySpecials.isLoading || (todaySpecials.data?.length ?? 0) > 0) ? (
          <View>
            <SectionHeader title="متاح النهارده" subtitle="كميات محدودة وبتتحضر طازة" icon={<BadgePercent size={19} color={colors.accent} />} />
            {todaySpecials.isLoading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
                {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} width={222} height={236} borderRadius={radius.lg} style={{ marginLeft: spacing.compact }} />)}
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
                {(todaySpecials.data ?? []).map((special) => (
                  <SpecialCard
                    key={special.id}
                    item={special}
                    open={isOpen}
                    onPress={() => router.push({ pathname: '/food/quick/[id]', params: { id: special.meal_id ?? special.id, todaySpecialId: special.id } })}
                    onAdd={() => {
                      if (!isOpen || special.status !== 'available') return;
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                      addItem({ meal_id: special.meal_id ?? special.id, name: special.title, image_url: special.image_url, price: special.price, quantity: 1, notes: '', is_today_special: true, today_special_id: special.id });
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        <View>
          <SectionHeader title="الأكثر طلبًا" subtitle="اختيارات العملاء المفضلة" icon={<Flame size={19} color={colors.accent} />} onPress={() => router.navigate('/(tabs)/menu')} />
          {popular.isLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.lg }}>
              {Array.from({ length: 3 }).map((_, index) => <View key={index} style={{ width: 180 }}><SkeletonCard /></View>)}
            </ScrollView>
          ) : (popular.data?.data.length ?? 0) > 0 ? (
            <FlatList
              removeClippedSubviews={false}
              data={popular.data?.data}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(meal) => meal.id}
              contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}
              renderItem={({ item }) => <FoodCard meal={item} horizontal />}
            />
          ) : null}
        </View>

        <MealRail
          title="مختارات سفرة"
          subtitle="أصناف مميزة اخترناها ليك"
          icon={<ChefHat size={19} color={colors.primary} />}
          meals={featured.data?.data}
          loading={featured.isLoading}
          onPress={() => router.navigate('/(tabs)/menu')}
        />

        <MealRail
          title="أحدث الإضافات"
          subtitle="كل جديد من مطبخ سفرة"
          icon={<Sparkles size={19} color={colors.accent} />}
          meals={newest.data?.data}
          loading={newest.isLoading}
          onPress={() => router.navigate('/(tabs)/menu')}
        />

        {(approvedReviews.data?.length ?? 0) > 0 ? (
          <View>
            <SectionHeader
              title="آراء العملاء"
              subtitle="تجارب حقيقية من عملاء سفرة"
              icon={<Star size={19} color={colors.star} fill={colors.star} />}
              onPress={() => router.push('/reviews')}
            />
            <FlatList
              removeClippedSubviews={false}
              data={approvedReviews.data}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(review) => review.id}
              contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}
              renderItem={({ item: review }) => (
                <PressableScale
                  onPress={() => router.push('/reviews')}
                  style={{ width: 250, marginLeft: spacing.compact }}
                  contentStyle={{
                    minHeight: 150,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: review.is_pinned ? colors.star : colors.border,
                    backgroundColor: colors.card,
                    gap: spacing.sm,
                    ...shadow.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row-reverse', gap: 2 }}>
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          size={13}
                          color={colors.star}
                          fill={index < review.rating ? colors.star : 'transparent'}
                        />
                      ))}
                    </View>
                    {review.is_pinned ? (
                      <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.accentSubtle }}>
                        <Text style={{ color: colors.accent, fontFamily: fontFamily.semibold, fontSize: 9 }}>رأي مميز</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: colors.foreground, fontFamily: fontFamily.bold, fontSize: fontSize.sm, textAlign: 'right' }}>
                    {review.customer?.full_name ?? 'عميل سفرة'}
                  </Text>
                  {review.meal?.name ? (
                    <Text numberOfLines={1} style={{ color: colors.primary, fontFamily: fontFamily.medium, fontSize: fontSize.xs, textAlign: 'right' }}>
                      على صنف: {review.meal.name}
                    </Text>
                  ) : null}
                  <Text numberOfLines={3} style={{ color: colors.mutedForeground, fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 19, textAlign: 'right' }}>
                    {review.comment || 'تجربة ممتازة وأنصح بالطلب من سفرة.'}
                  </Text>
                </PressableScale>
              )}
            />
          </View>
        ) : null}

        <TrustStrip />
      </ScrollView>
      <FloatingButtons whatsappNumber={restaurantStatus.data?.whatsapp_number} />
    </View>
  );
}

function MealRail({
  title,
  subtitle,
  icon,
  meals,
  loading,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  meals?: Meal[];
  loading: boolean;
  onPress: () => void;
}) {
  if (!loading && (meals?.length ?? 0) === 0) return null;

  return (
    <View>
      <SectionHeader title={title} subtitle={subtitle} icon={icon} onPress={onPress} />
      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.lg }}>
          {Array.from({ length: 3 }).map((_, index) => <View key={index} style={{ width: 180 }}><SkeletonCard /></View>)}
        </ScrollView>
      ) : (
        <FlatList
          removeClippedSubviews={false}
          data={meals}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(meal) => meal.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}
          renderItem={({ item }) => <FoodCard meal={item} horizontal />}
        />
      )}
    </View>
  );
}

function ManagedHero({ imageUrl, title, subtitle, onPress }: { imageUrl?: string | null; title: string; subtitle: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      style={{ marginHorizontal: spacing.md, marginTop: spacing.md }}
      contentStyle={{ height: 210, borderRadius: radius['2xl'], overflow: 'hidden', ...shadow.card }}
    >
      <Image
        source={imageUrl ? { uri: imageUrl } : require('../../assets/images/placeholder.png')}
        style={{ width: '100%', height: '100%' }}
        contentFit={imageUrl ? 'cover' : 'contain'}
        transition={220}
      />
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', inset: 0, padding: spacing.lg, justifyContent: 'flex-end', alignItems: 'flex-end' }}
      >
        <Text numberOfLines={2} style={{ color: '#FFFFFF', fontFamily: fontFamily.extrabold, fontSize: fontSize['2xl'], lineHeight: 32, textAlign: 'right' }}>
          {title}
        </Text>
        <Text numberOfLines={2} style={{ color: 'rgba(255,255,255,0.88)', fontFamily: fontFamily.regular, fontSize: fontSize.xs, textAlign: 'right', marginTop: 3 }}>
          {subtitle}
        </Text>
        <View style={{ marginTop: spacing.sm, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.18)', flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
          <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: fontSize.sm }}>اطلب دلوقتي</Text>
          <ArrowLeft size={14} color="#FFFFFF" />
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

function RestaurantStatus({ open, closeTime, message }: { open: boolean; closeTime: string; message: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginHorizontal: spacing.md, marginTop: spacing.compact, paddingHorizontal: spacing.compact, paddingVertical: spacing.sm, borderRadius: radius.md, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, backgroundColor: open ? colors.successSubtle : colors.destructiveSubtle }}>
      {open ? <CheckCircle2 size={15} color={colors.success} /> : <AlertTriangle size={15} color={colors.destructive} />}
      <Text numberOfLines={1} style={{ flex: 1, textAlign: 'right', color: open ? colors.success : colors.destructive, fontFamily: fontFamily.semibold, fontSize: fontSize.xs }}>
        {open ? `مفتوح الآن · الطلبات متاحة حتى ${closeTime}` : message}
      </Text>
    </View>
  );
}

function SpecialCard({ item, open, onPress, onAdd }: { item: AvailableToday; open: boolean; onPress: () => void; onAdd: () => void }) {
  const { colors } = useTheme();
  const unavailable = !open || item.status !== 'available' || item.quantity <= 0;
  return (
    <PressableScale
      onPress={onPress}
      disabled={item.status === 'expired'}
      style={{ width: 222, marginLeft: spacing.compact }}
      contentStyle={{ backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow.card }}
    >
      <View style={{ height: 132, backgroundColor: colors.muted }}>
        {item.image_url ? <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={180} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 42 }}>🍽️</Text></View>}
        <View style={{ position: 'absolute', top: 10, right: 10, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: unavailable ? colors.foregroundTertiary : colors.accent, flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
          <Zap size={11} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.semibold, fontSize: 10 }}>{unavailable ? 'غير متاح' : 'عرض اليوم'}</Text>
        </View>
      </View>
      <View style={{ padding: spacing.compact, gap: spacing.sm }}>
        <Text numberOfLines={1} style={{ color: colors.foreground, fontFamily: fontFamily.bold, fontSize: fontSize.md, textAlign: 'right' }}>{item.title}</Text>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.primary, fontFamily: fontFamily.bold, fontSize: fontSize.lg }}>{formatEGP(item.price)}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: fontFamily.regular, fontSize: 10 }}>متبقي {Math.max(item.quantity, 0)}</Text>
        </View>
        <Pressable onPress={(event) => { event.stopPropagation(); onAdd(); }} disabled={unavailable} style={{ height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: unavailable ? colors.muted : colors.accent }}>
          <Text style={{ color: unavailable ? colors.mutedForeground : colors.accentForeground, fontFamily: fontFamily.semibold, fontSize: fontSize.sm }}>{unavailable ? 'غير متاح حاليًا' : 'أضف للسلة'}</Text>
        </Pressable>
      </View>
    </PressableScale>
  );
}

function TrustStrip() {
  const { colors } = useTheme();
  const items = [
    { icon: ChefHat, title: 'تحضير طازة' },
    { icon: ShieldCheck, title: 'تغليف آمن' },
    { icon: Clock3, title: 'وقت واضح' },
    { icon: Truck, title: 'توصيل سريع' },
  ];
  return (
    <View style={{ marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primarySubtle, flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
      {items.map(({ icon: Icon, title }) => (
        <View key={title} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={colors.primary} /></View>
          <Text numberOfLines={1} style={{ color: colors.foregroundSecondary, fontFamily: fontFamily.semibold, fontSize: 10 }}>{title}</Text>
        </View>
      ))}
    </View>
  );
}
