import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { SlidersHorizontal, X, Check } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FoodCard } from '@/components/shared/FoodCard';
import { Chip } from '@/components/ui/Primitives';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { fetchCategories, fetchMeals, fetchSubcategories, type MealSortOption } from '@/features/menu/api/meals.api';
import { QUERY_KEYS } from '@/constants';

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
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const [categoryId, setCategoryId] = useState<string | undefined>(params.categoryId);
  const [subcategoryId, setSubcategoryId] = useState<string | undefined>();
  const [sort, setSort] = useState<MealSortOption>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (params.categoryId) setCategoryId(params.categoryId); }, [params.categoryId]);

  const categories = useQuery({ queryKey: [QUERY_KEYS.CATEGORIES], queryFn: fetchCategories, staleTime: 60_000 });
  const subs = useQuery({ queryKey: ['subcategories', categoryId], queryFn: () => fetchSubcategories(categoryId), enabled: !!categoryId });
  const meals = useQuery({
    queryKey: [QUERY_KEYS.MEALS, categoryId, subcategoryId, sort],
    queryFn: () => fetchMeals({ categoryId, subcategoryId, sort, pageSize: 40 }),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await meals.refetch();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="المنيو" showBack={false} showThemeToggle />

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
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground }}>
          {meals.data?.count ?? 0} نتيجة
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
          data={Array.from({ length: 6 })}
          keyExtractor={(_, i) => String(i)}
          numColumns={2}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.sm }}
          renderItem={() => <View style={{ flex: 1 }}><SkeletonCard /></View>}
        />
      ) : meals.data?.data.length === 0 ? (
        <EmptyState emoji="🍽️" title="لا توجد أصناف" description="جرّب تغيير الفلتر أو القسم" />
      ) : (
        <FlatList
          data={meals.data?.data}
          keyExtractor={(m) => m.id}
          numColumns={2}
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: 80 }}
          renderItem={({ item }) => <FoodCard meal={item} />}
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
