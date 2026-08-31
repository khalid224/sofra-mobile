import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Clock3, Search, Sparkles, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FoodCard } from '@/components/shared/FoodCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { searchMeals } from '@/features/menu/api/meals.api';
import { STORAGE_KEYS } from '@/constants';
import { useDebounce } from '@/hooks/useDebounce';

export default function SearchScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES).then((v) => {
      if (v) setRecent(JSON.parse(v) as string[]);
    });
  }, []);

  const saveSearch = (q: string) => {
    const updated = [q, ...recent.filter((r) => r !== q)].slice(0, 10);
    setRecent(updated);
    AsyncStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated));
  };

  const results = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchMeals(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
  });

  const handleSelect = (q: string) => { setQuery(q); saveSearch(q); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search input header */}
      <ScreenHeader title="البحث" showBack showThemeToggle={false} />
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
        <View style={{ height: 54, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.compact, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, ...shadow.sm }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}>
            <Search size={18} color={colors.primary} />
          </View>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث عن أكلة أو قسم..."
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
            style={{ flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.foreground, paddingVertical: 12 }}
            onSubmitEditing={() => { if (query.trim()) saveSearch(query.trim()); }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {query.trim().length < 2 ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          {recent.length > 0 && (
            <>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.compact }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }}>
                  <Clock3 size={18} color={colors.primary} />
                  <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground }}>بحثت مؤخرًا</Text>
                </View>
                <Pressable onPress={() => { setRecent([]); AsyncStorage.removeItem(STORAGE_KEYS.RECENT_SEARCHES).catch(() => undefined); }}>
                  <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.xs, color: colors.destructive }}>مسح</Text>
                </Pressable>
              </View>
              {recent.map((r) => (
                <Pressable key={r} onPress={() => handleSelect(r)}
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.compact, padding: spacing.compact, marginBottom: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight }}>
                  <Clock3 size={15} color={colors.mutedForeground} />
                  <Text style={{ flex: 1, textAlign: 'right', fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.foreground }}>{r}</Text>
                  <Search size={14} color={colors.foregroundTertiary} />
                </Pressable>
              ))}
            </>
          )}
          {recent.length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: spacing.xl, gap: spacing.compact }}>
              <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={28} color={colors.primary} />
              </View>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.foreground }}>اكتشف طلبك الجاي</Text>
              <Text style={{ maxWidth: 250, textAlign: 'center', fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground }}>اكتب اسم الأكلة أو القسم، وهتظهر النتائج فورًا</Text>
            </View>
          )}
        </View>
      ) : results.isLoading ? (
        <FlatList removeClippedSubviews={false} numColumns={2} data={Array.from({ length: 4 })} keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingHorizontal: spacing.sm }}
          renderItem={() => <View style={{ flex: 1 }}><SkeletonCard /></View>} />
      ) : results.data?.length === 0 ? (
        <EmptyState emoji="🔍" title="لا توجد نتائج" description={`لم نجد أي أكلة باسم "${query}"`} />
      ) : (
        <FlatList
          removeClippedSubviews={false}
          data={results.data}
          keyExtractor={(m) => m.id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: 80 }}
          ListHeaderComponent={
            <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, padding: spacing.sm, textAlign: 'right' }}>
              {results.data?.length} نتيجة لـ “{debouncedQuery}”
            </Text>
          }
          renderItem={({ item }) => <FoodCard meal={item} />}
        />
      )}
    </View>
  );
}
