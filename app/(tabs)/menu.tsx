import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChefHat, SlidersHorizontal, X, Check, Clock3, Star, Truck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, gradients, radius, shadow, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FoodCard } from '@/components/shared/FoodCard';
import { Chip } from '@/components/ui/Primitives';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { fetchCategories, fetchMeals, fetchSubcategories, type MealSortOption } from '@/features/menu/api/meals.api';
import { QUERY_KEYS } from '@/constants';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';

const SORT_OPTIONS: { value: MealSortOption; label: string }[] = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'popular', label: 'الأكثر طلباً' },
  { value: 'rating', label: 'الأعلى تقييماً' },
  { value: 'most_favorited', label: 'الأكثر تفضيلاً' },
  { value: 'price_asc', label: 'السعر: الأقل أولاً' },
  { value: 'price_desc', label: 'السعر: الأعلى أولاً' },
];

export default function MenuScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const [categoryId, setCategoryId] = useState<string | undefined>(params.categoryId);
  const [subcategoryId, setSubcategoryId] = useState<string | undefined>();
  const [sort, setSort] = useState<MealSortOption>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useRealtimeInvalidate('categories', [QUERY_KEYS.CATEGORIES]);
  useRealtimeInvalidate('subcategories', ['subcategories']);
  useRealtimeInvalidate('meals', [QUERY_KEYS.MEALS]);

  useEffect(() => { if (params.categoryId) setCategoryId(params.categoryId); }, [params.categoryId]);

  const categories = useQuery({ queryKey: [QUERY_KEYS.CATEGORIES], queryFn: fetchCategories, staleTime: 60_000 });
  const subs = useQuery({ queryKey: ['subcategories', categoryId], queryFn: () => fetchSubcategories(categoryId), enabled: !!categoryId });
  const meals = useInfiniteQuery({
    queryKey: [QUERY_KEYS.MEALS, categoryId, subcategoryId, sort],
    queryFn: ({ pageParam }) => fetchMeals({ categoryId, subcategoryId, sort, page: pageParam, pageSize: 20 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
  });

  const mealItems = meals.data?.pages.flatMap((page) => page.data) ?? [];
  const mealsCount = meals.data?.pages[0]?.count ?? 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await meals.refetch();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="منيو سفرة" showBack={false} showSearch showThemeToggle={false} onSearchPress={() => router.push('/search')} />

      <LinearGradient colors={gradients.primary} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ margin: spacing.md, marginBottom: spacing.sm, padding: spacing.md, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sm }}>
        <View style={{ position: 'absolute', left: -20, top: -35, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: fontSize.xl, textAlign: 'right' }}>مطبخ سفرة</Text>
            <Text style={{ color: 'rgba(255,255,255,0.78)', fontFamily: fontFamily.regular, fontSize: fontSize.xs, textAlign: 'right', marginTop: 2 }}>أكل طازة بيتحضّر مخصوص ليك</Text>
          </View>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat size={24} color="#FFFFFF" />
          </View>
        </View>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, marginTop: spacing.compact }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}><Star size={13} color="#FDE68A" fill="#FDE68A" /><Text style={{ color: '#FFFFFF', fontFamily: fontFamily.semibold, fontSize: fontSize.xs }}>4.8</Text></View>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}><Clock3 size={13} color="rgba(255,255,255,0.82)" /><Text style={{ color: 'rgba(255,255,255,0.82)', fontFamily: fontFamily.regular, fontSize: fontSize.xs }}>30-45 دقيقة</Text></View>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}><Truck size={13} color="rgba(255,255,255,0.82)" /><Text style={{ color: 'rgba(255,255,255,0.82)', fontFamily: fontFamily.regular, fontSize: fontSize.xs }}>توصيل آمن</Text></View>
        </View>
      </LinearGradient>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}>
        <Chip label="الكل" active={!categoryId} onPress={() => { setCategoryId(undefined); setSubcategoryId(undefined); }} />
        {(categories.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => { setCategoryId(c.id); setSubcategoryId(undefined); }} />
        ))}
      </ScrollView>

      {/* Subcategory chips */}
      {(subs.data?.length ?? 0) > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm }}>
          <Chip label="الكل" size="sm" active={!subcategoryId} onPress={() => setSubcategoryId(undefined)} />
          {(subs.data ?? []).map((s) => (
            <Chip key={s.id} label={s.name} size="sm" active={subcategoryId === s.id} onPress={() => setSubcategoryId(s.id)} />
          ))}
        </ScrollView>
      )}

      {/* Filter bar */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground }}>
          {mealsCount} نتيجة
        </Text>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: colors.muted, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 }}
        >
          <SlidersHorizontal size={14} color={colors.foreground} />
          <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.foreground }}>ترتيب</Text>
        </Pressable>
      </View>

      {meals.isError ? (
        <ErrorState onRetry={() => meals.refetch()} />
      ) : meals.isLoading ? (
        <FlatList
          removeClippedSubviews={false}
          data={Array.from({ length: 6 })}
          keyExtractor={(_, i) => String(i)}
          numColumns={2}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.sm }}
          renderItem={() => <View style={{ flex: 1 }}><SkeletonCard /></View>}
        />
      ) : mealItems.length === 0 ? (
        <EmptyState emoji="🍽️" title="لا توجد أصناف" description="جرّب تغيير الفلتر أو القسم" />
      ) : (
        <FlatList
          removeClippedSubviews={false}
          data={mealItems}
          keyExtractor={(m) => m.id}
          numColumns={2}
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: 80 }}
          renderItem={({ item }) => <FoodCard meal={item} />}
          onEndReached={() => {
            if (meals.hasNextPage && !meals.isFetchingNextPage) meals.fetchNextPage();
          }}
          onEndReachedThreshold={0.45}
          ListFooterComponent={meals.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.lg }} />
          ) : null}
        />
      )}

      {/* Sort modal */}
      <Modal visible={filtersOpen} animationType="slide" transparent onRequestClose={() => setFiltersOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'], padding: spacing.lg }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.foreground }}>الترتيب</Text>
              <Pressable onPress={() => setFiltersOpen(false)}>
                <X size={22} color={colors.foreground} />
              </Pressable>
            </View>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => { setSort(opt.value); setFiltersOpen(false); }}
                style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.borderLight }}
              >
                <Text style={{ fontFamily: sort === opt.value ? fontFamily.bold : fontFamily.regular, fontSize: fontSize.md, color: sort === opt.value ? colors.primary : colors.foreground }}>
                  {opt.label}
                </Text>
                {sort === opt.value && <Check size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}
